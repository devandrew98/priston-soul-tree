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
