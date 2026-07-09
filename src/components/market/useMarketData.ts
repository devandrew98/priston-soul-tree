// Data hooks that switch between the real backend (Supabase) and the local mock.
// Components call these instead of touching either source directly.
import { useEffect, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { LISTINGS, LISTING_BY_ID, priceHistory } from '../../lib/market/data';
import { type Filters, type SortKey, filterListings, marketOverview, marketStats, sellerItems, sellerReviews, sortListings } from '../../lib/market/helpers';
import { bumpViews, fetchFavoriteListings, fetchListing, fetchListings, fetchSellerListings, fetchSimilar } from '../../lib/market/listings';
import { fetchReviews, fetchSellerAggregates, type SellerAggregates } from '../../lib/market/social';
import { fetchItemMarket, fetchMarketOverview, type DbOverview } from '../../lib/market/stats';
import type { Listing, MarketStats, PricePoint, Review, Seller } from '../../lib/market/types';
import { useAdmin, useFavorites, useMyListings } from './store';
import { useSocialState } from './socialBackend';

/** Vitrine listings — DB (server-side filter/sort) or mock (client filter/sort). */
export function useBrowseListings(filters: Filters, sort: SortKey): { listings: Listing[]; loading: boolean; reloadKey: number } {
  const { myListings } = useMyListings();
  const { adminRemoved, bannedUsers } = useAdmin();
  const [data, setData] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [reloadKey, setReloadKey] = useState(0);
  const key = JSON.stringify(filters) + '|' + sort;

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchListings(filters, sort)
        .then((rows) => { if (!cancelled) { setData(rows); setReloadKey((k) => k + 1); } })
        .catch(() => { if (!cancelled) setData([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 220); // light debounce for search-as-you-type
    return () => { cancelled = true; clearTimeout(t); };
  }, [key]);

  if (!BACKEND_ENABLED) {
    // Vitrine mock: fora removidos, banidos e VENDIDOS (só anúncios ativos).
    const all = [...myListings, ...LISTINGS].filter(
      (l) => l.status !== 'sold' && !adminRemoved.includes(l.id) && !bannedUsers.includes(l.sellerId),
    );
    return { listings: sortListings(filterListings(all, filters), sort), loading: false, reloadKey: 0 };
  }
  return { listings: data, loading, reloadKey };
}

// Listings whose view we've already counted this session (avoids double-count on
// re-renders / React StrictMode double-invoke).
const viewedThisSession = new Set<string>();

/** A single listing by id — DB fetch or mock lookup. */
export function useListing(id: string): { listing: Listing | null; loading: boolean } {
  const { myListings } = useMyListings();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(BACKEND_ENABLED);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    setLoading(true);
    fetchListing(id)
      .then((l) => { if (!cancelled) setListing(l); })
      .catch(() => { if (!cancelled) setListing(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (!viewedThisSession.has(id)) { viewedThisSession.add(id); void bumpViews(id).catch(() => {}); }
    return () => { cancelled = true; };
  }, [id]);

  if (!BACKEND_ENABLED) {
    const found = LISTINGS.find((l) => l.id === id) || myListings.find((l) => l.id === id) || null;
    return { listing: found, loading: false };
  }
  return { listing, loading };
}

/** Recommendations for the item page. */
export function useSimilar(listing: Listing): Listing[] {
  const [items, setItems] = useState<Listing[]>([]);
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchSimilar(listing).then((r) => { if (!cancelled) setItems(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [listing.id]);
  if (!BACKEND_ENABLED) return LISTINGS.filter((l) => l.category === listing.category && l.id !== listing.id).slice(0, 4);
  return items;
}

/** A seller's listings — DB or mock. `reload()` re-fetches (e.g. after delete). */
export function useSellerListings(sellerId: string): { listings: Listing[]; loading: boolean; reload: () => void } {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!BACKEND_ENABLED || !sellerId) return;
    let cancelled = false;
    setLoading(true);
    fetchSellerListings(sellerId)
      .then((r) => { if (!cancelled) setListings(r); })
      .catch(() => { if (!cancelled) setListings([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sellerId, tick]);
  const reload = () => setTick((x) => x + 1);
  if (!BACKEND_ENABLED) return { listings: sellerItems(sellerId), loading: false, reload };
  return { listings, loading, reload };
}

/** The current user's favorited listings (Dashboard tab). */
export function useFavoriteListings(): { listings: Listing[]; loading: boolean } {
  const soc = useSocialState();
  const { favs: mockFavs } = useFavorites();
  const [data, setData] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const favKey = soc.favs.join(',');
  useEffect(() => {
    if (!BACKEND_ENABLED || !soc.userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchFavoriteListings(soc.userId)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [soc.userId, favKey]);
  if (!BACKEND_ENABLED) return { listings: mockFavs.map((id) => LISTING_BY_ID[id]).filter(Boolean) as Listing[], loading: false };
  return { listings: data, loading };
}

/** Reviews + rating aggregates for a seller profile (DB or mock). */
export function useSellerReputation(sellerId: string, seller?: Seller): { reviews: Review[]; aggregates: SellerAggregates | null; reloadReviews: () => void } {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [aggregates, setAggregates] = useState<SellerAggregates | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!BACKEND_ENABLED || !sellerId) return;
    let cancelled = false;
    fetchReviews(sellerId).then((r) => { if (!cancelled) setReviews(r); }).catch(() => {});
    fetchSellerAggregates(sellerId).then((a) => { if (!cancelled) setAggregates(a); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sellerId, tick]);
  const reloadReviews = () => setTick((x) => x + 1);
  if (!BACKEND_ENABLED) return { reviews: seller ? sellerReviews(seller) : [], aggregates: null, reloadReviews };
  return { reviews, aggregates, reloadReviews };
}

/** Market intelligence + price history for an item (DB sales, or mock synthetic). */
export function useItemMarket(listing: Listing): { series: PricePoint[]; stats: MarketStats } {
  const [data, setData] = useState<{ series: PricePoint[]; stats: MarketStats } | null>(null);
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchItemMarket(listing).then((r) => { if (!cancelled) setData(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [listing.id]);
  if (!BACKEND_ENABLED) { const series = priceHistory(listing); return { series, stats: marketStats(listing, series) }; }
  return data ?? {
    series: [],
    stats: { min: listing.price, max: listing.price, avg: listing.price, median: listing.price, listed: 0, sold: 0, lastSale: 0, lastSaleAt: 0, trend: 'stable', trendPct: 0 },
  };
}

/** Whole-market overview for the Statistics page (DB or mock), normalised. */
export function useMarketOverview(): { overview: DbOverview | null; loading: boolean } {
  const [data, setData] = useState<DbOverview | null>(null);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchMarketOverview().then((o) => { if (!cancelled) setData(o); }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  if (!BACKEND_ENABLED) {
    const o = marketOverview();
    const overview: DbOverview = {
      totalListings: o.totalListings, totalSold: o.totalSold, totalVolume: o.totalVolume,
      volumeToday: o.volumeToday, volumeMonth: o.volumeMonth, volumeByDay: o.volumeByDay,
      topViewed: o.topViewed,
      topSold: o.trending.map((x) => ({ name: x.listing.name, category: x.listing.category, count: Math.max(1, Math.round(Math.abs(x.pct))), volume: x.listing.price })),
      topSellers: o.topSellers.map((s) => ({ id: s.id, nick: s.nick, avatar: s.avatar, ratingAvg: s.ratingAvg, ratingCount: s.ratingCount, itemsSold: s.itemsSold })),
    };
    return { overview, loading: false };
  }
  return { overview: data, loading };
}
