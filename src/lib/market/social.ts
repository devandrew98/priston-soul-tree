// DB data layer for per-user social features (Phase 4): favorites, watched
// sellers, wishlist and reviews/reputation. Used when BACKEND_ENABLED.
import { supabase } from './supabase';
import type { Review } from './types';

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

export interface WishRow {
  id: string;
  text: string;
  maxPrice: number | null;
  createdAt: number;
}

// ---- favorites (items) -------------------------------------------------------
export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await sb().from('favorites').select('listing_id').eq('user_id', userId);
  if (error) throw error;
  return (data as { listing_id: string }[]).map((r) => r.listing_id);
}

export async function addFavorite(userId: string, listingId: string): Promise<void> {
  const { error } = await sb().from('favorites').insert({ user_id: userId, listing_id: listingId });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  const { error } = await sb().from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
  if (error) throw error;
}

// ---- watched sellers ---------------------------------------------------------
export async function fetchFavSellerIds(userId: string): Promise<string[]> {
  const { data, error } = await sb().from('fav_sellers').select('seller_id').eq('user_id', userId);
  if (error) throw error;
  return (data as { seller_id: string }[]).map((r) => r.seller_id);
}

export async function addFavSeller(userId: string, sellerId: string): Promise<void> {
  const { error } = await sb().from('fav_sellers').insert({ user_id: userId, seller_id: sellerId });
  if (error && error.code !== '23505') throw error;
}

export async function removeFavSeller(userId: string, sellerId: string): Promise<void> {
  const { error } = await sb().from('fav_sellers').delete().eq('user_id', userId).eq('seller_id', sellerId);
  if (error) throw error;
}

// ---- wishlist ----------------------------------------------------------------
export async function fetchWishlist(userId: string): Promise<WishRow[]> {
  const { data, error } = await sb().from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as { id: string; text: string; max_price: number | null; created_at: string }[]).map((r) => ({
    id: r.id, text: r.text, maxPrice: r.max_price, createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function addWish(userId: string, text: string, maxPrice: number | null): Promise<void> {
  const { error } = await sb().from('wishlist').insert({ user_id: userId, text, max_price: maxPrice });
  if (error) throw error;
}

export async function removeWish(id: string): Promise<void> {
  const { error } = await sb().from('wishlist').delete().eq('id', id);
  if (error) throw error;
}

// ---- reviews / reputation ----------------------------------------------------
export async function fetchReviews(sellerId: string): Promise<Review[]> {
  const { data, error } = await sb()
    .from('reviews')
    .select('id,stars,tags,comment,created_at, author:profiles!author_id(nick,avatar_url)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as {
    id: string; stars: number; tags: string[]; comment: string; created_at: string;
    author: { nick: string; avatar_url: string | null } | null;
  }[]).map((r) => ({
    id: r.id,
    fromNick: r.author?.nick ?? '—',
    fromAvatar: r.author?.avatar_url || '🧑',
    stars: r.stars,
    tags: r.tags ?? [],
    comment: r.comment,
    at: new Date(r.created_at).getTime(),
  }));
}

export async function submitReview(sellerId: string, authorId: string, stars: number, tags: string[], comment: string): Promise<void> {
  const { error } = await sb()
    .from('reviews')
    .upsert({ seller_id: sellerId, author_id: authorId, stars, tags, comment }, { onConflict: 'seller_id,author_id' });
  if (error) throw error;
}

export interface SellerAggregates {
  ratingAvg: number;
  ratingCount: number;
  activeListings: number;
  itemsSold: number;
  totalSalesValue: number;
}

export async function fetchSellerAggregates(sellerId: string): Promise<SellerAggregates | null> {
  const { data, error } = await sb().from('seller_public')
    .select('rating_avg,rating_count,active_listings,items_sold,total_sales_value')
    .eq('id', sellerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const d = data as { rating_avg: number; rating_count: number; active_listings: number; items_sold: number; total_sales_value: number };
  return {
    ratingAvg: Number(d.rating_avg) || 0,
    ratingCount: d.rating_count || 0,
    activeListings: d.active_listings || 0,
    itemsSold: d.items_sold || 0,
    totalSalesValue: Number(d.total_sales_value) || 0,
  };
}
