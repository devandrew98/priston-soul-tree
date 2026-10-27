-- Orientações do líder + marcações no mapa do Bless Castle, mostradas também no link público.
--
--  * clan_boards : UMA linha por clã com o texto de orientação (`note`) e as marcações do mapa (`markers`, json).
--                  Só o admin e o líder/vices do clã leem e alteram (RLS).
--  * clan_share_view(token) passa a devolver também `note` e `markers`, para a página pública (somente leitura).
-- Rode uma vez no SQL Editor do Supabase (depois do 25 e do 26).

create table if not exists public.clan_boards (
  clan_id    uuid primary key references public.clans(id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 600),
  markers    jsonb not null default '[]'::jsonb check (jsonb_typeof(markers) = 'array' and jsonb_array_length(markers) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.clan_boards enable row level security;
drop policy if exists clan_boards_rw on public.clan_boards;
create policy clan_boards_rw on public.clan_boards for all
  using (public.is_admin() or public.is_clan_staff(clan_id))
  with check (public.is_admin() or public.is_clan_staff(clan_id));

create or replace function public.clan_share_view(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clan', c.name,
    'note', coalesce(b.note, ''),
    'markers', coalesce(b.markers, '[]'::jsonb),
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
