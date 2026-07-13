document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("payfast-donation-form");
    const status = document.getElementById("donation-status");

    if (!form || !status) {
        return;
    }

    const config = window.NEXGEN_PAYFAST || {};

    function setStatus(message, tone) {
        status.textContent = message || "";
        status.classList.remove("is-success", "is-error", "is-loading");

        if (tone === "success") {
            status.classList.add("is-success");
        } else if (tone === "error") {
            status.classList.add("is-error");
        } else if (tone === "loading") {
            status.classList.add("is-loading");
        }
    }

    function submitToPayFast(gatewayUrl, fields) {
        const payfastForm = document.createElement("form");
        payfastForm.method = "POST";
        payfastForm.action = gatewayUrl;

        Object.entries(fields).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") {
                return;
            }

            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = String(value);
            payfastForm.appendChild(input);
        });

        document.body.appendChild(payfastForm);
        payfastForm.submit();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (!config.initEndpoint) {
            setStatus("Payment setup incomplete. Please contact info@nexgenleaders.org.", "error");
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
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data?.gatewayUrl || !data?.fields) {
                throw new Error(data?.error || "Unable to start payment. Please try again.");
            }

            setStatus("Redirecting to PayFast...", "success");
            submitToPayFast(data.gatewayUrl, data.fields);
        } catch (error) {
            setStatus(error.message || "Unable to start payment. Please contact info@nexgenleaders.org.", "error");
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
});
