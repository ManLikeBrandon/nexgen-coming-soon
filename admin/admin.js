const state = { activePageId: null, content: null, customPages: [], user: null, client: null };

const loginPanel = document.getElementById('login-panel');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const signedInAs = document.getElementById('signed-in-as');
const pageNav = document.getElementById('page-nav');
const pageEditor = document.getElementById('page-editor');
const editorTitle = document.getElementById('editor-title');
const saveStatus = document.getElementById('save-status');
const customPageList = document.getElementById('custom-page-list');
const customPageForm = document.getElementById('custom-page-form');
const customStatus = document.getElementById('custom-status');
const logoutButton = document.getElementById('logout-button');
const customReset = document.getElementById('custom-reset');

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getConfig() {
    return window.NEXGEN_CMS || null;
}

function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
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

async function ensureClient() {
    const config = getConfig();
    if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error('Add js/cms-config.js with your Supabase URL and anon key.');
    }

    if (state.client) {
        return state.client;
    }

    await loadSupabaseScript();
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return state.client;
}

async function maybeSeedContent() {
    const client = await ensureClient();
    const { data } = await client.from('page_content').select('page_id').limit(1);
    if (data && data.length) {
        return;
    }

    const seed = await fetch('../data/content.json').then(response => response.json());
    const rows = Object.entries(seed.pages).map(([pageId, page]) => ({
        page_id: pageId,
        label: page.label,
        regions: page.regions
    }));
    await client.from('page_content').upsert(rows, { onConflict: 'page_id' });
}

function renderPageNav() {
    pageNav.innerHTML = '';
    Object.entries(state.content.pages).forEach(([pageId, page]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = page.label;
        button.className = state.activePageId === pageId ? 'active' : '';
        button.addEventListener('click', () => {
            state.activePageId = pageId;
            renderPageNav();
            renderPageEditor();
        });
        pageNav.appendChild(button);
    });
}

function renderPageEditor() {
    if (!state.activePageId) {
        editorTitle.textContent = 'Select a page';
        pageEditor.innerHTML = '';
        return;
    }

    const page = state.content.pages[state.activePageId];
    editorTitle.textContent = page.label;
    pageEditor.innerHTML = '';

    const regionList = document.createElement('div');
    regionList.className = 'region-list';

    Object.entries(page.regions).forEach(([key, region]) => {
        const group = document.createElement('div');
        group.className = 'region-group';
        const label = document.createElement('label');
        label.textContent = region.label;
        const hint = document.createElement('small');
        hint.textContent = region.type === 'html' ? 'HTML allowed' : 'Plain text';
        label.appendChild(hint);

        const field = region.type === 'text' && String(region.value).length < 120
            ? document.createElement('input')
            : document.createElement('textarea');
        field.name = key;
        field.value = region.value;
        if (field.tagName === 'TEXTAREA') {
            field.rows = Math.max(3, Math.min(10, String(region.value).split('\n').length + 1));
        }

        label.appendChild(field);
        group.appendChild(label);
        regionList.appendChild(group);
    });

    const actions = document.createElement('div');
    actions.className = 'editor-actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.textContent = `Save ${page.label}`;
    actions.appendChild(saveButton);
    pageEditor.appendChild(regionList);
    pageEditor.appendChild(actions);
}

function renderCustomPages() {
    customPageList.innerHTML = '';

    if (!state.customPages.length) {
        customPageList.innerHTML = '<p class="panel-copy">No custom pages created yet.</p>';
        return;
    }

    state.customPages.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-page-item';
        wrapper.innerHTML = `
            <h3>${escapeHtml(item.title)}</h3>
            <p class="panel-copy">page.html?slug=${escapeHtml(item.slug)}</p>
            <div class="custom-page-meta">
                <a href="../page.html?slug=${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">Preview</a>
                <button type="button" class="button-secondary">Edit</button>
                <button type="button" class="button-secondary">Delete</button>
            </div>
        `;

        const [, editButton, deleteButton] = wrapper.querySelectorAll('a, button');

        editButton.addEventListener('click', () => {
            customPageForm.elements.id.value = item.id;
            customPageForm.elements.title.value = item.title;
            customPageForm.elements.slug.value = item.slug;
            customPageForm.elements.heroTitle.value = item.hero_title || '';
            customPageForm.elements.heroBody.value = item.hero_body || '';
            customPageForm.elements.excerpt.value = item.excerpt || '';
            customPageForm.elements.contentHtml.value = item.content_html || '';
            customPageForm.elements.published.checked = item.published !== false;
            customStatus.textContent = `Editing ${item.title}`;
        });

        deleteButton.addEventListener('click', async () => {
            if (!window.confirm(`Delete ${item.title}?`)) {
                return;
            }

            const client = await ensureClient();
            const { error } = await client.from('custom_pages').delete().eq('id', item.id);
            if (error) {
                customStatus.textContent = error.message;
                return;
            }

            customStatus.textContent = 'Custom page deleted.';
            await loadDashboardData();
        });

        customPageList.appendChild(wrapper);
    });
}

async function loadDashboardData() {
    const client = await ensureClient();
    await maybeSeedContent();

    const pageResult = await client.from('page_content').select('*').order('page_id');
    if (pageResult.error) {
        throw pageResult.error;
    }

    const customResult = await client.from('custom_pages').select('*').order('updated_at', { ascending: false });
    if (customResult.error) {
        throw customResult.error;
    }

    state.content = {
        pages: Object.fromEntries((pageResult.data || []).map(item => [item.page_id, {
            label: item.label,
            regions: item.regions || {}
        }]))
    };
    state.customPages = customResult.data || [];
    state.activePageId = state.activePageId || Object.keys(state.content.pages)[0];
    renderPageNav();
    renderPageEditor();
    renderCustomPages();
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginStatus.textContent = 'Signing in...';

    try {
        const client = await ensureClient();
        const formData = new FormData(loginForm);
        const payload = Object.fromEntries(formData.entries());
        const { data, error } = await client.auth.signInWithPassword({ email: payload.email, password: payload.password });
        if (error) {
            throw error;
        }

        state.user = data.user.email;
        signedInAs.textContent = data.user.email;
        loginStatus.textContent = '';
        showDashboard();
        await loadDashboardData();
    } catch (error) {
        loginStatus.textContent = error.message;
    }
});

pageEditor.addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.activePageId) {
        return;
    }

    saveStatus.textContent = 'Saving...';
    const client = await ensureClient();
    const formData = new FormData(pageEditor);
    const page = state.content.pages[state.activePageId];
    const nextRegions = JSON.parse(JSON.stringify(page.regions));
    Object.entries(Object.fromEntries(formData.entries())).forEach(([key, value]) => {
        if (nextRegions[key]) {
            nextRegions[key].value = value;
        }
    });

    const { error } = await client.from('page_content').upsert({
        page_id: state.activePageId,
        label: page.label,
        regions: nextRegions
    }, { onConflict: 'page_id' });

    if (error) {
        saveStatus.textContent = error.message;
        return;
    }

    saveStatus.textContent = 'Saved.';
    await loadDashboardData();
}

customPageForm.addEventListener('submit', async event => {
    event.preventDefault();
    const client = await ensureClient();
    const formData = new FormData(customPageForm);
    const payload = Object.fromEntries(formData.entries());
    const id = payload.id;
    delete payload.id;
    payload.published = customPageForm.elements.published.checked;
    payload.hero_title = payload.heroTitle || '';
    payload.hero_body = payload.heroBody || '';
    payload.content_html = payload.contentHtml || '';
    delete payload.heroTitle;
    delete payload.heroBody;
    delete payload.contentHtml;

    customStatus.textContent = 'Saving custom page...';

    const query = client.from('custom_pages');
    const result = id
        ? await query.update(payload).eq('id', id)
        : await query.insert(payload);

    if (result.error) {
        customStatus.textContent = result.error.message;
        return;
    }

    customStatus.textContent = id ? 'Custom page updated.' : 'Custom page created.';
    customPageForm.reset();
    customPageForm.elements.id.value = '';
    customPageForm.elements.published.checked = true;
    await loadDashboardData();
});

customReset.addEventListener('click', () => {
    customPageForm.reset();
    customPageForm.elements.id.value = '';
    customPageForm.elements.published.checked = true;
    customStatus.textContent = 'Form cleared.';
});

logoutButton.addEventListener('click', async () => {
    const client = await ensureClient();
    await client.auth.signOut();
    state.user = null;
    showLogin();
    loginForm.reset();
});

async function boot() {
    try {
        const client = await ensureClient();
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) {
            showLogin();
            if (!getConfig() || !getConfig().supabaseUrl) {
                loginStatus.textContent = 'Add js/cms-config.js before using the admin dashboard.';
            }
            return;
        }

        state.user = data.user.email;
        signedInAs.textContent = data.user.email;
        showDashboard();
        await loadDashboardData();
    } catch (error) {
        showLogin();
        loginStatus.textContent = error.message;
    }
}

boot();
