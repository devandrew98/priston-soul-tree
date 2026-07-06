// Tiny external store for the Marketplace client state (favorites, watched
// sellers, wishlist, user-created listings). Persisted to localStorage and
// shared across views via useSyncExternalStore — no provider needed.
import { useSyncExternalStore } from 'react';
import type { Listing } from '../../lib/market/types';

// The demo "logged in" user is this seller, so the Dashboard has data to show.
export const CURRENT_USER_ID = 'hadder';

export interface WishEntry {
  id: string;
  text: string;
  maxPrice: number | null;
  createdAt: number;
}

interface State {
  favItems: string[];
  favSellers: string[];
  wishlist: WishEntry[];
  myListings: Listing[];
}

const KEY = 'mk-store-v1';

function load(): State {
  const base: State = { favItems: [], favSellers: [], wishlist: [], myListings: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...base, ...raw };
  } catch {
    /* ignore */
  }
  return base;
}

let state: State = load();
const listeners = new Set<() => void>();

function emit() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function useSnapshot(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

export function useFavorites() {
  const s = useSnapshot();
  return {
    favs: s.favItems,
    isFav: (id: string) => s.favItems.includes(id),
    toggleFav: (id: string) => set({ favItems: toggle(s.favItems, id) }),
  };
}

export function useFavSellers() {
  const s = useSnapshot();
  return {
    favSellers: s.favSellers,
    isFavSeller: (id: string) => s.favSellers.includes(id),
    toggleFavSeller: (id: string) => set({ favSellers: toggle(s.favSellers, id) }),
  };
}

export function useWishlist() {
  const s = useSnapshot();
  return {
    wishlist: s.wishlist,
    addWish: (text: string, maxPrice: number | null) =>
      set({ wishlist: [{ id: `w-${Date.now()}`, text, maxPrice, createdAt: Date.now() }, ...s.wishlist] }),
    removeWish: (id: string) => set({ wishlist: s.wishlist.filter((w) => w.id !== id) }),
  };
}

export function useMyListings() {
  const s = useSnapshot();
  return {
    myListings: s.myListings,
    addListing: (l: Listing) => set({ myListings: [l, ...s.myListings] }),
    removeListing: (id: string) => set({ myListings: s.myListings.filter((l) => l.id !== id) }),
    duplicateListing: (id: string) => {
      const src = s.myListings.find((l) => l.id === id);
      if (!src) return;
      set({ myListings: [{ ...src, id: `my-${Date.now()}`, createdAt: Date.now(), views: 0, status: 'available' }, ...s.myListings] });
    },
  };
}
