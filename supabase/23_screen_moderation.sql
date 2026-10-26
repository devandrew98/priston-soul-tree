-- Moderation for the "Compartilhamento de Tela" rooms.
--
--  * screen_reports      : anyone (logged in or not) can report a room; only admins read/clear them.
--  * screen_closed_rooms : rooms an admin has shut down. Public read (hosts, viewers and the live
--                          list check it); only admins write. A closed room code stays closed.
--
-- Run this once in the Supabase SQL editor. The site keeps working without it (reports and the
-- admin close button simply report "unavailable"); nothing else depends on these tables.

create table if not exists public.screen_reports (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null check (char_length(room_code) = 8),
  reason      text not null check (reason in ('inappropriate', 'spam', 'other')),
  details     text not null default '' check (char_length(details) <= 500),
  reporter_id uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists screen_reports_room_idx on public.screen_reports (room_code, created_at desc);

alter table public.screen_reports enable row level security;
drop policy if exists screen_reports_insert on public.screen_reports;
create policy screen_reports_insert on public.screen_reports for insert with check (true);
drop policy if exists screen_reports_admin on public.screen_reports;
create policy screen_reports_admin on public.screen_reports for all
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.screen_closed_rooms (
  code       text primary key check (char_length(code) = 8),
  reason     text not null default '' check (char_length(reason) <= 200),
  closed_by  uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.screen_closed_rooms enable row level security;
drop policy if exists screen_closed_read on public.screen_closed_rooms;
create policy screen_closed_read on public.screen_closed_rooms for select using (true);
drop policy if exists screen_closed_admin on public.screen_closed_rooms;
create policy screen_closed_admin on public.screen_closed_rooms for all
  using (public.is_admin()) with check (public.is_admin());
