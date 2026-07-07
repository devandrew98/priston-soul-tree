-- Fase 7 — rode este trecho no SQL Editor (New query -> colar -> Run).
-- Moderação: colunas de status do usuário, tabela de logs e broadcast global.

-- user moderation flags
alter table public.profiles add column if not exists banned    boolean not null default false;
alter table public.profiles add column if not exists suspended boolean not null default false;

-- admin action log (admins only)
create table if not exists public.admin_logs (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references public.profiles(id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_logs(created_at desc);
alter table public.admin_logs enable row level security;
drop policy if exists admin_logs_rw on public.admin_logs;
create policy admin_logs_rw on public.admin_logs for all
  using (public.is_admin()) with check (public.is_admin());

-- send a global notification to every user (admin only, bypasses RLS safely)
create or replace function public.admin_broadcast(message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  insert into public.notifications (user_id, type, params, link)
  select p.id, 'global', jsonb_build_object('text', message), null
  from public.profiles p;
end;
$$;
