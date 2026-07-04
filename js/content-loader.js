document.addEventListener('DOMContentLoaded', async () => {
    const pageId = document.body.dataset.page;
    const config = window.NEXGEN_CMS;

    if (!pageId || !config || !config.supabaseUrl || !config.supabaseAnonKey) {
        return;
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

    try {
        await loadSupabaseScript();
        const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        const { data, error } = await client.from('page_content').select('regions').eq('page_id', pageId).single();
        if (error || !data) {
            return;
        }

        Object.entries(data.regions || {}).forEach(([key, region]) => {
            const elements = document.querySelectorAll(`[data-region="${key}"]`);
            elements.forEach(element => {
                const renderMode = element.dataset.render || region.type;
                if (renderMode === 'html') {
                    element.innerHTML = region.value;
                } else {
                    element.textContent = region.value;
                }
            });
        });
    } catch (error) {
        console.error('Content loader failed:', error);
    }
});
