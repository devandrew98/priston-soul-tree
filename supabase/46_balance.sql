-- Página privada /balance: testes de balanceamento das classes (classe, mobs mortos, tempo, quem testou, mapa, nível...).
-- Quem tem o link lê e altera, sem login. Por isso a tabela fica FECHADA e tudo passa por funções que validam cada campo:
--   balance_list()   -> os testes (os apagados não aparecem)
--   balance_save()   -> cria um teste novo (p_id nulo) ou altera um existente
--   balance_delete() -> "apaga" (some da página, mas a linha continua guardada)
-- Toda alteração ou exclusão guarda a versão anterior em balance_history, para dar para desfazer um estrago.
-- Há um limite de criações por minuto contra enxurrada de lixo. É seguro rodar de novo.

create table if not exists public.balance_tests (
  id         uuid primary key default gen_random_uuid(),
  class      text not null check (class in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta')),
  mobs       int  not null check (mobs between 1 and 1000000),
  seconds    int  not null check (seconds between 1 and 86400),
  tester     text not null check (char_length(tester) between 1 and 40),
  level      int  check (level between 1 and 300),
  place      text not null default '' check (char_length(place) <= 80),
  notes      text not null default '' check (char_length(notes) <= 500),
  tested_on  date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists balance_tests_class_idx on public.balance_tests (class) where deleted_at is null;
create index if not exists balance_tests_created_idx on public.balance_tests (created_at desc);

create table if not exists public.balance_history (
  id      bigint generated always as identity primary key,
  test_id uuid not null,
  op      text not null,
  old     jsonb not null,
  at      timestamptz not null default now()
);
create index if not exists balance_history_test_idx on public.balance_history (test_id, at desc);

alter table public.balance_tests enable row level security;
alter table public.balance_history enable row level security;
revoke all on table public.balance_tests from anon, authenticated;
revoke all on table public.balance_history from anon, authenticated;

-- Guarda a versão anterior de qualquer alteração (inclusive a "exclusão", que é só marcar deleted_at).
create or replace function public.balance_tests_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.balance_history (test_id, op, old)
  values (old.id, case when new.deleted_at is not null and old.deleted_at is null then 'delete' else 'update' end, to_jsonb(old));
  return new;
end $$;
drop trigger if exists balance_tests_log on public.balance_tests;
create trigger balance_tests_log before update on public.balance_tests
  for each row execute function public.balance_tests_log();

create or replace function public.balance_list() returns setof public.balance_tests
language sql security definer set search_path = public stable as $$
  select * from public.balance_tests where deleted_at is null order by tested_on desc, created_at desc limit 5000;
$$;

create or replace function public.balance_save(
  p_id uuid, p_class text, p_mobs int, p_seconds int, p_tester text,
  p_level int default null, p_place text default '', p_notes text default '', p_on date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_tester text := btrim(coalesce(p_tester, ''));
  v_place text := btrim(coalesce(p_place, ''));
  v_notes text := btrim(coalesce(p_notes, ''));
  v_on date := coalesce(p_on, current_date);
begin
  if p_class not in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta') then raise exception 'classe inválida'; end if;
  if p_mobs is null or p_mobs < 1 or p_mobs > 1000000 then raise exception 'quantidade de mobs inválida'; end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 86400 then raise exception 'tempo inválido'; end if;
  if char_length(v_tester) < 1 or char_length(v_tester) > 40 then raise exception 'informe o nome de quem testou (até 40 letras)'; end if;
  if p_level is not null and (p_level < 1 or p_level > 300) then raise exception 'nível inválido'; end if;
  if char_length(v_place) > 80 or char_length(v_notes) > 500 then raise exception 'texto muito longo'; end if;
  if v_on < date '2020-01-01' or v_on > current_date + 1 then raise exception 'data inválida'; end if;

  if p_id is null then
    if (select count(*) from public.balance_tests where created_at > now() - interval '1 minute') >= 60 then
      raise exception 'muitos registros ao mesmo tempo, tente de novo em instantes';
    end if;
    insert into public.balance_tests (class, mobs, seconds, tester, level, place, notes, tested_on)
    values (p_class, p_mobs, p_seconds, v_tester, p_level, v_place, v_notes, v_on)
    returning id into v_id;
  else
    update public.balance_tests
       set class = p_class, mobs = p_mobs, seconds = p_seconds, tester = v_tester, level = p_level,
           place = v_place, notes = v_notes, tested_on = v_on, updated_at = now()
     where id = p_id and deleted_at is null
    returning id into v_id;
    if v_id is null then raise exception 'teste não encontrado (talvez já tenha sido apagado)'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.balance_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.balance_tests set deleted_at = now(), updated_at = now() where id = p_id and deleted_at is null;
end $$;

grant execute on function public.balance_list() to anon, authenticated;
grant execute on function public.balance_save(uuid, text, int, int, text, int, text, text, date) to anon, authenticated;
grant execute on function public.balance_delete(uuid) to anon, authenticated;

-- Conferência: a tabela existe e começa vazia (0 testes).
select (select count(*) from public.balance_tests) as testes, (select count(*) from public.balance_history) as historico;
