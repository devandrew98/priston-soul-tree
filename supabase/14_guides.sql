-- Fase 16 — Guias (vídeos do YouTube por categoria). SQL Editor -> Run.

create table if not exists public.guide_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guides (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.guide_categories(id) on delete cascade,
  title       text not null default '',
  youtube_url text not null,
  video_id    text not null,          -- extraído do link; usado pra capa/embed
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists guides_category_idx on public.guides(category_id, sort);

alter table public.guide_categories enable row level security;
drop policy if exists guide_categories_read on public.guide_categories;
create policy guide_categories_read on public.guide_categories for select using (true);
drop policy if exists guide_categories_admin on public.guide_categories;
create policy guide_categories_admin on public.guide_categories for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.guides enable row level security;
drop policy if exists guides_read on public.guides;
create policy guides_read on public.guides for select using (true);
drop policy if exists guides_admin on public.guides;
create policy guides_admin on public.guides for all
  using (public.is_admin()) with check (public.is_admin());
