-- /balance: cada teste passa a guardar a versão do patch do jogo em que foi feito (texto livre, ex.: 1.2.3).
-- Os testes que já existem ficam sem patch (aparecem com um traço). É seguro rodar de novo.

alter table public.balance_tests add column if not exists patch text not null default '';

-- A função antiga (sem o patch) sai, para não ficar duas versões com o mesmo nome.
drop function if exists public.balance_save(uuid, text, int, int, text, int, text, text, date, text);

create or replace function public.balance_save(
  p_id uuid, p_class text, p_mobs int, p_seconds int, p_tester text,
  p_level int default null, p_place text default '', p_notes text default '', p_on date default null,
  p_mode text default null, p_patch text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_tester text := btrim(coalesce(p_tester, ''));
  v_place text := btrim(coalesce(p_place, ''));
  v_notes text := btrim(coalesce(p_notes, ''));
  v_patch text := btrim(coalesce(p_patch, ''));
  v_on date := coalesce(p_on, current_date);
begin
  if p_class not in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta') then raise exception 'classe inválida'; end if;
  if p_mobs is null or p_mobs < 1 or p_mobs > 1000000 then raise exception 'quantidade de mobs inválida'; end if;
  if p_seconds is null or p_seconds < 1 or p_seconds > 86400 then raise exception 'tempo inválido'; end if;
  if char_length(v_tester) < 1 or char_length(v_tester) > 40 then raise exception 'informe o nome de quem testou (até 40 letras)'; end if;
  if p_level is not null and (p_level < 1 or p_level > 300) then raise exception 'nível inválido'; end if;
  if p_mode is not null and p_mode not in ('aoe', 'single') then raise exception 'modo inválido'; end if;
  if char_length(v_patch) > 30 then raise exception 'patch inválido'; end if;
  if char_length(v_place) > 80 or char_length(v_notes) > 500 then raise exception 'texto muito longo'; end if;
  if v_on < date '2020-01-01' or v_on > current_date + 1 then raise exception 'data inválida'; end if;

  if p_id is null then
    if (select count(*) from public.balance_tests where created_at > now() - interval '1 minute') >= 60 then
      raise exception 'muitos registros ao mesmo tempo, tente de novo em instantes';
    end if;
    insert into public.balance_tests (class, mobs, seconds, tester, level, place, notes, tested_on, mode, patch)
    values (p_class, p_mobs, p_seconds, v_tester, p_level, v_place, v_notes, v_on, p_mode, v_patch)
    returning id into v_id;
  else
    update public.balance_tests
       set class = p_class, mobs = p_mobs, seconds = p_seconds, tester = v_tester, level = p_level,
           place = v_place, notes = v_notes, tested_on = v_on, mode = p_mode, patch = v_patch, updated_at = now()
     where id = p_id and deleted_at is null
    returning id into v_id;
    if v_id is null then raise exception 'teste não encontrado (talvez já tenha sido apagado)'; end if;
  end if;
  return v_id;
end $$;

grant execute on function public.balance_save(uuid, text, int, int, text, int, text, text, date, text, text) to anon, authenticated;

-- balance_list devolve "select *": como a tabela ganhou a coluna, recria para o tipo de retorno acompanhar.
create or replace function public.balance_list() returns setof public.balance_tests
language sql security definer set search_path = public stable as $$
  select * from public.balance_tests where deleted_at is null order by tested_on desc, created_at desc limit 5000;
$$;
grant execute on function public.balance_list() to anon, authenticated;

-- Conferência: a coluna existe; testes antigos ficam sem patch.
select count(*) filter (where patch = '') as sem_patch, count(*) filter (where patch <> '') as com_patch
  from public.balance_tests where deleted_at is null;
