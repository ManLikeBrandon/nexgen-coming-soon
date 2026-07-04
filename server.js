const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PORT = parseInt(process.env.PORT || '3000', 10);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp'
};

const sessions = new Map();

function ensureRuntimeFiles() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(CONTENT_FILE)) {
        throw new Error('Missing data/content.json seed file.');
    }

    if (!fs.existsSync(USERS_FILE)) {
        const email = process.env.ADMIN_EMAIL || 'admin@nexgenleaders.org';
        const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
        const defaultUser = {
            id: crypto.randomUUID(),
            email,
            passwordHash: hashPassword(password),
            role: 'admin',
            createdAt: new Date().toISOString()
        };

        writeJson(USERS_FILE, { users: [defaultUser] });
        console.log(`Created default admin login for ${email}. Change the password after first login.`);
    }
}

function readJson(filePath, fallback = {}) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${derived}`;
}

function verifyPassword(password, passwordHash) {
    const [salt, expected] = passwordHash.split(':');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(derived, 'hex'));
}

function parseCookies(cookieHeader = '') {
    return cookieHeader.split(';').reduce((accumulator, pair) => {
        const trimmed = pair.trim();
        if (!trimmed) {
            return accumulator;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) {
            return accumulator;
        }

        const key = decodeURIComponent(trimmed.slice(0, separatorIndex));
        const value = decodeURIComponent(trimmed.slice(separatorIndex + 1));
        accumulator[key] = value;
        return accumulator;
    }, {});
}

function setCookie(res, name, value, maxAgeSeconds) {
    res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
}

function clearCookie(res, name) {
    res.setHeader('Set-Cookie', `${name}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function createSession(user) {
    const token = crypto.randomUUID();
    sessions.set(token, {
        userId: user.id,
        email: user.email,
        expiresAt: Date.now() + SESSION_TTL_MS
    });
    return token;
}

function getSession(req) {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.sid;
    if (!token) {
        return null;
    }

    const session = sessions.get(token);
    if (!session) {
        return null;
    }

    if (session.expiresAt < Date.now()) {
        sessions.delete(token);
        return null;
    }

    return { token, ...session };
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => {
            raw += chunk.toString('utf8');
            if (raw.length > 1_000_000) {
                reject(new Error('Request body too large.'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }

            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
                try {
                    resolve(JSON.parse(raw));
                } catch (error) {
                    reject(new Error('Invalid JSON payload.'));
                }
                return;
            }

            if (contentType.includes('application/x-www-form-urlencoded')) {
                resolve(Object.fromEntries(new URLSearchParams(raw).entries()));
                return;
            }

            resolve({ raw });
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
    res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function slugify(value = '') {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function navHtml() {
    return `
<nav class="nav" id="main-nav">
    <a class="nav-brand" href="/main.html">
        <img src="/Nexgen%20(1).png" alt="NexGen Leaders Foundation">
    </a>
    <ul class="nav-links" id="nav-links">
        <li><a href="/main.html">Home</a></li>
        <li><a href="/about.html">About</a></li>
        <li><a href="/programs.html">Programs</a></li>
        <li><a href="/team.html">Our Team</a></li>
        <li><a href="/get-involved.html">Get Involved</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/donate.html" class="nav-cta">Donate</a></li>
    </ul>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
    </button>
</nav>`;
}

function footerHtml() {
    return `
<footer class="footer">
    <div class="footer-inner">
        <div class="footer-grid">
            <div class="footer-brand">
                <img src="/Nexgen%20(1).png" alt="NexGen Leaders Foundation" class="footer-brand-logo">
                <p>Developing the next generation of leaders through structured programs, mentorship, and community — since 2026.</p>
                <div class="footer-slogan">Rise. Lead. Succeed.</div>
            </div>
            <div class="footer-col">
                <h4>Organisation</h4>
                <ul>
                    <li><a href="/about.html">About Us</a></li>
                    <li><a href="/team.html">Our Team</a></li>
                    <li><a href="/programs.html">Programs</a></li>
                    <li><a href="/contact.html">Contact</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Get Involved</h4>
                <ul>
                    <li><a href="/get-involved.html">Apply to a Program</a></li>
                    <li><a href="/get-involved.html">Become a Mentor</a></li>
                    <li><a href="/get-involved.html">Volunteer</a></li>
                    <li><a href="/get-involved.html">Partner With Us</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Support</h4>
                <ul>
                    <li><a href="/donate.html">Donate</a></li>
                    <li><a href="/donate.html">Corporate Giving</a></li>
                    <li><a href="/donate.html">Sponsorship</a></li>
                    <li><a href="/contact.html">Press &amp; Media</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 The NexGen Leaders Foundation. Registered Non-Profit Organisation.</p>
            <div class="footer-bottom-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Use</a>
                <a href="#">NPO Registration</a>
            </div>
        </div>
    </div>
</footer>`;
}

function layoutScriptHtml() {
    return `
<script>
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', () => links.classList.toggle('open'));
        document.querySelectorAll('.nav-links a').forEach(anchor => {
            anchor.addEventListener('click', () => links.classList.remove('open'));
        });
    }
</script>`;
}

function renderCustomPage(page) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(page.title)} | The NexGen Leaders Foundation</title>
    <meta name="description" content="${escapeHtml(page.excerpt || page.title)}">
    <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&family=Permanent+Marker&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
${navHtml()}
<div class="page-hero">
    <div class="page-hero-inner">
        <div class="breadcrumb">
            <a href="/main.html">Home</a> &nbsp;/&nbsp; <span>${escapeHtml(page.title)}</span>
        </div>
        <span class="eyebrow">Custom Page</span>
        <h1>${page.heroTitle || escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.heroBody || page.excerpt || '')}</p>
    </div>
</div>
<section class="section">
    <div class="section-inner">
        <div class="prose">${page.contentHtml || ''}</div>
    </div>
</section>
${footerHtml()}
${layoutScriptHtml()}
</body>
</html>`;
}

function requireAuth(req, res) {
    const session = getSession(req);
    if (!session) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return null;
    }
    return session;
}

function sanitizeCustomPage(input, existing = {}) {
    const title = String(input.title || existing.title || '').trim();
    const slug = slugify(input.slug || title || existing.slug || 'page');
    return {
        id: existing.id || crypto.randomUUID(),
        title,
        slug,
        heroTitle: String(input.heroTitle || existing.heroTitle || title).trim(),
        heroBody: String(input.heroBody || existing.heroBody || '').trim(),
        excerpt: String(input.excerpt || existing.excerpt || '').trim(),
        contentHtml: String(input.contentHtml || existing.contentHtml || '').trim(),
        published: input.published === undefined ? (existing.published ?? true) : Boolean(input.published),
        updatedAt: new Date().toISOString()
    };
}

async function handleApi(req, res, pathname) {
    const content = readJson(CONTENT_FILE, { pages: {}, customPages: [] });
    const users = readJson(USERS_FILE, { users: [] });

    if (req.method === 'POST' && pathname === '/api/login') {
        const body = await parseBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const user = users.users.find(entry => entry.email.toLowerCase() === email);

        if (!user || !verifyPassword(password, user.passwordHash)) {
            sendJson(res, 401, { error: 'Invalid email or password.' });
            return;
        }

        const token = createSession(user);
        setCookie(res, 'sid', token, SESSION_TTL_MS / 1000);
        sendJson(res, 200, { ok: true, email: user.email });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
        const session = getSession(req);
        if (session) {
            sessions.delete(session.token);
        }
        clearCookie(res, 'sid');
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/me') {
        const session = getSession(req);
        sendJson(res, 200, session ? { authenticated: true, email: session.email } : { authenticated: false });
        return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/content/')) {
        const pageId = pathname.split('/').pop();
        const page = content.pages[pageId];
        if (!page) {
            sendJson(res, 404, { error: 'Page content not found.' });
            return;
        }
        sendJson(res, 200, page);
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/content') {
        if (!requireAuth(req, res)) {
            return;
        }
        sendJson(res, 200, content);
        return;
    }

    if (req.method === 'PUT' && pathname.startsWith('/api/admin/content/')) {
        if (!requireAuth(req, res)) {
            return;
        }

        const pageId = pathname.split('/').pop();
        const page = content.pages[pageId];
        if (!page) {
            sendJson(res, 404, { error: 'Page not found.' });
            return;
        }

        const body = await parseBody(req);
        const nextRegions = body.regions || {};

        Object.keys(page.regions).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(nextRegions, key)) {
                page.regions[key].value = String(nextRegions[key]);
            }
        });

        writeJson(CONTENT_FILE, content);
        sendJson(res, 200, { ok: true, page: content.pages[pageId] });
        return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/custom-pages') {
        if (!requireAuth(req, res)) {
            return;
        }
        sendJson(res, 200, { items: content.customPages || [] });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/custom-pages') {
        if (!requireAuth(req, res)) {
            return;
        }

        const body = await parseBody(req);
        const page = sanitizeCustomPage(body);
        content.customPages = content.customPages || [];
        content.customPages.push(page);
        writeJson(CONTENT_FILE, content);
        sendJson(res, 201, { ok: true, item: page });
        return;
    }

    if ((req.method === 'PUT' || req.method === 'DELETE') && pathname.startsWith('/api/admin/custom-pages/')) {
        if (!requireAuth(req, res)) {
            return;
        }

        const id = pathname.split('/').pop();
        const index = (content.customPages || []).findIndex(entry => entry.id === id);
        if (index === -1) {
            sendJson(res, 404, { error: 'Custom page not found.' });
            return;
        }

        if (req.method === 'DELETE') {
            content.customPages.splice(index, 1);
            writeJson(CONTENT_FILE, content);
            sendJson(res, 200, { ok: true });
            return;
        }

        const body = await parseBody(req);
        const updated = sanitizeCustomPage(body, content.customPages[index]);
        const duplicate = content.customPages.find(entry => entry.slug === updated.slug && entry.id !== updated.id);
        if (duplicate) {
            sendJson(res, 409, { error: 'A page with that slug already exists.' });
            return;
        }

        content.customPages[index] = updated;
        writeJson(CONTENT_FILE, content);
        sendJson(res, 200, { ok: true, item: updated });
        return;
    }

    sendJson(res, 404, { error: 'API route not found.' });
}

function serveStatic(pathname, res) {
    const safePath = pathname === '/' ? '/index.html' : pathname;

    if (safePath.startsWith('/data/')) {
        return false;
    }

    const filePath = path.join(ROOT, safePath.replace(/^\/+/, ''));
    if (!filePath.startsWith(ROOT)) {
        return false;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return false;
    }

    sendFile(res, filePath);
    return true;
}

async function requestHandler(req, res) {
    try {
        const parsed = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
        const pathname = decodeURIComponent(parsed.pathname);

        if (pathname.startsWith('/api/')) {
            await handleApi(req, res, pathname);
            return;
        }

        if (pathname === '/admin' || pathname === '/admin/') {
            sendFile(res, path.join(ROOT, 'admin', 'index.html'));
            return;
        }

        if (pathname.startsWith('/pages/')) {
            const slug = pathname.split('/').pop();
            const content = readJson(CONTENT_FILE, { customPages: [] });
            const page = (content.customPages || []).find(entry => entry.slug === slug && entry.published !== false);

            if (!page) {
                sendHtml(res, 404, '<h1>Page not found.</h1>');
                return;
            }

            sendHtml(res, 200, renderCustomPage(page));
            return;
        }

        if (serveStatic(pathname, res)) {
            return;
        }

        sendHtml(res, 404, '<h1>Not found.</h1>');
    } catch (error) {
        sendJson(res, 500, { error: error.message || 'Internal server error.' });
    }
}

ensureRuntimeFiles();

http.createServer(requestHandler).listen(PORT, () => {
    console.log(`NexGen Leaders server running on http://localhost:${PORT}`);
    console.log('Admin dashboard: /admin');
});