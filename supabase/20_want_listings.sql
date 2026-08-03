-- Marketplace "want to buy" posts: same listings table, split by `kind`.
-- Reuses everything (reputation, categories, reports, WhatsApp contact,
-- chat, admin moderation) — only the UI adapts labels per kind.
alter table public.listings add column if not exists kind text not null default 'sell' check (kind in ('sell', 'want'));
alter table public.listings alter column image_url drop not null; -- optional for 'want' posts
create index if not exists listings_kind_idx on public.listings(kind);

-- Only real sales (kind='sell') feed the sales table / price stats — a "want"
-- post being marked found isn't a market transaction.
create or replace function public.record_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') and new.kind = 'sell' then
    insert into public.sales (listing_id, category, name, price, currency)
    values (new.id, new.category, new.name, new.price, new.currency);
  end if;
  return new;
end;
$$;
