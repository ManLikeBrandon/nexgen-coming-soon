# nexgen-coming-soon

## Phase 1 Backend

This project now includes a lightweight Node backend with:

- Admin login with cookie-based sessions
- Editable page regions for the main public pages
- A custom page builder for new pages served at `/pages/:slug`
- Static site serving from the same backend

## Run Locally

1. Install Node.js 18+ if it is not already available.
2. Optionally create a local `.env` file using `.env.example`.
3. Start the server:

```bash
npm start
```

4. Open the site at `http://localhost:3000`
5. Open the admin dashboard at `http://localhost:3000/admin`

## Default Admin Login

If `data/users.json` does not exist, the server creates a default admin user on first run using:

- `ADMIN_EMAIL` from environment, or `admin@nexgenleaders.org`
- `ADMIN_PASSWORD` from environment, or `ChangeMe123!`

Change these immediately for any real deployment.

## Editable Content

The admin dashboard can currently edit seeded content regions for:

- Home
- About
- Programs
- Team
- Get Involved
- Contact
- Donate

## Custom Pages

The custom page builder in `/admin` lets you create new pages with:

- Title
- Slug
- Hero heading
- Hero summary
- Body HTML
- Publish/unpublish control

Published pages are available at:

```text
/pages/your-slug
```