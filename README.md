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