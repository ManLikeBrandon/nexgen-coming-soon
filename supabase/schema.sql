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

alter table public.page_content enable row level security;
alter table public.custom_pages enable row level security;

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
