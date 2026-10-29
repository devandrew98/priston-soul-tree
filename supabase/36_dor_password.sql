-- Diário de Dor: acesso por SENHA em vez de link longo, com bloqueio contra tentativas repetidas.
-- O navegador transforma a senha numa chave (PBKDF2, 200 mil voltas) e só a chave chega ao banco; aqui fica o hash dela.
-- Depois de rodar este arquivo, defina a senha com o comando que o Claude passou no chat (ele contém só a chave derivada, nunca a senha).
-- Errar a senha 8 vezes em 15 minutos bloqueia novas tentativas por 15 minutos (inclusive as certas).

create table if not exists public.dor_fail (at timestamptz not null default now());
alter table public.dor_fail enable row level security;
revoke all on public.dor_fail from anon, authenticated;

drop function if exists public.dor_check(text);
drop function if exists public.dor_rotate(text, text);

-- Não levanta erro quando a senha está errada (um erro desfaria o registro da tentativa): devolve falso.
create or replace function public.dor_check(s text) returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  delete from dor_fail where at < now() - interval '1 day';
  if (select count(*) from dor_fail where at > now() - interval '15 minutes') >= 8 then
    perform pg_sleep(0.4); return false;
  end if;
  ok := s is not null and length(s) >= 32 and exists (select 1 from dor_access where secret_hash = dor_hash(s));
  if not ok then insert into dor_fail default values; perform pg_sleep(0.4); end if;
  return ok;
end $$;
revoke all on function public.dor_check(text) from public, anon, authenticated;

create or replace function public.dor_list(s text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  delete from dor_records where deleted_at is not null and deleted_at < now() - interval '30 days';
  return coalesce((select jsonb_agg(dor_row(r) order by r.event_at nulls last, r.created_at) from dor_records r), '[]'::jsonb);
end $$;

create or replace function public.dor_save(s text, p_id uuid, p_kind text, p_data jsonb, p_event_at timestamptz, p_expected int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records; old jsonb;
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  perform dor_validate(p_kind, p_data);
  if p_id is null then
    insert into dor_records (kind, data, event_at) values (p_kind, p_data, p_event_at) returning * into r;
    insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, 1, 'create', null, r.data);
    return jsonb_build_object('ok', true, 'record', dor_row(r));
  end if;
  select * into r from dor_records where id = p_id for update;
  if not found then raise exception 'registro não existe'; end if;
  if r.kind <> p_kind then raise exception 'tipo não pode mudar'; end if;
  if r.version <> p_expected then return jsonb_build_object('ok', false, 'conflict', true, 'record', dor_row(r)); end if;
  old := r.data;
  update dor_records set data = p_data, event_at = p_event_at, version = version + 1, updated_at = now() where id = p_id returning * into r;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'update', old, r.data);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

create or replace function public.dor_delete(s text, p_id uuid, p_expected int) returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records;
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  select * into r from dor_records where id = p_id for update;
  if not found then raise exception 'registro não existe'; end if;
  if r.version <> p_expected then return jsonb_build_object('ok', false, 'conflict', true, 'record', dor_row(r)); end if;
  update dor_records set deleted_at = now(), version = version + 1, updated_at = now() where id = p_id returning * into r;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'delete', r.data, null);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

create or replace function public.dor_restore(s text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records;
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  update dor_records set deleted_at = null, version = version + 1, updated_at = now() where id = p_id and deleted_at is not null returning * into r;
  if not found then raise exception 'registro não está na lixeira'; end if;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'restore', null, r.data);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

create or replace function public.dor_history(s text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('version', h.version, 'op', h.op, 'old', h.old_data, 'new', h.new_data, 'at', h.at) order by h.seq)
                   from dor_history h where h.record_id = p_id), '[]'::jsonb);
end $$;

create or replace function public.dor_restore_version(s text, p_id uuid, p_version int) returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records; old jsonb; target jsonb;
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  select new_data into target from dor_history where record_id = p_id and version = p_version and new_data is not null order by seq desc limit 1;
  if target is null then raise exception 'versão não encontrada'; end if;
  select * into r from dor_records where id = p_id for update;
  if not found then raise exception 'registro não existe'; end if;
  old := r.data;
  update dor_records set data = target, version = version + 1, updated_at = now(), deleted_at = null where id = p_id returning * into r;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'restore_version', old, r.data);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

create or replace function public.dor_export(s text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  return jsonb_build_object('exportedAt', now(),
    'records', coalesce((select jsonb_agg(dor_row(r)) from dor_records r), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('recordId', h.record_id, 'version', h.version, 'op', h.op, 'old', h.old_data, 'new', h.new_data, 'at', h.at) order by h.seq) from dor_history h), '[]'::jsonb));
end $$;

-- Troca a senha: exige a atual. new_secret é a chave derivada da nova senha (64 caracteres), nunca a senha em si.
create or replace function public.dor_rotate(s text, new_secret text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not dor_check(s) then return jsonb_build_object('denied', true); end if;
  if length(coalesce(new_secret, '')) < 32 then raise exception 'chave inválida'; end if;
  update dor_access set secret_hash = dor_hash(new_secret), rotated_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.dor_list(text), public.dor_save(text, uuid, text, jsonb, timestamptz, int), public.dor_delete(text, uuid, int),
  public.dor_restore(text, uuid), public.dor_history(text, uuid), public.dor_restore_version(text, uuid, int), public.dor_export(text),
  public.dor_rotate(text, text) from public;
grant execute on function public.dor_list(text), public.dor_save(text, uuid, text, jsonb, timestamptz, int), public.dor_delete(text, uuid, int),
  public.dor_restore(text, uuid), public.dor_history(text, uuid), public.dor_restore_version(text, uuid, int), public.dor_export(text),
  public.dor_rotate(text, text) to anon, authenticated;
