-- ============================================================================
-- PristonTale EU Marketplace — Postgres schema (Supabase)
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- fast ILIKE search on item names

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (own-account model; game DB not connected)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nick            text not null,
  char_class      text not null default 'Fighter',
  level           int  not null default 1,
  clan            text not null default '—',
  avatar_url      text,                         -- Supabase Storage public URL (or emoji glyph)
  verified        boolean not null default false,
  is_admin        boolean not null default false,
  is_contributor  boolean not null default false,  -- "Colaborador" seal (admin-granted)
  created_at      timestamptz not null default now(),
  last_seen       timestamptz not null default now()
);

-- Helper: is the current user an admin? (security definer to bypass RLS on read)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Helper: is the current user a contributor?
create or replace function public.is_contributor()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_contributor from public.profiles where id = auth.uid()), false);
$$;

-- Auto-create a profile when a new auth user signs up. The extra fields
-- (nick/class/clan/avatar) are passed as user metadata on signUp and copied here,
-- so profile creation never depends on client-side session timing.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nick, char_class, clan, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nick', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'char_class', ''), 'Fighter'),
    coalesce(nullif(new.raw_user_meta_data->>'clan', ''), '—'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  item_level   int  not null default 1,
  image_url    text not null,                    -- required item image
  category     text not null,
  subcategory  text not null default '',
  rarity       text not null default 'rare' check (rarity in ('common','rare','epic','legendary')),
  quantity     int  not null default 1 check (quantity >= 1),
  price        bigint not null default 0 check (price >= 0),
  currency     text not null default 'gold' check (currency in ('gold','coins')),
  description  text not null default '',
  status       text not null default 'available' check (status in ('available','reserved','sold')),
  highlighted  boolean not null default false,
  removed      boolean not null default false,   -- moderator soft-delete
  views        int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists listings_category_idx on public.listings(category);
create index if not exists listings_seller_idx   on public.listings(seller_id);
create index if not exists listings_status_idx   on public.listings(status);
create index if not exists listings_created_idx  on public.listings(created_at desc);
create index if not exists listings_name_trgm    on public.listings using gin (name gin_trgm_ops);

-- completed sales (drives price history + market stats)
create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid references public.listings(id) on delete set null,
  category    text not null,
  name        text not null,
  price       bigint not null,
  currency    text not null default 'gold',
  sold_at     timestamptz not null default now()
);
create index if not exists sales_category_idx on public.sales(category);
create index if not exists sales_soldat_idx   on public.sales(sold_at desc);

-- ---------------------------------------------------------------------------
-- favorites / watched sellers / wishlist
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.fav_sellers (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  primary key (user_id, seller_id)
);

create table if not exists public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null,
  max_price  bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- conversations + messages (chat). One conversation per (buyer, seller) pair.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, seller_id)
);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- reviews / reports / notifications
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  stars      int  not null check (stars between 1 and 5),
  tags       text[] not null default '{}',
  comment    text not null default '',
  created_at timestamptz not null default now(),
  unique (seller_id, author_id)
);

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('item','user')),
  target_id    text not null,
  reason       text not null,
  note         text not null default '',
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at   timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  params     jsonb not null default '{}',
  link       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- public seller view (aggregates for profile cards / rankings)
-- ---------------------------------------------------------------------------
create or replace view public.seller_public as
  select
    p.id, p.nick, p.char_class, p.level, p.clan, p.avatar_url,
    p.verified, p.is_contributor, p.created_at, p.last_seen,
    coalesce(r.rating_avg, 0)          as rating_avg,
    coalesce(r.rating_count, 0)        as rating_count,
    coalesce(l.active_listings, 0)     as active_listings,
    coalesce(s.items_sold, 0)          as items_sold,
    coalesce(s.total_sales_value, 0)   as total_sales_value
  from public.profiles p
  left join (
    select seller_id, round(avg(stars)::numeric, 1) as rating_avg, count(*) as rating_count
    from public.reviews group by seller_id
  ) r on r.seller_id = p.id
  left join (
    select seller_id, count(*) as active_listings
    from public.listings where status = 'available' and not removed group by seller_id
  ) l on l.seller_id = p.id
  left join (
    select li.seller_id, count(*) as items_sold, sum(sa.price) as total_sales_value
    from public.sales sa join public.listings li on li.id = sa.listing_id
    group by li.seller_id
  ) s on s.seller_id = p.id;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.listings      enable row level security;
alter table public.sales         enable row level security;
alter table public.favorites     enable row level security;
alter table public.fav_sellers   enable row level security;
alter table public.wishlist      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.reviews       enable row level security;
alter table public.reports       enable row level security;
alter table public.notifications enable row level security;

-- profiles: world-readable; you may edit only your own (admins may edit any)
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- listings: visible when not removed (owner + admin always); write by owner/admin
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (not removed or seller_id = auth.uid() or public.is_admin());
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert with check (seller_id = auth.uid());
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update using (seller_id = auth.uid() or public.is_admin());
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete using (seller_id = auth.uid() or public.is_admin());

-- sales: world-readable (for stats); inserts via service role / server only
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select using (true);

-- favorites / fav_sellers / wishlist / notifications: owner only
drop policy if exists favorites_all on public.favorites;
create policy favorites_all on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists favsellers_all on public.fav_sellers;
create policy favsellers_all on public.fav_sellers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists wishlist_all on public.wishlist;
create policy wishlist_all on public.wishlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_rw on public.notifications;
create policy notifications_rw on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- conversations: only the two participants
drop policy if exists conversations_rw on public.conversations;
create policy conversations_rw on public.conversations for all
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

-- messages: only participants of the parent conversation
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id
          and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversations c where c.id = conversation_id
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update using (
  exists (select 1 from public.conversations c where c.id = conversation_id
          and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));

-- reviews: world-readable; authored by the logged-in user
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert with check (author_id = auth.uid());

-- reports: anyone logged in can file; only admins can read/update
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select using (public.is_admin());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update using (public.is_admin());

-- ============================================================================
-- Storage buckets (run once). Public read; authed users upload to their folder.
-- ============================================================================
insert into storage.buckets (id, name, public) values ('item-images', 'item-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select
  using (bucket_id in ('item-images','avatars'));
drop policy if exists "authed upload images" on storage.objects;
create policy "authed upload images" on storage.objects for insert to authenticated
  with check (bucket_id in ('item-images','avatars'));

-- ============================================================================
-- Realtime — stream new chat messages to participants (RLS-filtered).
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============================================================================
-- Notification triggers — create notifications server-side (bypass RLS safely).
-- ============================================================================
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  sender_nick text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
    into recipient from public.conversations c where c.id = new.conversation_id;
  if recipient is null or recipient = new.sender_id then return new; end if;
  select nick into sender_nick from public.profiles where id = new.sender_id;
  insert into public.notifications (user_id, type, params, link)
  values (recipient, 'message', jsonb_build_object('nick', coalesce(sender_nick, '?')),
          jsonb_build_object('kind', 'messages'));
  return new;
end;
$$;
drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert after insert on public.messages
  for each row execute function public.notify_new_message();

create or replace function public.notify_new_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, params, link)
  values (new.seller_id, 'review', jsonb_build_object('stars', new.stars),
          jsonb_build_object('kind', 'seller', 'id', new.seller_id::text));
  return new;
end;
$$;
drop trigger if exists on_review_insert on public.reviews;
create trigger on_review_insert after insert on public.reviews
  for each row execute function public.notify_new_review();

-- ============================================================================
-- Admin / moderation (Phase 7)
-- ============================================================================
alter table public.profiles add column if not exists banned    boolean not null default false;
alter table public.profiles add column if not exists suspended boolean not null default false;

create table if not exists public.admin_logs (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references public.profiles(id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_logs(created_at desc);
alter table public.admin_logs enable row level security;
drop policy if exists admin_logs_rw on public.admin_logs;
create policy admin_logs_rw on public.admin_logs for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_broadcast(message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.notifications (user_id, type, params, link)
  select p.id, 'global', jsonb_build_object('text', message), null from public.profiles p;
end;
$$;

-- ============================================================================
-- Sales recording (Phase 8) — a completed sale feeds price history + stats.
-- ============================================================================
create or replace function public.record_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    insert into public.sales (listing_id, category, name, price, currency)
    values (new.id, new.category, new.name, new.price, new.currency);
  end if;
  return new;
end;
$$;
drop trigger if exists on_listing_sold on public.listings;
create trigger on_listing_sold after update on public.listings
  for each row execute function public.record_sale();

-- Fase 8.1 — contagem de visualizacoes (ver supabase/06_views.sql)
create or replace function public.increment_listing_views(lid uuid)
returns void language sql security definer set search_path = public as $func$
  update public.listings set views = views + 1 where id = lid and removed = false;
$func$;
grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

-- Fase 9 — limites antifraude / antispam (ver supabase/07_limits.sql)
-- 1) Anúncios: teto de anúncios ativos por conta + limite de criação por hora.
create or replace function public.enforce_listing_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare active_count int; recent_count int;
begin
  select count(*) into active_count from public.listings
    where seller_id = new.seller_id and removed = false and status in ('available','reserved');
  if active_count >= 30 then
    raise exception 'limit_active_listings';
  end if;
  select count(*) into recent_count from public.listings
    where seller_id = new.seller_id and created_at > now() - interval '1 hour';
  if recent_count >= 15 then
    raise exception 'limit_rate_listings';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_listing_limits on public.listings;
create trigger trg_listing_limits before insert on public.listings
  for each row execute function public.enforce_listing_limits();

-- 2) Mensagens: no máximo 20 por minuto por remetente (anti-flood no chat).
create or replace function public.enforce_message_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'limit_rate_messages';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_message_rate on public.messages;
create trigger trg_message_rate before insert on public.messages
  for each row execute function public.enforce_message_rate();

-- 3) Denúncias: no máximo 10 por hora por usuário + impede denúncia duplicada em aberto.
create or replace function public.enforce_report_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'limit_rate_reports';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_report_rate on public.reports;
create trigger trg_report_rate before insert on public.reports
  for each row execute function public.enforce_report_rate();

create unique index if not exists reports_unique_open
  on public.reports (reporter_id, target_type, target_id) where status = 'open';

-- ============================================================================
-- Fase 10 — Streamers (ver supabase/08_streamers.sql; detecção via Edge Function)
-- ============================================================================
-- Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.streamers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  platform        text not null check (platform in ('twitch','youtube')),
  handle          text not null,               -- twitch login, ou @handle / UC... do YouTube
  url             text not null default '',    -- link do canal (opcional; se vazio é derivado do handle)
  cover_url       text not null default '',    -- imagem quadrada de capa (upload no painel)
  live            boolean not null default false,
  viewers         int not null default 0,
  title           text not null default '',    -- título da live (preenchido pela detecção)
  sort            int not null default 0,       -- ordem de exibição
  live_checked_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists streamers_live_idx on public.streamers(live, sort);

alter table public.streamers enable row level security;
drop policy if exists streamers_read on public.streamers;
create policy streamers_read on public.streamers for select using (true);           -- todos veem
drop policy if exists streamers_admin_all on public.streamers;
create policy streamers_admin_all on public.streamers for all
  using (public.is_admin()) with check (public.is_admin());                          -- só admin edita

-- ---------------------------------------------------------------------------
-- Storage: bucket para as capas (leitura pública, upload autenticado)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('streamer-covers', 'streamer-covers', true)
  on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select
  using (bucket_id in ('item-images','avatars','streamer-covers'));
drop policy if exists "authed upload images" on storage.objects;
create policy "authed upload images" on storage.objects for insert to authenticated
  with check (bucket_id in ('item-images','avatars','streamer-covers'));

-- ---------------------------------------------------------------------------
-- Detecção automática (agendamento) — rode DEPOIS de publicar a Edge Function

-- ============================================================================
-- Fase 11 — categorias de reputacao editaveis + cargo manual (ver 09_rep_tiers.sql)
-- ============================================================================
-- Categorias (tiers). `base` controla o "tipo" visual (bronze/prata/ouro/...).
create table if not exists public.rep_tiers (
  key        text primary key,
  label      text not null,
  base       text not null default 'bronze' check (base in ('bronze','silver','gold','diamond','legendary')),
  icon       text not null default '🥉',
  color      text not null default '#cd7f32',
  min_sold   int  not null default 0,   -- itens vendidos p/ alcançar (modo automático)
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.rep_tiers enable row level security;
drop policy if exists rep_tiers_read on public.rep_tiers;
create policy rep_tiers_read on public.rep_tiers for select using (true);          -- todos veem
drop policy if exists rep_tiers_admin on public.rep_tiers;
create policy rep_tiers_admin on public.rep_tiers for all
  using (public.is_admin()) with check (public.is_admin());                         -- só admin edita

-- Semear as 5 categorias atuais (idempotente).
insert into public.rep_tiers (key,label,base,icon,color,min_sold,sort) values
  ('bronze',    'Hopy',        'bronze',    '🥉', '#cd7f32', 0,   0),
  ('silver',    'Bargon',      'silver',    '🥈', '#c0c0c0', 25,  1),
  ('gold',      'Head Cutter', 'gold',      '🥇', '#e6b93b', 100, 2),
  ('diamond',   'Groqueste',   'diamond',   '💎', '#5ad6d0', 300, 3),
  ('legendary', 'Babel',       'legendary', '👑', '#e0663b', 800, 4)
on conflict (key) do nothing;

-- Cargo manual: quando preenchido, força a categoria do membro (ignora o cálculo
-- automático por itens vendidos). NULL = automático.
alter table public.profiles add column if not exists rep_tier_override text;

-- ============================================================================
-- Fase 12 — Noticias / Eventos na Home (ver 10_news.sql)
-- ============================================================================
create table if not exists public.news (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  kind       text not null default 'news' check (kind in ('news','event','maintenance')),
  pinned     boolean not null default false,
  published  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news enable row level security;
drop policy if exists news_read on public.news;
create policy news_read on public.news for select using (published or public.is_admin()); -- público vê publicadas
drop policy if exists news_write on public.news;
create policy news_write on public.news for all
  using (public.is_admin()) with check (public.is_admin());                                -- só admin edita

-- Fase 13 — moderacao de usuarios (ver 11_user_moderation.sql)
alter table public.profiles add column if not exists ban_reason text;

-- ============================================================================
-- Fase 14 — categorias (tipos de item) do marketplace (ver 12_market_categories.sql)
-- ============================================================================
create table if not exists public.market_categories (
  key       text primary key,
  icon      text not null default '📦',
  label_pt  text not null,
  label_en  text not null,
  subs      text[] not null default '{}',
  sort      int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.market_categories enable row level security;
drop policy if exists market_categories_read on public.market_categories;
create policy market_categories_read on public.market_categories for select using (true);   -- todos veem
drop policy if exists market_categories_admin on public.market_categories;
create policy market_categories_admin on public.market_categories for all
  using (public.is_admin()) with check (public.is_admin());                                    -- só admin edita

-- Semear as categorias atuais (idempotente).
insert into public.market_categories (key,icon,label_pt,label_en,subs,sort) values
  ('weapons','⚔️','Armas','Weapons', array['Espadas','Machados','Arcos','Garras','Adagas','Martelos','Lanças','Fantasmas','Foices','Varinhas','Cajados'], 0),
  ('armors','🛡️','Armaduras','Armors', array['Armaduras','Roupões','Orbes','Escudos','Botas','Luvas','Braceletes'], 1),
  ('jewels','💍','Jóias','Jewelry', array['Anéis','Amuletos'], 2),
  ('sheltoms','💠','Sheltoms','Sheltoms', array[]::text[], 3),
  ('souls','✨','Souls','Souls', array[]::text[], 4),
  ('pets','🐾','Pets','Pets', array[]::text[], 5),
  ('premium','👑','Premiums','Premiums', array[]::text[], 6)
on conflict (key) do nothing;

-- ============================================================================
-- Fase 15 — noticias/eventos bilingues PT/EN (ver 13_news_i18n.sql)
-- ============================================================================

alter table public.news add column if not exists title_pt text not null default '';
alter table public.news add column if not exists title_en text not null default '';
alter table public.news add column if not exists body_pt  text not null default '';
alter table public.news add column if not exists body_en  text not null default '';

-- Preenche as novas colunas com o texto que já existia (mesmo valor nos dois
-- idiomas até o admin editar cada um separadamente).
update public.news set title_pt = title, title_en = title where title_pt = '' and title is not null;
update public.news set body_pt = body, body_en = body where body_pt = '' and body is not null;

alter table public.news drop column if exists title;
alter table public.news drop column if exists body;

-- ============================================================================
-- Fase 16 — Guias em video por categoria (ver 14_guides.sql)
-- ============================================================================
create table if not exists public.guide_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.guides (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.guide_categories(id) on delete cascade,
  title       text not null default '',
  youtube_url text not null,
  video_id    text not null,          -- extraído do link; usado pra capa/embed
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists guides_category_idx on public.guides(category_id, sort);

alter table public.guide_categories enable row level security;
drop policy if exists guide_categories_read on public.guide_categories;
create policy guide_categories_read on public.guide_categories for select using (true);
drop policy if exists guide_categories_admin on public.guide_categories;
create policy guide_categories_admin on public.guide_categories for all
  using (public.is_admin()) with check (public.is_admin());


-- ============================================================================
-- Fase 17 — localizacao da loja in-game do anuncio (ver 15_shop_location.sql)
-- ============================================================================
alter table public.listings add column if not exists shop_city text
  check (shop_city is null or shop_city in ('ricarten','pillai'));
alter table public.listings add column if not exists shop_x real;
alter table public.listings add column if not exists shop_y real;

-- ============================================================================
-- Fase 18 — contato do vendedor pelo WhatsApp (ver 16_whatsapp.sql)
-- ============================================================================
-- Flag público no anúncio.
alter table public.listings add column if not exists whatsapp_enabled boolean not null default false;

-- Número por anúncio (protegido — só o vendedor dono).
create table if not exists public.listing_whatsapp (
  listing_id   uuid primary key references public.listings(id) on delete cascade,
  number       text not null,               -- só dígitos nacionais, ex.: 11999999999
  country_code text not null default '55',
  consent      boolean not null default false,
  consent_date timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.listing_whatsapp enable row level security;
drop policy if exists lw_owner_all on public.listing_whatsapp;
create policy lw_owner_all on public.listing_whatsapp for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Número padrão do perfil (protegido — só o dono).
create table if not exists public.user_whatsapp (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  number       text not null,
  country_code text not null default '55',
  verified     boolean not null default false,
  consent      boolean not null default false,
  updated_at   timestamptz not null default now()
);
alter table public.user_whatsapp enable row level security;
drop policy if exists uw_owner_all on public.user_whatsapp;
create policy uw_owner_all on public.user_whatsapp for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro de interesse. O comprador vê os seus; o vendedor vê os dos seus anúncios.
create table if not exists public.interests (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  reason     text not null default 'buy',
  message    text not null default '',
  channel    text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)   -- interesses repetidos não duplicam registros
);
create index if not exists interests_seller_idx on public.interests(seller_id, created_at desc);
create index if not exists interests_buyer_idx on public.interests(buyer_id, created_at desc);
alter table public.interests enable row level security;
drop policy if exists interests_read on public.interests;
create policy interests_read on public.interests for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());
-- Sem policy de INSERT: clientes não inserem direto; só via a RPC (security definer).

-- RPC: valida tudo, registra o interesse e devolve o número completo do vendedor.
create or replace function public.whatsapp_contact(p_listing_id uuid, p_reason text, p_message text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; w record; uid uuid := auth.uid(); recent int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into l from public.listings where id = p_listing_id;
  if not found or l.removed then raise exception 'unavailable'; end if;
  if l.status = 'sold' then raise exception 'sold'; end if;
  if l.seller_id = uid then raise exception 'own_listing'; end if;
  if not l.whatsapp_enabled then raise exception 'no_whatsapp'; end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.banned) then raise exception 'blocked'; end if;
  select * into w from public.listing_whatsapp where listing_id = p_listing_id;
  if not found or w.number is null or length(w.number) < 8 or not w.consent then raise exception 'no_whatsapp'; end if;
  -- limite anti-spam: no máx 20 contatos por hora por comprador.
  select count(*) into recent from public.interests where buyer_id = uid and created_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'limit_rate_contacts'; end if;
  insert into public.interests (listing_id, buyer_id, seller_id, reason, message)
  values (p_listing_id, uid, l.seller_id, coalesce(nullif(p_reason,''),'buy'), coalesce(p_message,''))
  on conflict (listing_id, buyer_id) do update set reason = excluded.reason, message = excluded.message, created_at = now();
  return jsonb_build_object('number', w.country_code || w.number);
end;
$$;
grant execute on function public.whatsapp_contact(uuid, text, text) to authenticated;
