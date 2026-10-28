-- Nick único e exclusão de conta pelo administrador. Rode UMA VEZ no SQL Editor do Supabase (pode rodar de novo: é idempotente).
--
-- POR QUE EXISTIAM NICKS REPETIDOS: a coluna profiles.nick era só "text not null", sem nenhuma regra de unicidade no banco,
-- e o cadastro não conferia se o nick já estava em uso. Quem se cadastra com e-mail/senha digita o nick; quem entra com o Google
-- recebe a parte do e-mail antes do @. Nos dois casos o banco aceitava repetidos.
--
-- O QUE ESTE ARQUIVO FAZ
--  1) nick_available(): o cadastro pergunta se o nick está livre antes de criar a conta.
--  2) handle_new_user(): se mesmo assim o nick estiver em uso (ex.: entrou com o Google), acrescenta um número (Elyon2) em vez de repetir.
--  3) Índice único em lower(btrim(nick)): "Elyon", "elyon" e " Elyon " contam como o MESMO nick.
--     Se já existirem repetidos, o índice NÃO é criado e o Supabase mostra um aviso com os nomes repetidos. Exclua (ou renomeie) os
--     repetidos pelo painel e rode este arquivo de novo.
--  4) admin_delete_user(): exclui a conta (login + perfil + tudo que o usuário criou) só para administradores.

-- 1) nick livre? (qualquer visitante pode perguntar: os nicks já são públicos no site)
create or replace function public.nick_available(candidate text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(btrim(nick)) = lower(btrim(candidate)));
$$;
grant execute on function public.nick_available(text) to anon, authenticated;

-- 2) novo usuário: nunca cria um nick repetido
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := left(btrim(coalesce(nullif(new.raw_user_meta_data->>'nick', ''), split_part(new.email, '@', 1))), 20);
  cand text;
  n    int := 0;
begin
  if base = '' then base := 'Player'; end if;
  cand := base;
  while exists (select 1 from public.profiles where lower(btrim(nick)) = lower(cand)) loop
    n := n + 1;
    cand := left(base, 20 - length(n::text)) || n::text;
  end loop;
  insert into public.profiles (id, nick, char_class, clan, avatar_url)
  values (
    new.id,
    cand,
    coalesce(nullif(new.raw_user_meta_data->>'char_class', ''), 'Fighter'),
    coalesce(nullif(new.raw_user_meta_data->>'clan', ''), '—'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 3) regra no banco: nick único, sem diferenciar maiúsculas/minúsculas nem espaços nas pontas
do $$
declare dups text;
begin
  select string_agg(format('%s (%s contas)', n, c), ', ') into dups
  from (select min(nick) as n, count(*) as c from public.profiles group by lower(btrim(nick)) having count(*) > 1) d;
  if dups is null then
    create unique index if not exists profiles_nick_unique on public.profiles (lower(btrim(nick)));
    raise notice 'Índice de nick único criado.';
  else
    raise warning 'Índice NÃO criado: existem nicks repetidos: %. Exclua ou renomeie os repetidos no painel e rode este arquivo de novo.', dups;
  end if;
end $$;

-- 4) excluir a conta de um usuário (só administrador; não exclui a si mesmo nem outro administrador)
create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare victim public.profiles;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if target = auth.uid() then raise exception 'cannot delete yourself'; end if;
  select * into victim from public.profiles where id = target;
  if victim.id is null then raise exception 'user not found'; end if;
  if victim.is_admin then raise exception 'cannot delete an admin'; end if;
  insert into public.admin_logs (admin_id, text) values (auth.uid(), 'Excluiu a conta: ' || victim.nick);
  -- Apaga o login; o perfil, anúncios, mensagens, builds, personagens etc. saem junto (on delete cascade).
  delete from auth.users where id = target;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
