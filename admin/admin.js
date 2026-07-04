const state = {
    activePageId: null,
    content: null,
    customPages: [],
    user: null
};

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

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
    }

    return data;
}

function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
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
            <p class="panel-copy">/${escapeHtml(item.slug)}</p>
            <div class="custom-page-meta">
                <a href="/pages/${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">Preview</a>
                <button type="button" class="button-secondary">Edit</button>
                <button type="button" class="button-secondary">Delete</button>
            </div>
        `;

        const [previewLink, editButton, deleteButton] = wrapper.querySelectorAll('a, button');
        void previewLink;

        editButton.addEventListener('click', () => {
            customPageForm.elements.id.value = item.id;
            customPageForm.elements.title.value = item.title;
            customPageForm.elements.slug.value = item.slug;
            customPageForm.elements.heroTitle.value = item.heroTitle || '';
            customPageForm.elements.heroBody.value = item.heroBody || '';
            customPageForm.elements.excerpt.value = item.excerpt || '';
            customPageForm.elements.contentHtml.value = item.contentHtml || '';
            customPageForm.elements.published.checked = item.published !== false;
            customStatus.textContent = `Editing ${item.title}`;
        });

        deleteButton.addEventListener('click', async () => {
            if (!window.confirm(`Delete ${item.title}?`)) {
                return;
            }

            try {
                await api(`/api/admin/custom-pages/${item.id}`, { method: 'DELETE' });
                customStatus.textContent = 'Custom page deleted.';
                await loadDashboardData();
            } catch (error) {
                customStatus.textContent = error.message;
            }
        });

        customPageList.appendChild(wrapper);
    });
}

async function loadDashboardData() {
    const contentData = await api('/api/admin/content');
    const customPageData = await api('/api/admin/custom-pages');
    state.content = contentData;
    state.customPages = customPageData.items || [];
    state.activePageId = state.activePageId || Object.keys(state.content.pages)[0];
    renderPageNav();
    renderPageEditor();
    renderCustomPages();
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginStatus.textContent = 'Signing in...';

    try {
        const formData = new FormData(loginForm);
        const payload = Object.fromEntries(formData.entries());
        const response = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        state.user = response.email;
        signedInAs.textContent = response.email;
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

    const formData = new FormData(pageEditor);
    const regions = Object.fromEntries(formData.entries());
    saveStatus.textContent = 'Saving...';

    try {
        await api(`/api/admin/content/${state.activePageId}`, {
            method: 'PUT',
            body: JSON.stringify({ regions })
        });

        saveStatus.textContent = 'Saved.';
        await loadDashboardData();
    } catch (error) {
        saveStatus.textContent = error.message;
    }
});

customPageForm.addEventListener('submit', async event => {
    event.preventDefault();

    const formData = new FormData(customPageForm);
    const payload = Object.fromEntries(formData.entries());
    payload.published = customPageForm.elements.published.checked;
    const id = payload.id;
    delete payload.id;
    customStatus.textContent = 'Saving custom page...';

    try {
        const path = id ? `/api/admin/custom-pages/${id}` : '/api/admin/custom-pages';
        const method = id ? 'PUT' : 'POST';
        await api(path, {
            method,
            body: JSON.stringify(payload)
        });

        customStatus.textContent = id ? 'Custom page updated.' : 'Custom page created.';
        customPageForm.reset();
        customPageForm.elements.id.value = '';
        customPageForm.elements.published.checked = true;
        await loadDashboardData();
    } catch (error) {
        customStatus.textContent = error.message;
    }
});

customReset.addEventListener('click', () => {
    customPageForm.reset();
    customPageForm.elements.id.value = '';
    customPageForm.elements.published.checked = true;
    customStatus.textContent = 'Form cleared.';
});

logoutButton.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' });
    state.user = null;
    showLogin();
    loginForm.reset();
});

async function boot() {
    try {
        const response = await api('/api/me', { method: 'GET' });
        if (!response.authenticated) {
            showLogin();
            return;
        }

        state.user = response.email;
        signedInAs.textContent = response.email;
        showDashboard();
        await loadDashboardData();
    } catch (error) {
        showLogin();
    }
}

boot();
