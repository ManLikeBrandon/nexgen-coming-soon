import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:blueimp-md5";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

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
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "";
        const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "";
        const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";
        const mode = (Deno.env.get("PAYFAST_MODE") || "sandbox").toLowerCase();
        const siteBaseUrl = Deno.env.get("SITE_BASE_URL") || "";
        const itnUrl = Deno.env.get("PAYFAST_ITN_URL") || `${siteBaseUrl}/functions/v1/payfast-itn`;

        if (!supabaseUrl || !serviceRoleKey || !merchantId || !merchantKey || !siteBaseUrl) {
            return new Response(JSON.stringify({ error: "Gateway not configured" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const body = await req.json();
        const firstName = String(body.firstName || "").trim();
        const lastName = String(body.lastName || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const donationIntent = String(body.donationIntent || "once").trim();
        const donorMessage = String(body.message || "").trim();
        const amountNumber = Number(body.amount);

        if (!firstName || !lastName || !email || !Number.isFinite(amountNumber) || amountNumber <= 0) {
            return new Response(JSON.stringify({ error: "Invalid donation details" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const amount = amountNumber.toFixed(2);
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
            donation_intent: donationIntent,
            donor_message: donorMessage,
            payment_status: "initiated",
            gateway: "payfast"
        });

        if (insertError) {
            return new Response(JSON.stringify({ error: "Unable to initialize donation" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const fields: Record<string, string> = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            return_url: `${siteBaseUrl}/donate?status=success`,
            cancel_url: `${siteBaseUrl}/donate?status=cancelled`,
            notify_url: itnUrl,
            name_first: firstName,
            name_last: lastName,
            email_address: email,
            m_payment_id: paymentId,
            amount,
            item_name: "NexGen Leaders Donation",
            item_description: donationIntent
        };

        fields.signature = buildSignature(fields, passphrase);

        const gatewayUrl = mode === "live"
            ? "https://www.payfast.co.za/eng/process"
            : "https://sandbox.payfast.co.za/eng/process";

        return new Response(JSON.stringify({ gatewayUrl, fields }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } catch (_error) {
        return new Response(JSON.stringify({ error: "Unable to start payment" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
