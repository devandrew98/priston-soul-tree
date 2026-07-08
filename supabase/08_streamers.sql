-- Fase 10 — Streamers. Rode no SQL Editor (New query -> colar -> Run).
-- Tabela de streamers + storage da capa + agendamento da detecção automática.

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.streamers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  platform        text not null check (platform in ('twitch','youtube')),
  handle          text not null,               -- twitch login, ou @handle / UC... do YouTube
  url             text not null default '',    -- link do canal (opcional; se vazio é derivado do handle)
  cover_url       text not null default '',    -- imagem quadrada de capa (upload no painel)
  live            boolean not null default false,
  viewers         int not null default 0,
  title           text not null default '',    -- título da live (preenchido pela detecção)
  sort            int not null default 0,       -- ordem de exibição
  live_checked_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists streamers_live_idx on public.streamers(live, sort);

alter table public.streamers enable row level security;
drop policy if exists streamers_read on public.streamers;
create policy streamers_read on public.streamers for select using (true);           -- todos veem
drop policy if exists streamers_admin_all on public.streamers;
create policy streamers_admin_all on public.streamers for all
  using (public.is_admin()) with check (public.is_admin());                          -- só admin edita

-- ---------------------------------------------------------------------------
-- Storage: bucket para as capas (leitura pública, upload autenticado)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('streamer-covers', 'streamer-covers', true)
  on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select
  using (bucket_id in ('item-images','avatars','streamer-covers'));
drop policy if exists "authed upload images" on storage.objects;
create policy "authed upload images" on storage.objects for insert to authenticated
  with check (bucket_id in ('item-images','avatars','streamer-covers'));

-- ---------------------------------------------------------------------------
-- Detecção automática (agendamento) — rode DEPOIS de publicar a Edge Function
-- "refresh-streamers" e configurar os secrets. Edite os 3 <PLACEHOLDERS>.
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule('refresh-streamers', '*/2 * * * *', $cron$
--   select net.http_post(
--     url     := 'https://<SEU_PROJETO>.supabase.co/functions/v1/refresh-streamers',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <SUA_ANON_KEY>',
--       'x-refresh-secret', '<SEU_REFRESH_SECRET>'
--     )
--   );
-- $cron$);
--
-- Para remover o agendamento depois: select cron.unschedule('refresh-streamers');
