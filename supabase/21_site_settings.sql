-- Generic site-wide on/off flags editable from the admin panel (e.g. temporarily
-- disabling the Marketplace without touching code/deploys). Public reads (every
-- visitor needs to know if a section is enabled); only admins write.
create table if not exists public.site_settings (
  key        text primary key,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select using (true);
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Marketplace nasce desativado; ative pelo painel (Admin -> Notificação global) quando quiser.
insert into public.site_settings (key, enabled) values ('marketplace', false)
  on conflict (key) do nothing;
