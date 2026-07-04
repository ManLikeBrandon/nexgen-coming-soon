document.addEventListener('DOMContentLoaded', async () => {
    const pageId = document.body.dataset.page;
    if (!pageId) {
        return;
    }

    try {
        const response = await fetch(`/api/content/${encodeURIComponent(pageId)}`);
        if (!response.ok) {
            return;
        }

        const page = await response.json();
        Object.entries(page.regions || {}).forEach(([key, region]) => {
            const elements = document.querySelectorAll(`[data-region="${key}"]`);
            if (!elements.length) {
                return;
            }

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