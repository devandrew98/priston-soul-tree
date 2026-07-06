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

export interface ChatMessage {
  id: string;
  from: 'me' | 'them';
  text: string;
  at: number;
}

export interface Conversation {
  messages: ChatMessage[];
  lastReadAt: number;
}

interface State {
  favItems: string[];
  favSellers: string[];
  wishlist: WishEntry[];
  myListings: Listing[];
  chats: Record<string, Conversation>; // keyed by sellerId
}

const KEY = 'mk-store-v1';

function load(): State {
  const base: State = { favItems: [], favSellers: [], wishlist: [], myListings: [], chats: {} };
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

const mkMsg = (from: ChatMessage['from'], text: string): ChatMessage => ({ id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from, text, at: Date.now() });

function upsertChat(sellerId: string, mutate: (c: Conversation) => Conversation) {
  const current = state.chats[sellerId] ?? { messages: [], lastReadAt: 0 };
  set({ chats: { ...state.chats, [sellerId]: mutate(current) } });
}

export function useChats() {
  const s = useSnapshot();
  const unread = (sellerId: string) => {
    const c = s.chats[sellerId];
    if (!c) return 0;
    return c.messages.filter((m) => m.from === 'them' && m.at > c.lastReadAt).length;
  };
  return {
    chats: s.chats,
    // sellerIds ordered by most-recent activity
    order: Object.keys(s.chats).sort((a, b) => {
      const ma = s.chats[a].messages;
      const mb = s.chats[b].messages;
      const la = ma.length ? ma[ma.length - 1].at : 0;
      const lb = mb.length ? mb[mb.length - 1].at : 0;
      return lb - la;
    }),
    unread,
    totalUnread: Object.keys(s.chats).reduce((sum, id) => sum + unread(id), 0),
    /** Open (or create) a conversation, optionally seeding a first "me" message. */
    startConversation: (sellerId: string, seed?: string) => {
      const existing = state.chats[sellerId];
      if (!existing) {
        upsertChat(sellerId, () => ({ messages: seed ? [mkMsg('me', seed)] : [], lastReadAt: Date.now() }));
      } else if (seed) {
        upsertChat(sellerId, (c) => ({ ...c, messages: [...c.messages, mkMsg('me', seed)] }));
      }
    },
    sendMessage: (sellerId: string, text: string) =>
      upsertChat(sellerId, (c) => ({ ...c, messages: [...c.messages, mkMsg('me', text)] })),
    receiveMessage: (sellerId: string, text: string) =>
      upsertChat(sellerId, (c) => ({ ...c, messages: [...c.messages, mkMsg('them', text)] })),
    markRead: (sellerId: string) => upsertChat(sellerId, (c) => ({ ...c, lastReadAt: Date.now() })),
  };
}
