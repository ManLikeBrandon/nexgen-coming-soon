import md5 from "npm:blueimp-md5@2.19.0";

// PayFast rebuilds the signature from the fields in the order it receives them,
// so both the form we post and the string we hash must follow this exact order.
export const PAYFAST_FIELD_ORDER = [
    "merchant_id",
    "merchant_key",
    "return_url",
    "cancel_url",
    "notify_url",
    "name_first",
    "name_last",
    "email_address",
    "cell_number",
    "m_payment_id",
    "amount",
    "item_name",
    "item_description",
    "custom_int1",
    "custom_int2",
    "custom_int3",
    "custom_int4",
    "custom_int5",
    "custom_str1",
    "custom_str2",
    "custom_str3",
    "custom_str4",
    "custom_str5",
    "email_confirmation",
    "confirmation_address",
    "payment_method",
    "subscription_type",
    "billing_date",
    "recurring_amount",
    "frequency",
    "cycles"
] as const;

export type PayFastPair = [string, string];

// PayFast signs with PHP's urlencode(), which escapes ! ' ( ) * ~ and turns
// spaces into "+". encodeURIComponent leaves those characters alone.
export function phpUrlEncode(value: string): string {
    return encodeURIComponent(value)
        .replace(/%20/g, "+")
        .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signPairs(pairs: PayFastPair[], passphrase: string): string {
    const base = pairs.map(([key, value]) => `${key}=${phpUrlEncode(value)}`).join("&");
    const payload = passphrase ? `${base}&passphrase=${phpUrlEncode(passphrase)}` : base;
    return md5(payload);
}

export function buildOrderedFields(values: Record<string, string>): PayFastPair[] {
    return PAYFAST_FIELD_ORDER
        .filter((key) => typeof values[key] === "string" && values[key] !== "")
        .map((key) => [key, values[key]] as PayFastPair);
}

export function payfastHost(mode: string): string {
    return mode === "live" ? "www.payfast.co.za" : "sandbox.payfast.co.za";
}

export function processUrl(mode: string): string {
    return `https://${payfastHost(mode)}/eng/process`;
}

export function validateUrl(mode: string): string {
    return `https://${payfastHost(mode)}/eng/query/validate`;
}

export function constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < a.length; index += 1) {
        difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }

    return difference === 0;
}

// PayFast's reference implementation hashes every posted field in the order
// received, including the empty ones. Some accounts omit the empty fields, so we
// accept either construction - both still require the passphrase to produce.
export function verifyItnSignature(
    pairs: PayFastPair[],
    passphrase: string,
    incoming: string
): boolean {
    if (!incoming) {
        return false;
    }

    const signable = pairs.filter(([key]) => key !== "signature");
    const candidates = [
        signPairs(signable, passphrase),
        signPairs(signable.filter(([, value]) => value !== ""), passphrase)
    ];

    return candidates.some((candidate) => constantTimeEquals(candidate, incoming));
}

// Control characters and stray newlines break the signature string, so they are
// flattened to spaces before anything is signed or sent to PayFast.
export function sanitizeText(value: unknown, maxLength: number): string {
    const flattened = Array.from(String(value ?? ""))
        .map((char) => {
            const code = char.charCodeAt(0);
            return code < 32 || code === 127 ? " " : char;
        })
        .join("");

    return flattened.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function isValidEmail(value: string): boolean {
    return value.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

// PayFast expects billing_date in South African local time.
export function johannesburgToday(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Johannesburg",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

export function corsHeaders(req: Request, allowedOrigins: string[]): Record<string, string> {
    const origin = req.headers.get("origin") || "";
    const allowOrigin = allowedOrigins.length === 0
        ? "*"
        : (allowedOrigins.includes(origin) ? origin : "");

    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Vary": "Origin"
    };
}

export function jsonResponse(
    body: unknown,
    status: number,
    headers: Record<string, string>
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, "Content-Type": "application/json" }
    });
}

const PAYFAST_SOURCE_HOSTS = [
    "www.payfast.co.za",
    "sandbox.payfast.co.za",
    "w1w.payfast.co.za",
    "w2w.payfast.co.za"
];

// Returns null when DNS is unavailable in the runtime, so the caller can skip
// the check instead of rejecting a legitimate payment notification.
export async function isPayfastSourceIp(ip: string): Promise<boolean | null> {
    if (!ip) {
        return null;
    }

    try {
        const resolved = await Promise.all(
            PAYFAST_SOURCE_HOSTS.map((host) => Deno.resolveDns(host, "A").catch(() => [] as string[]))
        );
        const allowed = new Set(resolved.flat());
        return allowed.size === 0 ? null : allowed.has(ip);
    } catch {
        return null;
    }
}

export function clientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for") || "";
    return forwarded.split(",")[0].trim();
}
