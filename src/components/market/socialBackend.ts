// Backend-backed per-user social state (favorites, watched sellers, wishlist).
// Loads once per logged-in user and mutates optimistically, writing through to
// the DB. Only active when BACKEND_ENABLED; the mock store handles demo mode.
import { useSyncExternalStore } from 'react';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import * as social from '../../lib/market/social';
import type { WishRow } from '../../lib/market/social';

interface SocialState {
  userId: string | null;
  favs: string[];
  favSellers: string[];
  wishlist: WishRow[];
}

let state: SocialState = { userId: null, favs: [], favSellers: [], wishlist: [] };
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function set(patch: Partial<SocialState>) { state = { ...state, ...patch }; emit(); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

async function loadAll(userId: string | null) {
  if (!userId) { set({ userId: null, favs: [], favSellers: [], wishlist: [] }); return; }
  set({ userId });
  try {
    const [favs, favSellers, wishlist] = await Promise.all([
      social.fetchFavoriteIds(userId),
      social.fetchFavSellerIds(userId),
      social.fetchWishlist(userId),
    ]);
    if (state.userId === userId) set({ favs, favSellers, wishlist });
  } catch { /* ignore */ }
}

if (BACKEND_ENABLED && supabase) {
  supabase.auth.getSession().then(({ data }) => loadAll(data.session?.user?.id ?? null));
  // Defer DB loads out of the auth callback (avoids the supabase-js deadlock).
  supabase.auth.onAuthStateChange((_e, sess) => {
    const uid = sess?.user?.id ?? null;
    setTimeout(() => { void loadAll(uid); }, 0);
  });
}

export function useSocialState(): SocialState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function toggleFavBackend(listingId: string) {
  const uid = state.userId;
  if (!uid) return;
  if (state.favs.includes(listingId)) {
    set({ favs: state.favs.filter((x) => x !== listingId) });
    social.removeFavorite(uid, listingId).catch(() => loadAll(uid));
  } else {
    set({ favs: [...state.favs, listingId] });
    social.addFavorite(uid, listingId).catch(() => loadAll(uid));
  }
}

export function toggleFavSellerBackend(sellerId: string) {
  const uid = state.userId;
  if (!uid) return;
  if (state.favSellers.includes(sellerId)) {
    set({ favSellers: state.favSellers.filter((x) => x !== sellerId) });
    social.removeFavSeller(uid, sellerId).catch(() => loadAll(uid));
  } else {
    set({ favSellers: [...state.favSellers, sellerId] });
    social.addFavSeller(uid, sellerId).catch(() => loadAll(uid));
  }
}

export function addWishBackend(text: string, maxPrice: number | null) {
  const uid = state.userId;
  if (!uid) return;
  social.addWish(uid, text, maxPrice).then(() => loadAll(uid)).catch(() => {});
}

export function removeWishBackend(id: string) {
  const uid = state.userId;
  set({ wishlist: state.wishlist.filter((w) => w.id !== id) });
  social.removeWish(id).catch(() => { if (uid) loadAll(uid); });
}
