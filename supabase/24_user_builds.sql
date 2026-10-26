-- "Minhas builds" + community gallery (Skills and Souls builds saved to an account).
--
--  * user_builds : one row per saved build. The build itself is the same compact code the share
--                  links already use (`payload`), so opening one just goes through the existing,
--                  already-sanitizing loaders. Private by default; the owner can make it public.
--  * build_likes : one row per (build, user). likes_count is kept in sync by triggers and can't be
--                  edited by hand.
--
-- Run once in the Supabase SQL editor. Until then the site simply says the feature isn't available.

create table if not exists public.user_builds (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('skills', 'souls')),
  name        text not null check (char_length(name) between 1 and 60),
  class_slug  text check (class_slug is null or class_slug in
              ('fighter','archer','mechanician','assassin','pikeman','knight','shaman','priestess','magician','atalanta')),
  level       int check (level is null or level between 1 and 120),
  payload     text not null check (char_length(payload) between 1 and 8000),
  summary     text not null default '' check (char_length(summary) <= 120),
  is_public   boolean not null default false,
  likes_count int not null default 0 check (likes_count >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists user_builds_owner_idx on public.user_builds (owner_id, kind, updated_at desc);
create index if not exists user_builds_gallery_idx on public.user_builds (kind, is_public, likes_count desc, created_at desc);

alter table public.user_builds enable row level security;
drop policy if exists user_builds_read on public.user_builds;
create policy user_builds_read on public.user_builds for select
  using (is_public or owner_id = auth.uid() or public.is_admin());
drop policy if exists user_builds_insert on public.user_builds;
create policy user_builds_insert on public.user_builds for insert with check (owner_id = auth.uid());
drop policy if exists user_builds_update on public.user_builds;
create policy user_builds_update on public.user_builds for update
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists user_builds_delete on public.user_builds;
create policy user_builds_delete on public.user_builds for delete
  using (owner_id = auth.uid() or public.is_admin());

-- Guard rails: at most 40 builds per account, and nobody edits likes_count or ownership directly.
create or replace function public.user_builds_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.user_builds where owner_id = new.owner_id) >= 40 then
      raise exception 'build limit reached (40 per account)';
    end if;
    new.likes_count := 0;
  else
    new.owner_id := old.owner_id;
    -- Only the likes trigger (nested, depth > 1) may change the counter.
    if pg_trigger_depth() = 1 then new.likes_count := old.likes_count; end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists user_builds_guard_trg on public.user_builds;
create trigger user_builds_guard_trg before insert or update on public.user_builds
  for each row execute function public.user_builds_guard();

create table if not exists public.build_likes (
  build_id   uuid not null references public.user_builds(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
alter table public.build_likes enable row level security;
-- You only ever see your own likes (the gallery shows counts, not who liked).
drop policy if exists build_likes_read on public.build_likes;
create policy build_likes_read on public.build_likes for select using (user_id = auth.uid());
drop policy if exists build_likes_insert on public.build_likes;
create policy build_likes_insert on public.build_likes for insert
  with check (user_id = auth.uid() and exists (select 1 from public.user_builds b where b.id = build_id and b.is_public));
drop policy if exists build_likes_delete on public.build_likes;
create policy build_likes_delete on public.build_likes for delete using (user_id = auth.uid());

create or replace function public.build_likes_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.user_builds set likes_count = likes_count + 1 where id = new.build_id;
  else
    update public.user_builds set likes_count = greatest(likes_count - 1, 0) where id = old.build_id;
  end if;
  return null;
end $$;
drop trigger if exists build_likes_count_trg on public.build_likes;
create trigger build_likes_count_trg after insert or delete on public.build_likes
  for each row execute function public.build_likes_count();
