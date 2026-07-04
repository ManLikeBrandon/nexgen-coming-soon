document.addEventListener('DOMContentLoaded', async () => {
    const config = window.NEXGEN_CMS;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => links.classList.toggle('open'));
        document.querySelectorAll('.nav-links a').forEach(anchor => {
            anchor.addEventListener('click', () => links.classList.remove('open'));
        });
    }

    if (!slug || !config || !config.supabaseUrl || !config.supabaseAnonKey) {
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
        const { data, error } = await client.from('custom_pages').select('*').eq('slug', slug).eq('published', true).single();
        if (error || !data) {
            return;
        }

        document.title = `${data.title} | The NexGen Leaders Foundation`;
        document.getElementById('custom-breadcrumb').textContent = data.title;
        document.getElementById('custom-hero-title').innerHTML = data.hero_title || data.title;
        document.getElementById('custom-hero-body').textContent = data.hero_body || data.excerpt || '';
        document.getElementById('custom-page-body').innerHTML = data.content_html || '';
    } catch (error) {
        console.error('Custom page load failed:', error);
    }
});