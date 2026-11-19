-- /balance: "Alterações no jogo". Quando uma classe (ou o jogo todo) é alterada, os testes feitos ANTES daquela data
-- passam a ser "desatualizados" e saem do ranking (continuam guardados). As outras classes não são afetadas.
--   class nulo = alteração geral (vale para todas as classes: mobs, mapas, itens...)
-- Mesma regra da página: tabela FECHADA, tudo passa por funções que validam os campos.
--   balance_changes_list()  -> as alterações (as apagadas não aparecem)
--   balance_change_add()    -> registra uma alteração
--   balance_change_delete() -> "apaga" (some da página, a linha continua guardada)
-- É seguro rodar de novo.

create table if not exists public.balance_changes (
  id         uuid primary key default gen_random_uuid(),
  class      text check (class in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta')),
  changed_on date not null,
  patch      text not null default '' check (char_length(patch) <= 30),
  note       text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists balance_changes_on_idx on public.balance_changes (changed_on desc) where deleted_at is null;

alter table public.balance_changes enable row level security;
revoke all on table public.balance_changes from anon, authenticated;

create or replace function public.balance_changes_list() returns setof public.balance_changes
language sql security definer set search_path = public stable as $$
  select * from public.balance_changes where deleted_at is null order by changed_on desc, created_at desc limit 2000;
$$;

create or replace function public.balance_change_add(
  p_class text, p_on date, p_patch text default '', p_note text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_patch text := btrim(coalesce(p_patch, ''));
  v_note text := btrim(coalesce(p_note, ''));
begin
  if p_class is not null and p_class not in ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta') then raise exception 'classe inválida'; end if;
  if p_on is null or p_on < date '2020-01-01' or p_on > current_date + 1 then raise exception 'data inválida'; end if;
  if char_length(v_patch) > 30 then raise exception 'patch inválido'; end if;
  if char_length(v_note) > 200 then raise exception 'texto muito longo'; end if;
  if (select count(*) from public.balance_changes where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'muitos registros ao mesmo tempo, tente de novo em instantes';
  end if;
  insert into public.balance_changes (class, changed_on, patch, note) values (p_class, p_on, v_patch, v_note) returning id into v_id;
  return v_id;
end $$;

create or replace function public.balance_change_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.balance_changes set deleted_at = now() where id = p_id and deleted_at is null;
end $$;

grant execute on function public.balance_changes_list() to anon, authenticated;
grant execute on function public.balance_change_add(text, date, text, text) to anon, authenticated;
grant execute on function public.balance_change_delete(uuid) to anon, authenticated;

-- Conferência: a tabela existe e começa vazia (0 alterações).
select count(*) as alteracoes from public.balance_changes where deleted_at is null;
