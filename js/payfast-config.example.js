window.NEXGEN_PAYFAST = {
    // Public endpoint that starts checkout. The server signs the payment there,
    // so no PayFast credentials are ever exposed to the browser.
    // Find <project-ref> in Supabase: Project Settings -> General -> Reference ID.
    initEndpoint: "https://<project-ref>.supabase.co/functions/v1/payfast-init"
};
