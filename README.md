# nexgen-coming-soon

## Phase 1 CMS

This project now uses a static-site-friendly CMS approach:

- Public pages remain plain HTML
- Admin login is handled by Supabase Auth
- Editable page content is stored in Supabase tables
- Custom pages can be created from the admin dashboard

No local Node server is required to run the site.

## Setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `js/cms-config.example.js` to `js/cms-config.js`.
4. Add your Supabase project URL and anon key.
5. Open `admin/index.html` through your static host or local static preview.

## Login

Admin login is now managed by Supabase Auth.

- Create admin users in the Supabase dashboard.
- Use email/password sign-in from the admin page.

## Editable Content

The admin dashboard edits seeded content regions for:

- Home
- About
- Programs
- Team
- Get Involved
- Contact
- Donate

The default region structure is stored in `data/content.json` and can be used to seed the database.

## Custom Pages

Custom pages are created in the admin dashboard and rendered through:

```text
page.html?slug=your-slug
```

This route format works cleanly on static hosting platforms, including GitHub Pages.

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

## PayFast Payments (Secure)

The donation checkout is now connected to a secure server-side flow:

- Frontend: `donate.html` + `js/payfast-checkout.js`
- Init endpoint: `supabase/functions/payfast-init/index.ts`
- ITN endpoint: `supabase/functions/payfast-itn/index.ts`
- Storage table: `public.donations` (added in `supabase/schema.sql`)

### Why this is secure

- PayFast merchant credentials are only used in backend environment variables.
- The browser never receives the passphrase or service role key.
- Payment status is finalized from PayFast ITN verification, not browser redirects.

### Required environment variables

Configure these in your Supabase Edge Functions environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE` (`sandbox` or `live`)
- `SITE_BASE_URL` (e.g. `https://nexgenleaders.org`)
- `PAYFAST_ITN_URL` (optional override; defaults to `${SITE_BASE_URL}/functions/v1/payfast-itn`)

### Frontend endpoint config

Set `js/payfast-config.js`:

```js
window.NEXGEN_PAYFAST = {
	initEndpoint: "https://<project-ref>.functions.supabase.co/payfast-init"
};
```

### Deploy checklist

1. Run updated SQL in `supabase/schema.sql`.
2. Deploy `payfast-init` and `payfast-itn` functions.
3. Configure all environment variables above.
4. Set `js/payfast-config.js` with your deployed init endpoint.
5. Test sandbox flow end-to-end before switching to `PAYFAST_MODE=live`.