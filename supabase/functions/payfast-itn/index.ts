import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:blueimp-md5";

function buildSignature(fields: Record<string, string>, passphrase: string): string {
    const keys = Object.keys(fields)
        .filter((key) => key !== "signature" && fields[key] !== "")
        .sort();

    const payload = keys
        .map((key) => `${key}=${encodeURIComponent(fields[key]).replace(/%20/g, "+")}`)
        .join("&");

    const withPassphrase = passphrase
        ? `${payload}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}`
        : payload;

    return md5(withPassphrase);
}

serve(async (req) => {
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
            return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await req.text();
        const params = new URLSearchParams(rawBody);
        const data: Record<string, string> = {};
        params.forEach((value, key) => {
            data[key] = value;
        });

        const incomingSignature = data.signature || "";
        const calculatedSignature = buildSignature(data, passphrase);
        if (!incomingSignature || incomingSignature !== calculatedSignature) {
            return new Response("Invalid signature", { status: 400 });
        }

        if (data.merchant_id !== merchantId) {
            return new Response("Merchant mismatch", { status: 400 });
        }

        const validateUrl = mode === "live"
            ? "https://www.payfast.co.za/eng/query/validate"
            : "https://sandbox.payfast.co.za/eng/query/validate";

        const validationResponse = await fetch(validateUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: rawBody
        });

        const validationText = (await validationResponse.text()).trim().toUpperCase();
        if (!validationResponse.ok || validationText !== "VALID") {
            return new Response("ITN validation failed", { status: 400 });
        }

        const paymentId = data.m_payment_id || "";
        if (!paymentId) {
            return new Response("Missing payment id", { status: 400 });
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
            return new Response("Donation not found", { status: 404 });
        }

        const expectedAmount = Number(donation.amount).toFixed(2);
        const receivedAmount = Number(data.amount_gross || data.amount_fee || data.amount || 0).toFixed(2);
        if (expectedAmount !== receivedAmount) {
            return new Response("Amount mismatch", { status: 400 });
        }

        if (donation.payment_status === "complete") {
            return new Response("OK", { status: 200 });
        }

        const status = (data.payment_status || "").toUpperCase();
        let nextStatus = "failed";
        if (status === "COMPLETE") {
            nextStatus = "complete";
        } else if (status === "CANCELLED") {
            nextStatus = "cancelled";
        }

        const { error: updateError } = await supabase
            .from("donations")
            .update({
                payment_status: nextStatus,
                gateway_payment_id: data.pf_payment_id || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", donation.id);

        if (updateError) {
            return new Response("Update failed", { status: 500 });
        }

        return new Response("OK", { status: 200 });
    } catch (_error) {
        return new Response("ITN processing failed", { status: 500 });
    }
});
