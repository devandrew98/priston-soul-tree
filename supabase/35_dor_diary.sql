-- Diário de Dor (pristonzone.com/dor): banco privado, separado do resto do site.
-- Nenhuma tabela é acessível diretamente (RLS ligada e sem nenhuma policy): TODO acesso passa pelas funções abaixo,
-- que exigem o segredo de acesso. Só o hash (sha256) do segredo fica no banco, nunca o segredo.
-- Rode uma vez no SQL Editor do Supabase. No fim, o último SELECT mostra o seu segredo UMA vez: guarde-o.

create table if not exists public.dor_access (
  id          int primary key default 1 check (id = 1),
  secret_hash text not null,
  rotated_at  timestamptz not null default now()
);

create table if not exists public.dor_records (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('settings','crisis','intensity','symptom','med','med_admin','therapy','sleep','nopain','alert_rule')),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 20000),
  event_at   timestamptz,                       -- horário real do acontecimento (os relatórios usam este)
  version    int  not null default 1,
  created_at timestamptz not null default now(), -- quando o registro foi criado
  updated_at timestamptz not null default now(), -- última alteração
  deleted_at timestamptz                          -- lixeira (30 dias)
);
create index if not exists dor_records_kind_idx on public.dor_records (kind, event_at);

create table if not exists public.dor_history (
  seq        bigserial primary key,
  record_id  uuid not null,
  version    int  not null,
  op         text not null check (op in ('create','update','delete','restore','restore_version')),
  old_data   jsonb,
  new_data   jsonb,
  at         timestamptz not null default now()
);
create index if not exists dor_history_rec_idx on public.dor_history (record_id, version);

alter table public.dor_access  enable row level security;
alter table public.dor_records enable row level security;
alter table public.dor_history enable row level security;
revoke all on public.dor_access, public.dor_records, public.dor_history from anon, authenticated;
revoke all on sequence public.dor_history_seq_seq from anon, authenticated;

-- ---------- internas (não chamáveis de fora) ----------
create or replace function public.dor_hash(s text) returns text language sql immutable as
$$ select encode(sha256(convert_to(coalesce(s, ''), 'utf8')), 'hex') $$;

create or replace function public.dor_check(s text) returns void language plpgsql security definer set search_path = public as $$
begin
  if s is null or length(s) < 32 or not exists (select 1 from dor_access where secret_hash = dor_hash(s)) then
    perform pg_sleep(0.4);                       -- tentativa errada fica lenta
    raise exception 'acesso negado' using errcode = '42501';
  end if;
end $$;

-- Regras que não dependem da tela: o servidor recusa dados impossíveis.
create or replace function public.dor_validate(k text, d jsonb) returns void language plpgsql immutable as $$
declare n numeric;
begin
  if k = 'intensity' then
    if jsonb_typeof(d->'value') <> 'number' or (d->>'value')::numeric not between 0 and 10 or (d->>'value')::numeric <> round((d->>'value')::numeric) then
      raise exception 'intensidade deve ser inteira de 0 a 10'; end if;
  elsif k = 'crisis' then
    if (d->>'start') is null then raise exception 'crise sem início'; end if;
    if (d->>'end') is not null and (d->>'end')::timestamptz <= (d->>'start')::timestamptz then
      raise exception 'o término deve ser depois do início'; end if;
  elsif k = 'med_admin' then
    if (d->>'at') is null then raise exception 'administração sem horário'; end if;
    if jsonb_typeof(d->'quantity') <> 'number' or (d->>'quantity')::numeric <= 0 then raise exception 'quantidade inválida'; end if;
  elsif k = 'sleep' then
    if (d->>'date') is null then raise exception 'sono sem data'; end if;
    if d ? 'hours' and jsonb_typeof(d->'hours') = 'number' and (d->>'hours')::numeric not between 0 and 24 then raise exception 'horas de sono inválidas'; end if;
  elsif k = 'nopain' then
    if (d->>'date') is null then raise exception 'dia sem data'; end if;
  end if;
end $$;

create or replace function public.dor_row(r public.dor_records) returns jsonb language sql immutable as
$$ select jsonb_build_object('id', r.id, 'kind', r.kind, 'data', r.data, 'eventAt', r.event_at, 'version', r.version,
                             'createdAt', r.created_at, 'updatedAt', r.updated_at, 'deletedAt', r.deleted_at) $$;

revoke all on function public.dor_hash(text), public.dor_check(text), public.dor_validate(text, jsonb), public.dor_row(public.dor_records) from public, anon, authenticated;

-- ---------- chamadas do site ----------
-- Tudo (menos a lixeira velha, apagada aqui). Os registros são poucos: um diário pessoal.
create or replace function public.dor_list(s text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform dor_check(s);
  delete from dor_records where deleted_at is not null and deleted_at < now() - interval '30 days';
  return coalesce((select jsonb_agg(dor_row(r) order by r.event_at nulls last, r.created_at) from dor_records r), '[]'::jsonb);
end $$;

-- Cria (p_id nulo) ou altera (exige a versão que a tela viu; se mudou, devolve conflito em vez de sobrescrever).
create or replace function public.dor_save(s text, p_id uuid, p_kind text, p_data jsonb, p_event_at timestamptz, p_expected int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records; old jsonb;
begin
  perform dor_check(s);
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
  perform dor_check(s);
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
  perform dor_check(s);
  update dor_records set deleted_at = null, version = version + 1, updated_at = now() where id = p_id and deleted_at is not null returning * into r;
  if not found then raise exception 'registro não está na lixeira'; end if;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'restore', null, r.data);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

create or replace function public.dor_history(s text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform dor_check(s);
  return coalesce((select jsonb_agg(jsonb_build_object('version', h.version, 'op', h.op, 'old', h.old_data, 'new', h.new_data, 'at', h.at) order by h.seq)
                   from dor_history h where h.record_id = p_id), '[]'::jsonb);
end $$;

-- Volta o conteúdo de uma versão antiga; vira uma NOVA versão (nada é apagado do histórico).
create or replace function public.dor_restore_version(s text, p_id uuid, p_version int) returns jsonb language plpgsql security definer set search_path = public as $$
declare r dor_records; old jsonb; target jsonb;
begin
  perform dor_check(s);
  select new_data into target from dor_history where record_id = p_id and version = p_version and new_data is not null order by seq desc limit 1;
  if target is null then raise exception 'versão não encontrada'; end if;
  select * into r from dor_records where id = p_id for update;
  if not found then raise exception 'registro não existe'; end if;
  old := r.data;
  update dor_records set data = target, version = version + 1, updated_at = now(), deleted_at = null where id = p_id returning * into r;
  insert into dor_history (record_id, version, op, old_data, new_data) values (r.id, r.version, 'restore_version', old, r.data);
  return jsonb_build_object('ok', true, 'record', dor_row(r));
end $$;

-- Backup estruturado completo (registros + histórico), para baixar do site.
create or replace function public.dor_export(s text) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform dor_check(s);
  return jsonb_build_object('exportedAt', now(),
    'records', coalesce((select jsonb_agg(dor_row(r)) from dor_records r), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('recordId', h.record_id, 'version', h.version, 'op', h.op, 'old', h.old_data, 'new', h.new_data, 'at', h.at) order by h.seq) from dor_history h), '[]'::jsonb));
end $$;

-- Troca o segredo (revoga o link antigo): exige o segredo atual.
create or replace function public.dor_rotate(s text, new_secret text) returns void language plpgsql security definer set search_path = public as $$
begin
  perform dor_check(s);
  if length(coalesce(new_secret, '')) < 32 then raise exception 'segredo muito curto'; end if;
  update dor_access set secret_hash = dor_hash(new_secret), rotated_at = now() where id = 1;
end $$;

-- Só estas ficam abertas ao navegador; todas começam validando o segredo.
revoke all on function public.dor_list(text), public.dor_save(text, uuid, text, jsonb, timestamptz, int), public.dor_delete(text, uuid, int),
  public.dor_restore(text, uuid), public.dor_history(text, uuid), public.dor_restore_version(text, uuid, int), public.dor_export(text),
  public.dor_rotate(text, text) from public;
grant execute on function public.dor_list(text), public.dor_save(text, uuid, text, jsonb, timestamptz, int), public.dor_delete(text, uuid, int),
  public.dor_restore(text, uuid), public.dor_history(text, uuid), public.dor_restore_version(text, uuid, int), public.dor_export(text),
  public.dor_rotate(text, text) to anon, authenticated;

-- ---------- primeiro segredo ----------
-- Só cria se ainda não existir. O resultado abaixo mostra o link UMA vez (o banco guarda apenas o hash).
-- Se já existir e você perdeu o link, apague a linha (delete from dor_access;) e rode este bloco de novo: o link antigo deixa de valer.
create temp table if not exists dor_first_secret (link text);
delete from dor_first_secret;

do $$
declare sec text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not exists (select 1 from dor_access) then
    insert into dor_access (secret_hash) values (dor_hash(sec));
    insert into dor_first_secret values ('https://www.pristonzone.com/dor#k=' || sec);
  end if;
end $$;
select link as "SEU LINK PRIVADO (guarde, não aparece de novo)" from dor_first_secret;
