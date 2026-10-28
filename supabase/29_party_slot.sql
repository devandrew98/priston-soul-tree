-- Posição manual de um membro na formação (o líder/vice arrasta o jogador para outra party/raid ou para as reservas).
--
--  * clan_members.party_slot : null = automático; 0 a 3 = party fixada (raid 1: 0 e 1, raid 2: 2 e 3); 4 = reservas.
--  * clan_share_view()       : passa a devolver o party_slot, para o link dos jogadores mostrar a mesma formação.
-- Rode uma vez no SQL Editor do Supabase (depois do 25 ao 28).

alter table public.clan_members add column if not exists party_slot smallint;
alter table public.clan_members drop constraint if exists clan_members_party_slot_check;
alter table public.clan_members add constraint clan_members_party_slot_check
  check (party_slot is null or party_slot between 0 and 4);

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
        'id', m.id, 'nick', m.nick, 'cls', m.cls, 'partyLeader', m.party_leader, 'partySlot', m.party_slot,
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
