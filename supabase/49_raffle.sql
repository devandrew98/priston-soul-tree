-- Rifa do PristonZONE (página /rifa, painel de administrador > Site > Rifa).
-- Como funciona:
--   * O administrador cria a rifa: item, preço em coins e/ou gold, quantidade de números, máximo por pessoa, validade da reserva.
--   * O jogador entra com a conta do site, escolhe números e RESERVA (com o nick do personagem dele no jogo).
--   * O pagamento é feito dentro do jogo; o administrador, que vê o jogo, marca o número como PAGO. Reserva que não é paga
--     dentro do prazo volta a ficar livre sozinha.
--   * Só o administrador sorteia. O número sorteado é escolhido pelo próprio banco de dados, entre os números PAGOS, de forma
--     aleatória (nem o administrador escolhe). Depois do sorteio nada mais pode ser alterado nem apagado.
-- Só pode existir uma rifa aberta por vez. As tabelas ficam fechadas: tudo passa pelas funções abaixo. É seguro rodar de novo.

create table if not exists public.raffles (
  id             uuid primary key default gen_random_uuid(),
  item_name      text not null check (char_length(item_name) between 1 and 80),
  item_note      text not null default '' check (char_length(item_note) <= 120),
  image_url      text not null default '' check (char_length(image_url) <= 300),
  price_coins    int  check (price_coins between 1 and 100000000),
  price_gold_kk  int  check (price_gold_kk between 1 and 100000000),
  total_numbers  int  not null check (total_numbers between 2 and 500),
  max_per_person int  not null default 3 check (max_per_person between 1 and 50),
  hold_hours     int  not null default 48 check (hold_hours between 1 and 720),
  pay_to         text not null default '' check (char_length(pay_to) <= 40),
  rules          text not null default '' check (char_length(rules) <= 1500),
  ends_at        timestamptz,
  status         text not null default 'open' check (status in ('open', 'drawn', 'cancelled')),
  winner_number  int,
  winner_nick    text,
  winner_user    uuid,
  drawn_at       timestamptz,
  created_at     timestamptz not null default now(),
  check (price_coins is not null or price_gold_kk is not null)
);
-- uma única rifa aberta por vez
create unique index if not exists raffles_one_open on public.raffles ((true)) where status = 'open';

create table if not exists public.raffle_numbers (
  raffle_id   uuid not null references public.raffles(id) on delete cascade,
  number      int  not null check (number >= 1),
  user_id     uuid not null references auth.users(id) on delete cascade,
  game_nick   text not null check (char_length(game_nick) between 2 and 30),
  status      text not null default 'reserved' check (status in ('reserved', 'paid')),
  reserved_at timestamptz not null default now(),
  expires_at  timestamptz,
  paid_at     timestamptz,
  primary key (raffle_id, number)
);
create index if not exists raffle_numbers_user_idx on public.raffle_numbers (raffle_id, user_id);

alter table public.raffles enable row level security;
alter table public.raffle_numbers enable row level security;

-- A rifa em si é pública; o administrador cria e edita (enquanto estiver aberta).
drop policy if exists raffles_read on public.raffles;
create policy raffles_read on public.raffles for select using (true);
drop policy if exists raffles_admin on public.raffles;
create policy raffles_admin on public.raffles for all using (public.is_admin()) with check (public.is_admin());
-- Os números (com o dono) só o administrador lê direto; o público lê pela função raffle_state.
drop policy if exists raffle_numbers_admin on public.raffle_numbers;
create policy raffle_numbers_admin on public.raffle_numbers for select using (public.is_admin());

-- Regras que nem o administrador consegue contornar mexendo direto na tabela:
--   * uma rifa nova nasce sempre aberta e sem ganhador;
--   * o status e o ganhador só mudam pelas funções raffle_draw / raffle_cancel (que ligam o aviso 'pz.allow' só durante a chamada);
--   * depois do sorteio (ou do cancelamento) a rifa não muda mais, e uma rifa sorteada não pode ser apagada.
create or replace function public.raffles_lock() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'open' or new.winner_number is not null or new.winner_nick is not null or new.winner_user is not null or new.drawn_at is not null then
      raise exception 'uma rifa nova começa aberta e sem ganhador';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status = 'drawn' then raise exception 'uma rifa sorteada não pode ser apagada'; end if;
    return old;
  end if;
  if old.status <> 'open' then raise exception 'esta rifa já foi encerrada e não pode mais ser alterada'; end if;
  if (new.status is distinct from old.status or new.winner_number is distinct from old.winner_number or new.winner_nick is distinct from old.winner_nick
      or new.winner_user is distinct from old.winner_user or new.drawn_at is distinct from old.drawn_at)
     and coalesce(current_setting('pz.allow', true), '') <> '1' then
    raise exception 'o ganhador só pode ser definido pelo sorteio';
  end if;
  return new;
end $$;
drop trigger if exists raffles_lock on public.raffles;
create trigger raffles_lock before insert or update or delete on public.raffles for each row execute function public.raffles_lock();

-- Reservas vencidas voltam a ficar livres.
create or replace function public.raffle_expire() returns void
language sql security definer set search_path = public as $$
  delete from public.raffle_numbers where status = 'reserved' and expires_at is not null and expires_at < now();
$$;

-- Estado público da rifa aberta: a rifa e os números ocupados (com o nick de quem ficou com cada um).
create or replace function public.raffle_state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.raffles; v_nums jsonb;
begin
  perform public.raffle_expire();
  select * into r from public.raffles where status = 'open' limit 1;
  if not found then return jsonb_build_object('raffle', null); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', number, 'status', status, 'nick', game_nick, 'mine', user_id = auth.uid(),
           'expires', case when user_id = auth.uid() then expires_at end) order by number), '[]'::jsonb)
    into v_nums from public.raffle_numbers where raffle_id = r.id;
  return jsonb_build_object('raffle', to_jsonb(r) - 'winner_user', 'numbers', v_nums);
end $$;

-- Rifas encerradas (sorteadas ou canceladas), das mais novas para as mais antigas.
create or replace function public.raffle_history() returns jsonb
language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', r.id, 'item_name', r.item_name, 'item_note', r.item_note, 'image_url', r.image_url, 'status', r.status,
      'total_numbers', r.total_numbers, 'sold', (select count(*) from public.raffle_numbers n where n.raffle_id = r.id and n.status = 'paid'),
      'winner_number', r.winner_number, 'winner_nick', r.winner_nick, 'drawn_at', r.drawn_at, 'created_at', r.created_at) as x
    from public.raffles r where r.status <> 'open' order by r.created_at desc limit 100
  ) t;
$$;

-- Jogador logado reserva um ou mais números da rifa aberta.
create or replace function public.raffle_reserve(p_numbers int[], p_nick text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.raffles;
  v_uid uuid := auth.uid();
  v_nick text := btrim(coalesce(p_nick, ''));
  v_cnt int := coalesce(array_length(p_numbers, 1), 0);
  v_have int; v_have_nick int;
begin
  if v_uid is null then raise exception 'entre na sua conta para reservar'; end if;
  perform public.raffle_expire();
  select * into r from public.raffles where status = 'open' for update;
  if not found then raise exception 'não há rifa aberta'; end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 30 then raise exception 'informe o nick do seu personagem (2 a 30 letras)'; end if;
  if v_cnt = 0 then raise exception 'escolha pelo menos um número'; end if;
  if (select count(distinct x) from unnest(p_numbers) x) <> v_cnt then raise exception 'número repetido'; end if;
  if exists (select 1 from unnest(p_numbers) x where x < 1 or x > r.total_numbers) then raise exception 'número fora da rifa'; end if;

  select count(*) into v_have from public.raffle_numbers where raffle_id = r.id and user_id = v_uid;
  select count(*) into v_have_nick from public.raffle_numbers where raffle_id = r.id and lower(game_nick) = lower(v_nick);
  if v_have + v_cnt > r.max_per_person or v_have_nick + v_cnt > r.max_per_person then
    raise exception 'limite de % números por pessoa nesta rifa', r.max_per_person;
  end if;

  begin
    insert into public.raffle_numbers (raffle_id, number, user_id, game_nick, status, expires_at)
    select r.id, x, v_uid, v_nick, 'reserved', now() + make_interval(hours => r.hold_hours) from unnest(p_numbers) x;
  exception when unique_violation then
    raise exception 'algum número acabou de ser reservado por outra pessoa; escolha outro';
  end;
end $$;

-- O jogador desiste de um número que ainda não foi pago.
create or replace function public.raffle_release_mine(p_number int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  delete from public.raffle_numbers n using public.raffles r
   where r.id = n.raffle_id and r.status = 'open' and n.number = p_number and n.user_id = auth.uid() and n.status = 'reserved';
end $$;

-- ===== só administrador =====
create or replace function public.raffle_admin_numbers() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  perform public.raffle_expire();
  select * into r from public.raffles where status = 'open' limit 1;
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'n', n.number, 'status', n.status, 'nick', n.game_nick, 'site_nick', p.nick,
      'reserved_at', n.reserved_at, 'expires_at', n.expires_at, 'paid_at', n.paid_at) order by n.number)
    from public.raffle_numbers n left join public.profiles p on p.id = n.user_id where n.raffle_id = r.id), '[]'::jsonb);
end $$;

create or replace function public.raffle_mark_paid(p_number int) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select * into r from public.raffles where status = 'open' for update;
  if not found then raise exception 'não há rifa aberta'; end if;
  update public.raffle_numbers set status = 'paid', paid_at = now(), expires_at = null
   where raffle_id = r.id and number = p_number;
  if not found then raise exception 'esse número não está reservado (talvez a reserva tenha vencido)'; end if;
end $$;

create or replace function public.raffle_release(p_number int) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  select * into r from public.raffles where status = 'open' for update;
  if not found then raise exception 'não há rifa aberta'; end if;
  delete from public.raffle_numbers where raffle_id = r.id and number = p_number;
end $$;

-- O sorteio: escolhe ao acaso, entre os números PAGOS, quem ganha. Ninguém (nem o administrador) escolhe o número.
create or replace function public.raffle_draw() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.raffles; w public.raffle_numbers; v_paid int;
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  perform public.raffle_expire();
  select * into r from public.raffles where status = 'open' for update;
  if not found then raise exception 'não há rifa aberta'; end if;
  select count(*) into v_paid from public.raffle_numbers where raffle_id = r.id and status = 'paid';
  if v_paid = 0 then raise exception 'ainda não há nenhum número pago para sortear'; end if;
  -- gen_random_uuid() é aleatório de qualidade criptográfica: ordenar por ele e pegar o primeiro dá a todos a mesma chance.
  select * into w from public.raffle_numbers where raffle_id = r.id and status = 'paid' order by gen_random_uuid() limit 1;
  perform set_config('pz.allow', '1', true); -- vale só durante esta chamada
  update public.raffles set status = 'drawn', winner_number = w.number, winner_nick = w.game_nick, winner_user = w.user_id, drawn_at = now()
   where id = r.id;
  return jsonb_build_object('number', w.number, 'nick', w.game_nick, 'paid', v_paid);
end $$;

create or replace function public.raffle_cancel() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'sem permissão'; end if;
  perform set_config('pz.allow', '1', true);
  update public.raffles set status = 'cancelled' where status = 'open';
end $$;

grant execute on function public.raffle_state() to anon, authenticated;
grant execute on function public.raffle_history() to anon, authenticated;
grant execute on function public.raffle_reserve(int[], text) to authenticated;
grant execute on function public.raffle_release_mine(int) to authenticated;
grant execute on function public.raffle_admin_numbers() to authenticated;
grant execute on function public.raffle_mark_paid(int) to authenticated;
grant execute on function public.raffle_release(int) to authenticated;
grant execute on function public.raffle_draw() to authenticated;
grant execute on function public.raffle_cancel() to authenticated;

-- Conferência: as tabelas existem e começam vazias.
select (select count(*) from public.raffles) as rifas, (select count(*) from public.raffle_numbers) as numeros;
