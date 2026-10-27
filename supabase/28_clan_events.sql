-- Data/hora do Bless Castle, histórico de presença, rabiscos no mapa e visão geral do administrador.
--
--  * clan_boards.bc_at     : data e hora do próximo BC (aparece no link dos jogadores).
--  * clan_boards.strokes   : rabiscos feitos com o lápis no mapa (json).
--  * clan_events           : cada Bless Castle registrado (um por clã e data/hora).
--  * clan_event_members    : quem participou de cada BC (os confirmados no momento do registro).
--  * clan_members.updated_at : última alteração do membro (usado na "última atividade" do clã).
--  * clan_register_event() : registra/atualiza a presença de um BC de uma vez só.
--  * admin_clan_overview() : visão geral de todos os clãs (só o administrador).
--  * clan_share_view()     : passa a devolver também a data/hora do BC e os rabiscos.
-- Rode uma vez no SQL Editor do Supabase (depois do 25, 26 e 27).

alter table public.clan_boards add column if not exists bc_at timestamptz;
alter table public.clan_boards add column if not exists strokes jsonb not null default '[]'::jsonb;
alter table public.clan_boards drop constraint if exists clan_boards_strokes_check;
alter table public.clan_boards add constraint clan_boards_strokes_check
  check (jsonb_typeof(strokes) = 'array' and jsonb_array_length(strokes) <= 60);

alter table public.clan_members add column if not exists updated_at timestamptz not null default now();
create or replace function public.clan_members_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.clan_members where clan_id = new.clan_id) >= 300 then
      raise exception 'limite de 300 membros por clã';
    end if;
  else
    new.clan_id := old.clan_id; -- a member never moves to another clan
    new.updated_at := now();
  end if;
  return new;
end $$;

create table if not exists public.clan_events (
  id         uuid primary key default gen_random_uuid(),
  clan_id    uuid not null references public.clans(id) on delete cascade,
  starts_at  timestamptz not null,
  created_at timestamptz not null default now(),
  unique (clan_id, starts_at)
);
create table if not exists public.clan_event_members (
  event_id  uuid not null references public.clan_events(id) on delete cascade,
  member_id uuid not null references public.clan_members(id) on delete cascade,
  primary key (event_id, member_id)
);
create index if not exists clan_event_members_member_idx on public.clan_event_members (member_id);

create or replace function public.is_clan_event_staff(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clan_events e where e.id = eid and (public.is_admin() or public.is_clan_staff(e.clan_id)));
$$;

alter table public.clan_events enable row level security;
alter table public.clan_event_members enable row level security;
drop policy if exists clan_events_rw on public.clan_events;
create policy clan_events_rw on public.clan_events for all
  using (public.is_admin() or public.is_clan_staff(clan_id))
  with check (public.is_admin() or public.is_clan_staff(clan_id));
drop policy if exists clan_event_members_rw on public.clan_event_members;
create policy clan_event_members_rw on public.clan_event_members for all
  using (public.is_clan_event_staff(event_id)) with check (public.is_clan_event_staff(event_id));

-- Registers (or updates) the attendance of one Bless Castle: the given members, all of this clan, are the ones who took part.
create or replace function public.clan_register_event(p_clan uuid, p_starts_at timestamptz, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if not (public.is_admin() or public.is_clan_staff(p_clan)) then raise exception 'not authorized'; end if;
  insert into public.clan_events (clan_id, starts_at) values (p_clan, p_starts_at)
    on conflict (clan_id, starts_at) do update set starts_at = excluded.starts_at
    returning id into eid;
  delete from public.clan_event_members where event_id = eid;
  insert into public.clan_event_members (event_id, member_id)
    select eid, m.id from public.clan_members m where m.clan_id = p_clan and m.id = any(p_member_ids);
  return eid;
end $$;

-- Overview of every clan for the administrator (empty for anybody else).
create or replace function public.admin_clan_overview()
returns table (clan_id uuid, name text, members int, confirmed int, leader text, vices int, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
    (select count(*) from public.clan_members m where m.clan_id = c.id)::int,
    (select count(*) from public.clan_members m where m.clan_id = c.id and m.confirmed)::int,
    (select p.nick from public.clan_staff s join public.profiles p on p.id = s.user_id where s.clan_id = c.id and s.role = 'leader' limit 1),
    (select count(*) from public.clan_staff s where s.clan_id = c.id and s.role = 'vice')::int,
    greatest(c.created_at,
      (select max(m.updated_at) from public.clan_members m where m.clan_id = c.id),
      (select b.updated_at from public.clan_boards b where b.clan_id = c.id),
      (select max(e.created_at) from public.clan_events e where e.clan_id = c.id))
  from public.clans c
  where public.is_admin()
  order by c.name;
$$;

create or replace function public.clan_share_view(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clan', c.name,
    'note', coalesce(b.note, ''),
    'markers', coalesce(b.markers, '[]'::jsonb),
    'strokes', coalesce(b.strokes, '[]'::jsonb),
    'bcAt', b.bc_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nick', m.nick, 'cls', m.cls, 'partyLeader', m.party_leader,
        'createdAt', extract(epoch from m.created_at) * 1000
      ) order by m.created_at)
      from public.clan_members m where m.clan_id = c.id and m.confirmed
    ), '[]'::jsonb)
  )
  from public.clan_shares s
  join public.clans c on c.id = s.clan_id
  left join public.clan_boards b on b.clan_id = c.id
  where s.token = p_token;
$$;
grant execute on function public.clan_share_view(text) to anon, authenticated;
