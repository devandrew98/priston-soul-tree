-- Link de compartilhamento da formação do clã (somente leitura, sem login).
--
--  * clan_shares : no máximo UM link por clã. Só o admin e o líder/vices do clã criam, trocam ou apagam o link.
--  * clan_share_view(token) : devolve, para qualquer pessoa com o link, o nome do clã e os membros CONFIRMADOS
--    (nick, classe e quem é líder de party). Nada mais do clã é exposto, e nada pode ser alterado por esse caminho.
-- Rode uma vez no SQL Editor do Supabase (depois do 25_clan_formation.sql).

create table if not exists public.clan_shares (
  clan_id    uuid primary key references public.clans(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
alter table public.clan_shares enable row level security;
drop policy if exists clan_shares_rw on public.clan_shares;
create policy clan_shares_rw on public.clan_shares for all
  using (public.is_admin() or public.is_clan_staff(clan_id))
  with check (public.is_admin() or public.is_clan_staff(clan_id));

create or replace function public.clan_share_view(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clan', c.name,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'nick', m.nick, 'cls', m.cls, 'partyLeader', m.party_leader,
        'createdAt', extract(epoch from m.created_at) * 1000
      ) order by m.created_at)
      from public.clan_members m where m.clan_id = c.id and m.confirmed
    ), '[]'::jsonb)
  )
  from public.clan_shares s join public.clans c on c.id = s.clan_id
  where s.token = p_token;
$$;
grant execute on function public.clan_share_view(text) to anon, authenticated;
