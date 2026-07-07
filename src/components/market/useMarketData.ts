// Data hooks that switch between the real backend (Supabase) and the local mock.
// Components call these instead of touching either source directly.
import { useEffect, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { LISTINGS } from '../../lib/market/data';
import { type Filters, type SortKey, filterListings, sellerItems, sortListings } from '../../lib/market/helpers';
import { fetchListing, fetchListings, fetchSellerListings, fetchSimilar } from '../../lib/market/listings';
import type { Listing } from '../../lib/market/types';
import { useAdmin, useMyListings } from './store';

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
    const all = [...myListings, ...LISTINGS].filter((l) => !adminRemoved.includes(l.id) && !bannedUsers.includes(l.sellerId));
    return { listings: sortListings(filterListings(all, filters), sort), loading: false, reloadKey: 0 };
  }
  return { listings: data, loading, reloadKey };
}

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
