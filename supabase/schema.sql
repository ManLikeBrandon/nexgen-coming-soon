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
    payment_status text not null default 'initiated' check (payment_status in ('initiated', 'complete', 'failed', 'cancelled')),
    gateway text not null default 'payfast',
    gateway_payment_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.page_content enable row level security;
alter table public.custom_pages enable row level security;
alter table public.applications enable row level security;
alter table public.donations enable row level security;

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

drop policy if exists "Authenticated can review donations" on public.donations;
create policy "Authenticated can review donations"
on public.donations for select
to authenticated
using (true);
