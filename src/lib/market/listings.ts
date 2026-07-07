// DB data layer for listings (Supabase). Maps Postgres rows <-> the Listing type
// the UI already uses, embeds the seller profile and warms the profile cache.
import { supabase } from './supabase';
import { CATEGORIES } from './data';
import { cacheProfiles } from './profileCache';
import { profileToSeller, type ProfileRow, uploadToBucket } from './auth';
import type { Currency, Listing, Rarity } from './types';
import type { Filters, SortKey } from './helpers';

const CAT_ICON: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));

// Embed the seller profile so cards can show nick/avatar/contributor.
const SELECT =
  '*, seller:profiles!seller_id(id,nick,char_class,level,clan,avatar_url,verified,is_admin,is_contributor,created_at,last_seen)';

interface ListingRow {
  id: string;
  seller_id: string;
  name: string;
  item_level: number;
  image_url: string;
  category: string;
  subcategory: string;
  rarity: Rarity;
  quantity: number;
  price: number | string;
  currency: Currency;
  description: string;
  status: Listing['status'];
  highlighted: boolean;
  views: number;
  created_at: string;
  seller?: ProfileRow | null;
}

function rowToListing(row: ListingRow): Listing {
  if (row.seller) {
    const seller = profileToSeller(row.seller);
    cacheProfiles([seller], row.seller.is_contributor ? [row.seller.id] : []);
  }
  return {
    id: row.id,
    name: row.name,
    itemLevel: row.item_level,
    icon: CAT_ICON[row.category] || '📦',
    image: row.image_url,
    category: row.category,
    subcategory: row.subcategory,
    rarity: row.rarity,
    tier: 0,
    sockets: 0,
    classReq: 'Todas',
    stats: [],
    quantity: row.quantity,
    price: Number(row.price),
    currency: row.currency,
    description: row.description,
    status: row.status,
    highlighted: row.highlighted,
    sellerId: row.seller_id,
    views: row.views,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

const SORT_COL: Record<SortKey, { col: string; asc: boolean }> = {
  price_asc: { col: 'price', asc: true },
  price_desc: { col: 'price', asc: false },
  newest: { col: 'created_at', asc: false },
  oldest: { col: 'created_at', asc: true },
  views: { col: 'views', asc: false },
  rating: { col: 'created_at', asc: false }, // seller rating sort → refined in a later phase
  sold: { col: 'created_at', asc: false },
};

/** Vitrine query: server-side filters + sort. */
export async function fetchListings(f: Filters, sort: SortKey, limit = 60): Promise<Listing[]> {
  let q = sb().from('listings').select(SELECT).eq('removed', false);
  if (f.q.trim()) q = q.ilike('name', `%${f.q.trim()}%`);
  if (f.category) q = q.eq('category', f.category);
  if (f.rarity) q = q.eq('rarity', f.rarity);
  if (f.minLevel) q = q.gte('item_level', f.minLevel);
  if (f.minPrice != null) q = q.gte('price', f.minPrice);
  if (f.maxPrice != null) q = q.lte('price', f.maxPrice);
  if (f.seller) q = q.eq('seller_id', f.seller);
  if (f.highlightedOnly) q = q.eq('highlighted', true);
  const s = SORT_COL[sort];
  q = q.order(s.col, { ascending: s.asc }).limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as ListingRow[]).map(rowToListing);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await sb().from('listings').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data as ListingRow) : null;
}

export async function fetchSellerListings(sellerId: string): Promise<Listing[]> {
  const { data, error } = await sb().from('listings').select(SELECT).eq('seller_id', sellerId).eq('removed', false).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ListingRow[]).map(rowToListing);
}

export async function fetchSimilar(listing: Listing, limit = 4): Promise<Listing[]> {
  const { data, error } = await sb().from('listings').select(SELECT)
    .eq('category', listing.category).eq('removed', false).neq('id', listing.id).limit(limit + 2);
  if (error) throw error;
  return (data as ListingRow[]).map(rowToListing).slice(0, limit);
}

export interface NewListingInput {
  name: string;
  itemLevel: number;
  category: string;
  subcategory: string;
  rarity: Rarity;
  quantity: number;
  price: number;
  currency: Currency;
  description: string;
  highlighted: boolean;
  imageFile: File;
}

/** Upload the item image then insert the listing; returns the created id. */
export async function createListing(userId: string, input: NewListingInput): Promise<string> {
  const imageUrl = await uploadToBucket('item-images', userId, input.imageFile);
  const { data, error } = await sb().from('listings').insert({
    seller_id: userId,
    name: input.name,
    item_level: input.itemLevel,
    image_url: imageUrl,
    category: input.category,
    subcategory: input.subcategory,
    rarity: input.rarity,
    quantity: input.quantity,
    price: input.price,
    currency: input.currency,
    description: input.description,
    highlighted: input.highlighted,
  }).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await sb().from('listings').delete().eq('id', id);
  if (error) throw error;
}

export async function setListingStatus(id: string, status: Listing['status']): Promise<void> {
  const { error } = await sb().from('listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
