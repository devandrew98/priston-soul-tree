-- Formação do Bless Castle por clã.
--
--  * clans        : os clãs (criados só pelo administrador).
--  * clan_staff   : quem pode usar a ferramenta de cada clã: 1 líder e até 4 vices por clã.
--                   Uma conta só pertence a UM clã. Só o administrador cria/remove acessos.
--  * clan_members : os membros do clã (nick + classe), se estão confirmados para o BC e quem é líder de party.
--
-- Isolamento (feito aqui no banco, não na tela): o administrador (is_admin) vê e altera tudo; líder e vices
-- só enxergam e alteram as linhas do PRÓPRIO clã. Rode uma vez no SQL Editor do Supabase.

create table if not exists public.clans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists clans_name_uidx on public.clans (lower(name));

create table if not exists public.clan_staff (
  clan_id    uuid not null references public.clans(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('leader', 'vice')),
  created_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);
create unique index if not exists clan_staff_one_leader on public.clan_staff (clan_id) where role = 'leader';
create unique index if not exists clan_staff_one_clan_per_user on public.clan_staff (user_id);

create table if not exists public.clan_members (
  id           uuid primary key default gen_random_uuid(),
  clan_id      uuid not null references public.clans(id) on delete cascade,
  nick         text not null check (char_length(nick) between 1 and 30),
  cls          text not null check (cls in
               ('Fighter','Mechanician','Archer','Pikeman','Atalanta','Knight','Magician','Priestess','Assassin','Shaman')),
  confirmed    boolean not null default false,
  party_leader boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index if not exists clan_members_nick_uidx on public.clan_members (clan_id, lower(nick));
create index if not exists clan_members_clan_idx on public.clan_members (clan_id, created_at);

-- Is the current user staff (leader or vice) of this clan? security definer so the policies below don't recurse.
create or replace function public.is_clan_staff(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clan_staff where clan_id = cid and user_id = auth.uid());
$$;

-- Limits: at most 4 vices per clan and 300 members per clan.
create or replace function public.clan_staff_guard()
returns trigger language plpgsql as $$
begin
  if new.role = 'vice' and (select count(*) from public.clan_staff where clan_id = new.clan_id and role = 'vice') >= 4 then
    raise exception 'este clã já tem 4 vice-líderes';
  end if;
  return new;
end $$;
drop trigger if exists clan_staff_guard_trg on public.clan_staff;
create trigger clan_staff_guard_trg before insert on public.clan_staff for each row execute function public.clan_staff_guard();

create or replace function public.clan_members_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.clan_members where clan_id = new.clan_id) >= 300 then
      raise exception 'limite de 300 membros por clã';
    end if;
  else
    new.clan_id := old.clan_id; -- a member never moves to another clan
  end if;
  return new;
end $$;
drop trigger if exists clan_members_guard_trg on public.clan_members;
create trigger clan_members_guard_trg before insert or update on public.clan_members for each row execute function public.clan_members_guard();

alter table public.clans enable row level security;
alter table public.clan_staff enable row level security;
alter table public.clan_members enable row level security;

drop policy if exists clans_read on public.clans;
create policy clans_read on public.clans for select using (public.is_admin() or public.is_clan_staff(id));
drop policy if exists clans_admin on public.clans;
create policy clans_admin on public.clans for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists clan_staff_read on public.clan_staff;
create policy clan_staff_read on public.clan_staff for select using (public.is_admin() or public.is_clan_staff(clan_id));
drop policy if exists clan_staff_admin on public.clan_staff;
create policy clan_staff_admin on public.clan_staff for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists clan_members_rw on public.clan_members;
create policy clan_members_rw on public.clan_members for all
  using (public.is_admin() or public.is_clan_staff(clan_id))
  with check (public.is_admin() or public.is_clan_staff(clan_id));

-- Staff of a clan with their nicks (admin or staff of that clan only).
create or replace function public.clan_staff_list(p_clan uuid)
returns table (user_id uuid, nick text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_clan_staff(p_clan)) then
    raise exception 'not authorized';
  end if;
  return query select s.user_id, p.nick, s.role from public.clan_staff s join public.profiles p on p.id = s.user_id
    where s.clan_id = p_clan order by s.role desc, p.nick;
end $$;

-- Gives a player (by nick) access to a clan as leader or vice. Admin only.
create or replace function public.admin_clan_add_staff(p_clan uuid, p_nick text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select id into uid from public.profiles where lower(nick) = lower(trim(p_nick)) limit 1;
  if uid is null then raise exception 'jogador não encontrado: %', p_nick; end if;
  insert into public.clan_staff (clan_id, user_id, role) values (p_clan, uid, p_role);
end $$;

-- Does the current user have access to the tool (admin or staff of any clan)? Used to show the menu entry.
create or replace function public.clan_tool_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.clan_staff where user_id = auth.uid());
$$;
