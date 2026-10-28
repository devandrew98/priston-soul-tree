-- Quest Tracker: quests oficiais, tabela de EXP por level, bônus de EXP, personagens dos jogadores e histórico administrativo.
--
-- Os dados OFICIAIS (quests, tabela de EXP, bônus, categorias, configurações) ficam separados dos dados dos jogadores (quest_characters).
-- Só as 5 categorias iniciais e os 4 bônus iniciais do briefing são criados aqui: NENHUMA quest e NENHUM valor de EXP é inventado.
-- Segurança: todos podem LER; só o administrador (is_admin) escreve, e isso é garantido aqui no banco (RLS), não na tela.
-- Rode uma vez no SQL Editor do Supabase.

-- ---------- categorias ----------
create table if not exists public.quest_categories (
  id      text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name    text not null check (char_length(name) between 1 and 60),
  sort    int  not null default 0,
  color   text not null default '',
  active  boolean not null default true,
  builtin boolean not null default false
);
insert into public.quest_categories (id, name, sort, builtin) values
  ('normal',     'Quests normais',    1, true),
  ('boss',       'Quests de bosses',  2, true),
  ('daily',      'Quests diárias',    3, true),
  ('repeatable', 'Quests repetíveis', 4, true),
  ('special',    'Quests especiais',  5, true)
on conflict (id) do nothing;

-- ---------- quests ----------
create table if not exists public.quests (
  id                    text primary key check (id ~ '^[A-Za-z0-9_.-]{1,60}$'),
  name                  text not null check (char_length(name) between 1 and 120),
  category_id           text not null references public.quest_categories(id),
  min_level             int check (min_level is null or min_level >= 1),
  max_level             int check (max_level is null or max_level >= 1),
  map                   text not null default '' check (char_length(map) <= 120),
  npc                   text not null default '' check (char_length(npc) <= 120),
  description           text not null default '' check (char_length(description) <= 4000),
  objectives            jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array' and jsonb_array_length(objectives) <= 40),
  base_exp              bigint check (base_exp is null or base_exp >= 0),
  prerequisites         text[] not null default '{}',
  repeat_type           text not null default 'once' check (repeat_type in ('once', 'repeatable', 'daily', 'interval')),
  repeat_interval_hours int check (repeat_interval_hours is null or repeat_interval_hours > 0),
  active                boolean not null default true,
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (max_level is null or min_level is null or max_level >= min_level),
  check (repeat_type <> 'interval' or repeat_interval_hours is not null)
);
create index if not exists quests_category_idx on public.quests (category_id);
create index if not exists quests_level_idx on public.quests (min_level);

-- ---------- tabela de EXP por level ----------
create table if not exists public.exp_levels (
  level  int primary key check (level >= 1),
  value  bigint not null check (value >= 0),
  active boolean not null default true
);

-- ---------- configurações (uma única linha) ----------
create table if not exists public.quest_settings (
  id                   int primary key default 1 check (id = 1),
  exp_table_mode       text not null default 'per_level' check (exp_table_mode in ('per_level', 'cumulative_start', 'cumulative_end')),
  combine_mode         text not null default 'additive' check (combine_mode in ('additive', 'multiplicative')),
  rounding             text not null default 'floor' check (rounding in ('floor', 'round', 'ceil')),
  cap_percent_per_quest numeric(8,2) check (cap_percent_per_quest is null or cap_percent_per_quest > 0),
  overflow             text not null default 'carry' check (overflow in ('carry', 'lose')),
  data_version         bigint not null default 0
);
insert into public.quest_settings (id) values (1) on conflict (id) do nothing;

-- ---------- bônus de EXP ----------
create table if not exists public.exp_bonuses (
  id         text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name       text not null check (char_length(name) between 1 and 60),
  kind       text not null default 'toggle' check (kind in ('toggle', 'manual')),
  percent    numeric(8,2) not null default 0 check (percent >= 0 and percent <= 1000),
  enabled    boolean not null default true,
  applies_to text[] not null default '{}',
  sort       int not null default 0,
  builtin    boolean not null default false
);
insert into public.exp_bonuses (id, name, kind, percent, applies_to, sort, builtin) values
  ('exp_potion',  'EXP Potion', 'toggle', 30, '{}', 1, true),
  ('world_buff',  'World Buff', 'toggle',  5, '{}', 2, true),
  ('fast_honey',  'Fast Honey', 'toggle', 10, '{}', 3, true),
  ('soul_tree',   'Soul Tree',  'manual',  0, '{}', 4, true)
on conflict (id) do nothing;

-- ---------- histórico de alterações administrativas ----------
create table if not exists public.quest_admin_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  summary    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists quest_admin_log_idx on public.quest_admin_log (created_at desc);

-- ---------- personagens e progresso dos jogadores ----------
create table if not exists public.quest_characters (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 40),
  level      int not null default 1 check (level between 1 and 999),
  exp_pct    numeric(9,6) not null default 0 check (exp_pct >= 0 and exp_pct < 100),
  bonuses    jsonb not null default '{}'::jsonb check (jsonb_typeof(bonuses) = 'object'),
  progress   jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object' and octet_length(progress::text) < 400000),
  plans      jsonb not null default '[]'::jsonb check (jsonb_typeof(plans) = 'array' and octet_length(plans::text) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quest_characters_owner_idx on public.quest_characters (owner_id);

-- ---------- gatilhos ----------
create or replace function public.quest_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists quests_touch on public.quests;
create trigger quests_touch before update on public.quests for each row execute function public.quest_touch();
drop trigger if exists quest_characters_touch on public.quest_characters;
create trigger quest_characters_touch before update on public.quest_characters for each row execute function public.quest_touch();

create or replace function public.quest_characters_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.quest_characters where owner_id = new.owner_id) >= 20 then
    raise exception 'limite de 20 personagens por conta';
  end if;
  if tg_op = 'UPDATE' then new.owner_id := old.owner_id; end if;
  return new;
end $$;
drop trigger if exists quest_characters_guard_trg on public.quest_characters;
create trigger quest_characters_guard_trg before insert or update on public.quest_characters for each row execute function public.quest_characters_guard();

-- Every change of official data bumps data_version, so saved plans know they were calculated with older data.
create or replace function public.quest_bump_version() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.quest_settings set data_version = data_version + 1 where id = 1;
  return null;
end $$;
create or replace function public.quest_settings_version() returns trigger language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return new; end if; -- the bump itself
  if (to_jsonb(new) - 'data_version') is distinct from (to_jsonb(old) - 'data_version') then
    new.data_version := old.data_version + 1;
  else
    new.data_version := old.data_version;
  end if;
  return new;
end $$;
drop trigger if exists quest_settings_version_trg on public.quest_settings;
create trigger quest_settings_version_trg before update on public.quest_settings for each row execute function public.quest_settings_version();
do $$
declare t text;
begin
  foreach t in array array['quests', 'exp_levels', 'exp_bonuses', 'quest_categories'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_bump', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each statement execute function public.quest_bump_version()', t || '_bump', t);
  end loop;
end $$;

-- Audit log of every administrative change (who, what, which record).
create or replace function public.quest_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare rec jsonb; old_rec jsonb; eid text; summ text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  eid := coalesce(rec->>'id', rec->>'level');
  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    select string_agg(k, ', ') into summ from jsonb_object_keys(rec) as k
      where (rec->k) is distinct from (old_rec->k) and k not in ('updated_at', 'data_version');
    if summ is null then return new; end if;
  end if;
  insert into public.quest_admin_log (admin_id, action, entity, entity_id, summary)
    values (auth.uid(), lower(tg_op), tg_table_name, eid, coalesce(summ, rec->>'name', ''));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['quests', 'exp_levels', 'exp_bonuses', 'quest_categories', 'quest_settings'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.quest_audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------- segurança (RLS) ----------
alter table public.quest_categories enable row level security;
alter table public.quests           enable row level security;
alter table public.exp_levels       enable row level security;
alter table public.quest_settings   enable row level security;
alter table public.exp_bonuses      enable row level security;
alter table public.quest_admin_log  enable row level security;
alter table public.quest_characters enable row level security;

-- Everybody reads what is turned on; the administrator reads everything.
drop policy if exists quest_categories_read on public.quest_categories;
create policy quest_categories_read on public.quest_categories for select using (active or public.is_admin());
drop policy if exists quests_read on public.quests;
create policy quests_read on public.quests for select using ((active and not archived) or public.is_admin());
drop policy if exists exp_levels_read on public.exp_levels;
create policy exp_levels_read on public.exp_levels for select using (active or public.is_admin());
drop policy if exists quest_settings_read on public.quest_settings;
create policy quest_settings_read on public.quest_settings for select using (true);
drop policy if exists exp_bonuses_read on public.exp_bonuses;
create policy exp_bonuses_read on public.exp_bonuses for select using (enabled or public.is_admin());

-- Only the administrator writes.
drop policy if exists quest_categories_admin on public.quest_categories;
create policy quest_categories_admin on public.quest_categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists quests_admin on public.quests;
create policy quests_admin on public.quests for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists exp_levels_admin on public.exp_levels;
create policy exp_levels_admin on public.exp_levels for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists quest_settings_admin on public.quest_settings;
create policy quest_settings_admin on public.quest_settings for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists exp_bonuses_admin on public.exp_bonuses;
create policy exp_bonuses_admin on public.exp_bonuses for all using (public.is_admin()) with check (public.is_admin());

-- The log is only read by the administrator (it is written by the triggers above).
drop policy if exists quest_admin_log_read on public.quest_admin_log;
create policy quest_admin_log_read on public.quest_admin_log for select using (public.is_admin());

-- Each player only sees and changes their own characters.
drop policy if exists quest_characters_own on public.quest_characters;
create policy quest_characters_own on public.quest_characters for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
