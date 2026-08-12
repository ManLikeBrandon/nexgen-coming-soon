# nexgen-coming-soon

## Brand (colours & fonts)

**Colours** are defined once as CSS variables in `css/styles.css` (`:root`) and
reused everywhere via `var(--…)`:

- Yellow: `#f9de2b` (`--yellow`)
- Black: `#1a1715` (`--black`, a warm near-black)

`admin/admin.css` and `coming-soon.html` carry their own copies of these values.

**Fonts:** the site is designed for **Acumin Pro** — **Bold (700)** for headings,
**Light (300)** for body copy. Acumin Pro is an Adobe Fonts (Typekit) typeface and
is **not free**, so it must be loaded from your own Adobe Fonts account. Until you
add it, the site automatically falls back to **Source Sans 3** (a close, free
cousin of Acumin), which is already loaded from Google Fonts — so the site looks
right immediately.

### Enabling Acumin Pro

1. Sign in at <https://fonts.adobe.com> (included with Adobe Creative Cloud).
2. Create a **Web Project**, add **Acumin Pro** with the **Light (300)** and
   **Bold (700)** weights, and note the two-line embed code Adobe gives you.
3. In every HTML file, find the comment that reads
   `<!-- Brand type: Acumin Pro (Adobe Fonts). Paste your Adobe Fonts kit <link> below… -->`
   and paste your kit's `<link rel="stylesheet" href="https://use.typekit.net/XXimport.css">`
   line directly beneath it.
4. That's it — the CSS already lists `acumin-pro` first in the font stack, so it
   takes over from the Source Sans 3 fallback the moment the kit loads.

The font is referenced as `acumin-pro` in `--font-heading` / `--font-body`; don't
rename it, as that is the family name Adobe serves.

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

## PayFast Payments

### How the payment flow works

Money never touches this website. The donor's card details are only ever entered on
PayFast's own checkout page. Here is the full journey:

1. The donor fills in the form on `donate.html`.
2. The browser sends the donation details to the **`payfast-init`** function.
3. `payfast-init` saves the donation in the database with the status `initiated`,
   then signs the payment using your PayFast credentials and sends the signed
   fields back to the browser.
4. The browser auto-submits those fields to PayFast, and the donor is redirected
   to PayFast's secure checkout page to pay.
5. After paying, the donor is sent back to `/donate?status=success`.
6. **Separately and invisibly**, PayFast's servers call the **`payfast-itn`**
   function to confirm the payment. This is called the ITN (Instant Transaction
   Notification), and it is the *only* thing that marks a donation as `complete`.

Step 6 is the important one. The redirect in step 5 comes from the donor's own
browser and can be faked, so it is only used to show a friendly thank-you message.
The database is only updated from the ITN, which is verified five different ways.

### The pieces

| File | What it does |
| --- | --- |
| `donate.html` | The donation form |
| `js/payfast-checkout.js` | Sends the form to the server, redirects to PayFast |
| `js/payfast-config.js` | Holds the public URL of your `payfast-init` function |
| `supabase/functions/_shared/payfast.ts` | Signing and verification logic shared by both functions |
| `supabase/functions/payfast-init/index.ts` | Starts a payment (signs it) |
| `supabase/functions/payfast-itn/index.ts` | Receives and verifies PayFast's confirmation |
| `supabase/config.toml` | Makes both functions publicly reachable |
| `supabase/schema.sql` | The `donations` and `donation_payments` tables |

### Why this is secure

- Your PayFast merchant key and passphrase live only in server environment
  variables. They are never sent to the browser.
- The donation amount is stored server-side before the donor leaves the site, and
  the ITN is rejected if the amount PayFast reports does not match it. A donor
  cannot edit the price in their browser.
- Every incoming ITN must pass five checks: a valid signature (proves the sender
  knows your passphrase), a matching merchant ID, a source IP belonging to
  PayFast, a confirmation callback to PayFast asking "did you really send this?",
  and an amount match.
- Nobody can write to the `donations` table from the browser. Row Level Security
  allows only reads by logged-in admins; the functions write using the service
  role key.

---

## Setting it up (step by step)

### Step 1 — Create the database tables

In Supabase, open **SQL Editor**, paste the entire contents of
`supabase/schema.sql`, and run it. It is safe to run more than once.

### Step 2 — Get your PayFast credentials

Log in to PayFast, then go to **Settings → Integration**. You need three values:

- **Merchant ID**
- **Merchant Key**
- **Passphrase** — if this box is empty, set one now and save. It is what makes
  the signature verification meaningful, so do not leave it blank.

For testing, use PayFast's sandbox (<https://sandbox.payfast.co.za>) instead. The
standard sandbox test credentials are Merchant ID `10000100` and Merchant Key
`46f0cd694581a`. Set the sandbox passphrase in the sandbox dashboard and use that
same value in Step 4.

### Step 3 — Install the Supabase CLI and link the project

```bash
npm install -g supabase
supabase login
supabase link --project-ref <project-ref>
```

Your `<project-ref>` is in Supabase under **Project Settings → General →
Reference ID**. It looks like `abcdefghijklmnop`.

### Step 4 — Set the secrets

Run this once, filling in your own values. These are stored securely by Supabase
and are only visible to your functions:

```bash
supabase secrets set \
  PAYFAST_MERCHANT_ID=10000100 \
  PAYFAST_MERCHANT_KEY=46f0cd694581a \
  PAYFAST_PASSPHRASE=your-passphrase-here \
  PAYFAST_MODE=sandbox \
  SITE_BASE_URL=https://nexgenleaders.org \
  ALLOWED_ORIGINS=https://nexgenleaders.org
```

You do **not** need to set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` —
Supabase provides those to your functions automatically.

| Secret | Required | What it is |
| --- | --- | --- |
| `PAYFAST_MERCHANT_ID` | Yes | From PayFast → Settings → Integration |
| `PAYFAST_MERCHANT_KEY` | Yes | From PayFast → Settings → Integration |
| `PAYFAST_PASSPHRASE` | Yes | From PayFast → Settings → Integration |
| `PAYFAST_MODE` | Yes | `sandbox` while testing, `live` when taking real money |
| `SITE_BASE_URL` | Yes | Your site, no trailing slash. Used for the return links |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated sites allowed to call the function. If left unset, any site can call it |
| `PAYFAST_MIN_AMOUNT` | No | Smallest donation allowed. Defaults to `5` (PayFast's own minimum) |
| `PAYFAST_MAX_AMOUNT` | No | Largest donation allowed. Defaults to `100000` |
| `PAYFAST_NOTIFY_URL` | No | Override for the ITN URL. Only needed if you host the ITN elsewhere |

### Step 5 — Deploy the two functions

```bash
supabase functions deploy payfast-init
supabase functions deploy payfast-itn
```

`supabase/config.toml` already sets `verify_jwt = false` for both. This matters:
Supabase functions normally demand a login token, and PayFast's servers cannot
send one. Without this setting every payment confirmation would be rejected before
your code even ran.

> If you deploy from the Supabase dashboard instead of the CLI, you must turn off
> "Verify JWT" for both functions manually in the function's settings.

### Step 6 — Point the website at your function

Edit `js/payfast-config.js` and replace `<project-ref>` with your real project
reference:

```js
window.NEXGEN_PAYFAST = {
    initEndpoint: "https://abcdefghijklmnop.supabase.co/functions/v1/payfast-init"
};
```

Commit and push this file. It is meant to be public — it contains no secrets.

### Step 7 — Test in the sandbox

With `PAYFAST_MODE=sandbox`, open the donate page and make a test donation. Use
PayFast's sandbox test card details, which are shown on the sandbox checkout page.

Then confirm it worked:

```sql
select payment_id, donor_email, amount, payment_status, created_at
from donations
order by created_at desc
limit 5;
```

The status should read `complete`. If it still says `initiated`, PayFast could not
reach your ITN endpoint — check the `payfast-itn` logs in the Supabase dashboard
under **Edge Functions → payfast-itn → Logs**.

### Step 8 — Go live

1. Swap in your real PayFast credentials and set `PAYFAST_MODE=live`:
   ```bash
   supabase secrets set PAYFAST_MERCHANT_ID=... PAYFAST_MERCHANT_KEY=... \
     PAYFAST_PASSPHRASE=... PAYFAST_MODE=live
   ```
2. Redeploy both functions so they pick up the new values.
3. Make one small real donation (R5) to yourself and confirm it lands in the
   database as `complete` and appears in your PayFast dashboard.

---

### Monthly (recurring) donations

If a donor picks "Monthly Donation", PayFast sets up a recurring subscription that
charges the same amount every month until it is cancelled.

- Each monthly charge sends a new ITN, and each one is stored as its own row in
  `donation_payments`, all linked back to the single original `donations` row.
- The subscription token is saved to `donations.payfast_token`. You need it to
  cancel or pause the subscription later.
- **Recurring billing must be enabled on your PayFast account** — check under
  **Settings → Recurring Billing**. If it is not enabled, monthly donations will
  fail while one-time donations keep working.

### Checking on donations

- `donations` — one row per donation attempt (who, how much, current status).
- `donation_payments` — one row per charge PayFast actually confirmed, including
  PayFast's fee and the net amount you received, plus the raw notification for
  your records.

```sql
select d.donor_email, d.amount, d.donation_intent,
       p.amount_net, p.payment_status, p.created_at
from donation_payments p
join donations d on d.id = p.donation_id
order by p.created_at desc;
```

### Troubleshooting

| What you see | What it usually means |
| --- | --- |
| PayFast shows "signature mismatch" | The `PAYFAST_PASSPHRASE` secret does not exactly match the one in your PayFast dashboard. Re-set it and redeploy |
| Donation stays on `initiated` forever | PayFast cannot reach your ITN endpoint. Check the `payfast-itn` logs; the usual cause is "Verify JWT" still being on |
| Browser console shows a CORS error | `ALLOWED_ORIGINS` does not include the exact site you are browsing from, including `https://` |
| "Payment gateway is not configured" | A required secret is missing. Run `supabase secrets list` to see which |
| Monthly donations fail, one-time ones work | Recurring Billing is not enabled on your PayFast account |