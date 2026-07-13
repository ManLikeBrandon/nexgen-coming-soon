import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
    clientIp,
    isPayfastSourceIp,
    validateUrl,
    verifyItnSignature,
    type PayFastPair
} from "../_shared/payfast.ts";

const STATUS_MAP: Record<string, string> = {
    COMPLETE: "complete",
    CANCELLED: "cancelled",
    PENDING: "pending",
    FAILED: "failed"
};

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "";
        const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
        const mode = (Deno.env.get("PAYFAST_MODE") || "sandbox").toLowerCase();

        if (!supabaseUrl || !serviceRoleKey || !merchantId) {
            console.error("payfast-itn: missing required environment variables");
            return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await req.text();
        const pairs = [...new URLSearchParams(rawBody).entries()] as PayFastPair[];
        const data = Object.fromEntries(pairs) as Record<string, string>;

        // Security check 1: the signature proves the sender knows our passphrase.
        const incomingSignature = data.signature || "";
        if (!verifyItnSignature(pairs, passphrase, incomingSignature)) {
            console.warn("payfast-itn: signature mismatch");
            return new Response("Invalid signature", { status: 400 });
        }

        // Security check 2: the notification is for our merchant account.
        if (data.merchant_id !== merchantId) {
            console.warn("payfast-itn: merchant mismatch");
            return new Response("Merchant mismatch", { status: 400 });
        }

        // Security check 3: the request really came from a PayFast server.
        const sourceIsPayfast = await isPayfastSourceIp(clientIp(req));
        if (sourceIsPayfast === false) {
            console.warn("payfast-itn: rejected unknown source ip", clientIp(req));
            return new Response("Invalid source", { status: 403 });
        }

        // Security check 4: PayFast itself confirms it sent this exact payload.
        const validation = await fetch(validateUrl(mode), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: rawBody
        });
        const validationText = (await validation.text()).trim().toUpperCase();
        if (!validation.ok || !validationText.startsWith("VALID")) {
            console.warn("payfast-itn: server validation failed", validationText);
            return new Response("ITN validation failed", { status: 400 });
        }

        const paymentId = data.m_payment_id || "";
        const pfPaymentId = data.pf_payment_id || "";
        if (!paymentId || !pfPaymentId) {
            return new Response("Missing payment reference", { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false }
        });

        const { data: donation, error: donationError } = await supabase
            .from("donations")
            .select("id, amount, payment_status")
            .eq("payment_id", paymentId)
            .maybeSingle();

        if (donationError || !donation) {
            console.warn("payfast-itn: donation not found", paymentId);
            return new Response("Donation not found", { status: 404 });
        }

        // Security check 5: the amount charged matches the amount we recorded.
        const expectedAmount = Number(donation.amount).toFixed(2);
        const receivedAmount = Number(data.amount_gross || 0).toFixed(2);
        if (expectedAmount !== receivedAmount) {
            console.warn("payfast-itn: amount mismatch", { expectedAmount, receivedAmount });
            return new Response("Amount mismatch", { status: 400 });
        }

        const status = STATUS_MAP[(data.payment_status || "").toUpperCase()] || "failed";

        // pf_payment_id is unique per charge, so replayed or duplicated
        // notifications collapse into the same ledger row.
        const { error: ledgerError } = await supabase
            .from("donation_payments")
            .upsert({
                donation_id: donation.id,
                pf_payment_id: pfPaymentId,
                payment_status: status,
                amount_gross: Number(data.amount_gross || 0),
                amount_fee: Number(data.amount_fee || 0),
                amount_net: Number(data.amount_net || 0),
                raw_payload: data
            }, { onConflict: "pf_payment_id" });

        if (ledgerError) {
            console.error("payfast-itn: ledger upsert failed", ledgerError.message);
            return new Response("Update failed", { status: 500 });
        }

        const { error: updateError } = await supabase
            .from("donations")
            .update({
                payment_status: status,
                gateway_payment_id: pfPaymentId,
                payfast_token: data.token || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", donation.id);

        if (updateError) {
            console.error("payfast-itn: donation update failed", updateError.message);
            return new Response("Update failed", { status: 500 });
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("payfast-itn: unexpected error", error);
        return new Response("ITN processing failed", { status: 500 });
    }
});
