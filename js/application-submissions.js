document.addEventListener('DOMContentLoaded', () => {
    const forms = Array.from(document.querySelectorAll('form[data-submission-type]'));
    if (!forms.length) {
        return;
    }

    const config = window.NEXGEN_FORMS || {};
    const fallbackMessage = 'Submission failed. Please email info@nexgenleaders.org.';
    const successMessages = {
        program: 'Thank you. Your application was submitted successfully. Our team will contact you by email.',
        mentor: 'Thank you. Your registration was submitted successfully. Our team will contact you by email.',
        contact: 'Thank you. Your message has been sent. We aim to respond within 2 business days.'
    };

    function setStatus(form, message, tone) {
        const status = form.querySelector('[data-form-status]');
        if (!status) {
            return;
        }

        status.textContent = message || '';
        status.classList.remove('is-success', 'is-error', 'is-loading');

        if (tone === 'success') {
            status.classList.add('is-success');
        } else if (tone === 'error') {
            status.classList.add('is-error');
        } else if (tone === 'loading') {
            status.classList.add('is-loading');
        }
    }

    function setSubmitting(form, isSubmitting) {
        const button = form.querySelector('button[type="submit"]');
        if (button) {
            button.dataset.label = button.dataset.label || button.textContent;
            button.disabled = isSubmitting;
            button.textContent = isSubmitting ? 'Submitting...' : button.dataset.label;
        }
    }

    // A field people never see; automated bots tend to fill it in.
    function addSpamTrap(form) {
        const trap = document.createElement('div');
        trap.setAttribute('aria-hidden', 'true');
        trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
        trap.innerHTML = '<input type="text" name="website" tabindex="-1" autocomplete="off">';
        form.appendChild(trap);
    }

    async function submitForm(form) {
        if (!config.endpoint) {
            throw new Error('Our forms are being set up. Please email info@nexgenleaders.org.');
        }

        const payload = Object.fromEntries(new FormData(form).entries());
        payload.submission_type = form.dataset.submissionType;

        // Sent as text/plain because Google Apps Script cannot answer the
        // browser's preflight check that application/json would trigger.
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => null);

        if (!result) {
            throw new Error(fallbackMessage);
        }
        if (!result.ok) {
            throw new Error(result.message || fallbackMessage);
        }
    }

    forms.forEach(form => {
        addSpamTrap(form);

        form.addEventListener('submit', async event => {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            setSubmitting(form, true);
            setStatus(form, 'Submitting your details...', 'loading');

            try {
                await submitForm(form);
                form.reset();
                setStatus(form, successMessages[form.dataset.submissionType], 'success');
            } catch (error) {
                const isNetworkError = error instanceof TypeError;
                setStatus(form, isNetworkError ? fallbackMessage : error.message, 'error');
            } finally {
                setSubmitting(form, false);
            }
        });
    });
});
