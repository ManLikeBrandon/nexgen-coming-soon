create extension if not exists pgcrypto;

create table if not exists public.page_content (
    page_id text primary key,
    label text not null,
    regions jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create table if not exists public.custom_pages (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    slug text not null unique,
    hero_title text,
    hero_body text,
    excerpt text,
    content_html text,
    published boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
    submission_type text not null check (submission_type in ('program', 'mentor')),
    first_name text not null,
    last_name text not null,
    email text not null,
    age integer,
    city text,
    program text,
    profession text,
    experience text,
    motivation text not null,
    heard text,
    source_page text,
    created_at timestamptz not null default now()
);

create table if not exists public.donations (
    id uuid primary key default gen_random_uuid(),
    payment_id text not null unique,
    donor_first_name text not null,
    donor_last_name text not null,
    donor_email text not null,
    amount numeric(10,2) not null check (amount > 0),
    currency text not null default 'ZAR',
    donation_intent text,
    donor_message text,
    payment_status text not null default 'initiated',
    gateway text not null default 'payfast',
    gateway_payment_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 0 = once-off payment, 1 = PayFast recurring subscription.
alter table public.donations add column if not exists subscription_type smallint not null default 0;

-- PayFast subscription token, needed to pause or cancel a monthly donation.
alter table public.donations add column if not exists payfast_token text;

alter table public.donations drop constraint if exists donations_payment_status_check;
alter table public.donations add constraint donations_payment_status_check
    check (payment_status in ('initiated', 'pending', 'complete', 'failed', 'cancelled'));

-- One row per actual charge confirmed by PayFast. A monthly donation produces a
-- new row every month while pointing at the same donations record.
create table if not exists public.donation_payments (
    id uuid primary key default gen_random_uuid(),
    donation_id uuid not null references public.donations(id) on delete cascade,
    pf_payment_id text not null unique,
    payment_status text not null,
    amount_gross numeric(10,2),
    amount_fee numeric(10,2),
    amount_net numeric(10,2),
    raw_payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists donation_payments_donation_id_idx on public.donation_payments (donation_id);
create index if not exists donations_created_at_idx on public.donations (created_at desc);

alter table public.page_content enable row level security;
alter table public.custom_pages enable row level security;
alter table public.applications enable row level security;
alter table public.donations enable row level security;
alter table public.donation_payments enable row level security;

drop policy if exists "Public can read page content" on public.page_content;
create policy "Public can read page content"
on public.page_content for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated can manage page content" on public.page_content;
create policy "Authenticated can manage page content"
on public.page_content for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read published custom pages" on public.custom_pages;
create policy "Public can read published custom pages"
on public.custom_pages for select
to anon, authenticated
using (published = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated can manage custom pages" on public.custom_pages;
create policy "Authenticated can manage custom pages"
on public.custom_pages for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can submit applications" on public.applications;
create policy "Public can submit applications"
on public.applications for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated can review applications" on public.applications;
create policy "Authenticated can review applications"
on public.applications for select
to authenticated
using (true);

-- No anon or authenticated write policies exist for donations or donation_payments.
-- Only the edge functions write to them, using the service role key, which
-- bypasses RLS. The public can never insert or alter a donation record.
drop policy if exists "Authenticated can review donations" on public.donations;
create policy "Authenticated can review donations"
on public.donations for select
to authenticated
using (true);

drop policy if exists "Authenticated can review donation payments" on public.donation_payments;
create policy "Authenticated can review donation payments"
on public.donation_payments for select
to authenticated
using (true);
