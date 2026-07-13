document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("payfast-donation-form");
    const status = document.getElementById("donation-status");

    if (!form || !status) {
        return;
    }

    const config = window.NEXGEN_PAYFAST || {};
    const supportEmail = "info@nexgenleaders.org";

    function setStatus(message, tone) {
        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (tone) {
            status.classList.add(`is-${tone}`);
        }
    }

    function showReturnMessage() {
        const result = new URLSearchParams(window.location.search).get("status");

        if (result === "success") {
            setStatus(
                "Thank you. Your payment was submitted successfully and a receipt will be emailed to you by PayFast.",
                "success"
            );
        } else if (result === "cancelled") {
            setStatus("Your payment was cancelled. You can start again whenever you are ready.", "error");
        }
    }

    // The signature PayFast verifies depends on the order the fields arrive in,
    // so the server sends an ordered list and we post it exactly as given.
    function submitToPayFast(gatewayUrl, fields) {
        const payfastForm = document.createElement("form");
        payfastForm.method = "POST";
        payfastForm.action = gatewayUrl;

        fields.forEach(({ name, value }) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            input.value = String(value);
            payfastForm.appendChild(input);
        });

        document.body.appendChild(payfastForm);
        payfastForm.submit();
    }

    showReturnMessage();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!config.initEndpoint) {
            setStatus(`Payment setup is incomplete. Please contact ${supportEmail}.`, "error");
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }

        setStatus("Preparing secure checkout...", "loading");

        try {
            const payload = {
                firstName: form.elements.first_name.value.trim(),
                lastName: form.elements.last_name.value.trim(),
                email: form.elements.email.value.trim().toLowerCase(),
                amount: form.elements.amount.value,
                donationIntent: form.elements.donation_intent.value,
                message: form.elements.message.value.trim()
            };

            const response = await fetch(config.initEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.gatewayUrl || !Array.isArray(data.fields)) {
                throw new Error(data?.error || "Unable to start payment. Please try again.");
            }

            setStatus("Redirecting to PayFast...", "success");
            submitToPayFast(data.gatewayUrl, data.fields);
        } catch (error) {
            setStatus(error.message || `Unable to start payment. Please contact ${supportEmail}.`, "error");
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
});
