-- Fase 12 — Notícias / Eventos na Home. Rode no SQL Editor (New query -> Run).

create table if not exists public.news (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  kind       text not null default 'news' check (kind in ('news','event','maintenance')),
  pinned     boolean not null default false,
  published  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;
drop policy if exists news_read on public.news;
create policy news_read on public.news for select using (published or public.is_admin()); -- público vê publicadas
drop policy if exists news_write on public.news;
create policy news_write on public.news for all
  using (public.is_admin()) with check (public.is_admin());                                -- só admin edita
