import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
    buildOrderedFields,
    corsHeaders,
    isValidEmail,
    johannesburgToday,
    jsonResponse,
    processUrl,
    sanitizeText,
    signPairs
} from "../_shared/payfast.ts";

const DONATION_INTENTS: Record<string, string> = {
    once: "One-time Donation",
    monthly: "Monthly Donation",
    corporate: "Corporate Giving",
    sponsorship: "Sponsorship"
};

const PAYFAST_MONTHLY_FREQUENCY = "3";
const PAYFAST_INDEFINITE_CYCLES = "0";

Deno.serve(async (req) => {
    const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    const headers = corsHeaders(req, allowedOrigins);

    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    if (!headers["Access-Control-Allow-Origin"]) {
        return jsonResponse({ error: "Origin not allowed" }, 403, headers);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "";
        const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "";
        const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
        const mode = (Deno.env.get("PAYFAST_MODE") || "sandbox").toLowerCase();
        const siteBaseUrl = (Deno.env.get("SITE_BASE_URL") || "").replace(/\/+$/, "");
        const notifyUrl = Deno.env.get("PAYFAST_NOTIFY_URL")
            || `${supabaseUrl}/functions/v1/payfast-itn`;

        const minAmount = Number(Deno.env.get("PAYFAST_MIN_AMOUNT") || "5");
        const maxAmount = Number(Deno.env.get("PAYFAST_MAX_AMOUNT") || "100000");

        if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantKey || !siteBaseUrl) {
            console.error("payfast-init: missing required environment variables");
            return jsonResponse({ error: "Payment gateway is not configured." }, 500, headers);
        }

        const body = await req.json().catch(() => null);
        if (!body || typeof body !== "object") {
            return jsonResponse({ error: "Invalid request." }, 400, headers);
        }

        const firstName = sanitizeText(body.firstName, 100);
        const lastName = sanitizeText(body.lastName, 100);
        const email = sanitizeText(body.email, 100).toLowerCase();
        const donorMessage = sanitizeText(body.message, 1000);
        const intent = sanitizeText(body.donationIntent, 40).toLowerCase();
        const amountNumber = Math.round(Number(body.amount) * 100) / 100;

        if (!firstName || !lastName) {
            return jsonResponse({ error: "Please provide your first and last name." }, 400, headers);
        }

        if (!isValidEmail(email)) {
            return jsonResponse({ error: "Please provide a valid email address." }, 400, headers);
        }

        if (!DONATION_INTENTS[intent]) {
            return jsonResponse({ error: "Please select a valid donation type." }, 400, headers);
        }

        if (!Number.isFinite(amountNumber) || amountNumber < minAmount || amountNumber > maxAmount) {
            return jsonResponse(
                { error: `Donation amount must be between R${minAmount} and R${maxAmount}.` },
                400,
                headers
            );
        }

        const amount = amountNumber.toFixed(2);
        const isRecurring = intent === "monthly";
        const paymentId = crypto.randomUUID();

        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false }
        });

        const { error: insertError } = await supabase.from("donations").insert({
            payment_id: paymentId,
            donor_first_name: firstName,
            donor_last_name: lastName,
            donor_email: email,
            amount: amountNumber,
            donation_intent: intent,
            donor_message: donorMessage,
            payment_status: "initiated",
            gateway: "payfast",
            subscription_type: isRecurring ? 1 : 0
        });

        if (insertError) {
            console.error("payfast-init: donation insert failed", insertError.message);
            return jsonResponse({ error: "Unable to start your donation." }, 500, headers);
        }

        const values: Record<string, string> = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            return_url: `${siteBaseUrl}/donate?status=success`,
            cancel_url: `${siteBaseUrl}/donate?status=cancelled`,
            notify_url: notifyUrl,
            name_first: firstName,
            name_last: lastName,
            email_address: email,
            m_payment_id: paymentId,
            amount,
            item_name: sanitizeText("NexGen Leaders Foundation Donation", 100),
            item_description: sanitizeText(DONATION_INTENTS[intent], 255)
        };

        if (isRecurring) {
            values.subscription_type = "1";
            values.billing_date = johannesburgToday();
            values.recurring_amount = amount;
            values.frequency = PAYFAST_MONTHLY_FREQUENCY;
            values.cycles = PAYFAST_INDEFINITE_CYCLES;
        }

        const fields = buildOrderedFields(values);
        const signature = signPairs(fields, passphrase);

        return jsonResponse(
            {
                gatewayUrl: processUrl(mode),
                paymentId,
                fields: [...fields, ["signature", signature]].map(([name, value]) => ({ name, value }))
            },
            200,
            headers
        );
    } catch (error) {
        console.error("payfast-init: unexpected error", error);
        return jsonResponse({ error: "Unable to start payment." }, 500, headers);
    }
});
