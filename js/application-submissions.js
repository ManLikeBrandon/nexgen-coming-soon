document.addEventListener('DOMContentLoaded', () => {
    const pageId = document.body.dataset.page;
    if (pageId !== 'get-involved') {
        return;
    }

    const forms = Array.from(document.querySelectorAll('form[data-submission-type]'));
    if (!forms.length) {
        return;
    }

    const config = window.NEXGEN_CMS || {};

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
            button.disabled = isSubmitting;
            button.textContent = isSubmitting
                ? 'Submitting...'
                : (form.dataset.submissionType === 'mentor' ? 'Register as Mentor' : 'Submit Application');
        }
    }

    function loadSupabaseScript() {
        if (window.supabase && window.supabase.createClient) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load Supabase client.'));
            document.head.appendChild(script);
        });
    }

    async function createClient() {
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Submission service is not configured yet. Please email info@nexgenleaders.org.');
        }

        await loadSupabaseScript();
        return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    }

    function toPayload(form) {
        const data = new FormData(form);
        const raw = Object.fromEntries(data.entries());
        const submissionType = form.dataset.submissionType;

        return {
            submission_type: submissionType,
            first_name: (raw.first_name || '').trim(),
            last_name: (raw.last_name || '').trim(),
            email: (raw.email || '').trim().toLowerCase(),
            age: raw.age ? Number(raw.age) : null,
            city: (raw.city || '').trim() || null,
            program: (raw.program || '').trim() || null,
            profession: (raw.profession || '').trim() || null,
            experience: (raw.experience || '').trim() || null,
            motivation: (raw.motivation || '').trim(),
            heard: (raw.heard || '').trim() || null,
            source_page: 'get-involved'
        };
    }

    forms.forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            setSubmitting(form, true);
            setStatus(form, 'Submitting your details...', 'loading');

            try {
                const client = await createClient();
                const payload = toPayload(form);
                const { error } = await client
                    .from('applications')
                    .insert(payload);

                if (error) {
                    throw new Error(error.message || 'Unable to submit right now.');
                }

                form.reset();
                setStatus(
                    form,
                    'Thank you. Your application was submitted successfully. Our team will contact you by email.',
                    'success'
                );
            } catch (error) {
                setStatus(
                    form,
                    error.message || 'Submission failed. Please email info@nexgenleaders.org.',
                    'error'
                );
            } finally {
                setSubmitting(form, false);
            }
        });
    });
});
