// Tiny external store for the Marketplace client state (favorites, watched
// sellers, wishlist, user-created listings). Persisted to localStorage and
// shared across views via useSyncExternalStore — no provider needed.
import { useSyncExternalStore } from 'react';
import { SELLER_BY_ID } from '../../lib/market/data';
import type { Listing, Seller } from '../../lib/market/types';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { signOut as sbSignOut } from '../../lib/market/auth';
import { getCachedProfile } from '../../lib/market/profileCache';
import { useSession } from './session';
import {
  addWishBackend, removeWishBackend, toggleFavBackend, toggleFavSellerBackend, useSocialState,
} from './socialBackend';
import { chatMarkRead, chatOpen, chatSend, chatUnread, useChatState } from './chatBackend';

// The demo account pre-selected on first load (so the Dashboard has data).
export const CURRENT_USER_ID = 'hadder';
// Accounts with moderation powers (show the Admin panel tab).
export const ADMIN_IDS = ['hadder'];

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

export type NotifType = 'message' | 'interest' | 'sold' | 'reserved' | 'expiring' | 'review' | 'wishlist' | 'global';

export interface NotifLink {
  kind: 'item' | 'seller' | 'messages';
  id?: string;
}

export interface Notif {
  id: string;
  type: NotifType;
  params?: Record<string, string | number>;
  at: number;
  read: boolean;
  link?: NotifLink;
}

export interface AdminLog {
  id: string;
  text: string;
  at: number;
}

interface State {
  authUserId: string | null; // logged-in seller id, or null when logged out
  accounts: Seller[]; // locally registered accounts (extend the seller directory)
  favItems: string[];
  favSellers: string[];
  wishlist: WishEntry[];
  myListings: Listing[];
  chats: Record<string, Conversation>; // keyed by sellerId
  notifications: Notif[];
  // admin moderation state
  adminRemoved: string[]; // listing ids hidden by a moderator
  adminFeatured: Record<string, boolean>; // listing id → highlighted override
  bannedUsers: string[];
  suspendedUsers: string[];
  contributors: string[]; // sellers granted the "Colaborador" seal (admin only)
  resolvedReports: string[];
  adminLogs: AdminLog[];
}

const KEY = 'mk-store-v1';

const now = Date.now();
const seedNotifications = (): Notif[] => [
  { id: 'n1', type: 'interest', params: { item: 'Murky Sword' }, at: now - 4 * 60000, read: false, link: { kind: 'messages' } },
  { id: 'n2', type: 'sold', params: { item: 'Shadow Robe', price: '720kk' }, at: now - 3 * 3600000, read: false, link: { kind: 'item', id: 'it-7' } },
  { id: 'n3', type: 'review', params: { stars: 5 }, at: now - 20 * 3600000, read: false, link: { kind: 'seller', id: CURRENT_USER_ID } },
  { id: 'n4', type: 'wishlist', params: { item: 'Aegis of Dawn' }, at: now - 26 * 3600000, read: true, link: { kind: 'item', id: 'it-9' } },
  { id: 'n5', type: 'expiring', params: { item: 'Boots of Haste' }, at: now - 2 * 86400000, read: true, link: { kind: 'item', id: 'it-13' } },
];

function load(): State {
  const base: State = {
    authUserId: CURRENT_USER_ID, accounts: [],
    favItems: [], favSellers: [], wishlist: [], myListings: [], chats: {},
    notifications: seedNotifications(),
    adminRemoved: [], adminFeatured: {}, bannedUsers: [], suspendedUsers: [], contributors: ['hadder', 'commita'], resolvedReports: [], adminLogs: [],
  };
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

/** Resolve a seller by id across the built-in directory, registered accounts and
 *  the DB profile cache (populated when listings are fetched from the backend). */
export function getSeller(id: string | null | undefined): Seller | undefined {
  if (!id) return undefined;
  return SELLER_BY_ID[id] ?? state.accounts.find((a) => a.id === id) ?? getCachedProfile(id);
}

export function useFavorites() {
  const s = useSnapshot();
  const soc = useSocialState();
  if (BACKEND_ENABLED) {
    return { favs: soc.favs, isFav: (id: string) => soc.favs.includes(id), toggleFav: toggleFavBackend };
  }
  return {
    favs: s.favItems,
    isFav: (id: string) => s.favItems.includes(id),
    toggleFav: (id: string) => set({ favItems: toggle(s.favItems, id) }),
  };
}

export function useFavSellers() {
  const s = useSnapshot();
  const soc = useSocialState();
  if (BACKEND_ENABLED) {
    return { favSellers: soc.favSellers, isFavSeller: (id: string) => soc.favSellers.includes(id), toggleFavSeller: toggleFavSellerBackend };
  }
  return {
    favSellers: s.favSellers,
    isFavSeller: (id: string) => s.favSellers.includes(id),
    toggleFavSeller: (id: string) => set({ favSellers: toggle(s.favSellers, id) }),
  };
}

export function useWishlist() {
  const s = useSnapshot();
  const soc = useSocialState();
  if (BACKEND_ENABLED) {
    return { wishlist: soc.wishlist, addWish: addWishBackend, removeWish: removeWishBackend };
  }
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
  const cs = useChatState(); // always called (BACKEND_ENABLED is a stable module constant)

  if (BACKEND_ENABLED) {
    const chats: Record<string, Conversation> = {};
    for (const [peerId, th] of Object.entries(cs.threads)) chats[peerId] = { messages: th.messages, lastReadAt: 0 };
    const order = Object.keys(cs.threads).sort((a, b) => {
      const ma = cs.threads[a].messages;
      const mb = cs.threads[b].messages;
      const la = ma.length ? ma[ma.length - 1].at : 0;
      const lb = mb.length ? mb[mb.length - 1].at : 0;
      return lb - la;
    });
    return {
      chats,
      order,
      unread: chatUnread,
      totalUnread: order.reduce((sum, id) => sum + chatUnread(id), 0),
      startConversation: chatOpen,
      sendMessage: chatSend,
      receiveMessage: (_sellerId: string, _text: string) => {}, // real messages arrive via realtime
      markRead: chatMarkRead,
    };
  }

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

export interface RegisterInput {
  nick: string;
  className: string;
  clan: string;
  avatar: string;
}

export function useAuth() {
  const s = useSnapshot();
  const session = useSession(); // always called (BACKEND_ENABLED is a stable module constant)

  // Real backend: identity comes from the Supabase session + profile.
  if (BACKEND_ENABLED) {
    return {
      backend: true as const,
      ready: session.ready,
      userId: session.userId,
      user: session.profile ?? undefined,
      isLoggedIn: !!session.profile,
      isAdmin: !!session.raw?.is_admin,
      isContributor: !!session.raw?.is_contributor,
      accounts: [] as Seller[],
      loginAs: (_id: string) => {},                 // n/a with real auth
      logout: () => { void sbSignOut(); },
      register: (_input: RegisterInput) => '',       // handled by AuthModal via auth.ts
    };
  }

  // Demo mode: identity from the local mock store.
  const user = getSeller(s.authUserId);
  return {
    backend: false as const,
    ready: true,
    userId: s.authUserId,
    user,
    isLoggedIn: !!user,
    isAdmin: !!s.authUserId && ADMIN_IDS.includes(s.authUserId),
    isContributor: !!s.authUserId && s.contributors.includes(s.authUserId),
    accounts: s.accounts,
    loginAs: (id: string) => set({ authUserId: id }),
    logout: () => set({ authUserId: null }),
    register: (input: RegisterInput) => {
      const id = `acc-${Date.now()}`;
      const account: Seller = {
        id, nick: input.nick, avatar: input.avatar || '🧑', className: input.className, level: 1,
        clan: input.clan || '—', joinedAt: Date.now(), lastSeen: Date.now(), online: true, verified: false,
        totalSalesValue: 0, itemsSold: 0, itemsBought: 0, ratingAvg: 0, ratingCount: 0, positivePct: 0,
        avgResponseMin: 0, avgCompleteMin: 0, reports: 0, medals: [],
      };
      set({ accounts: [...s.accounts, account], authUserId: id });
      return id;
    },
  };
}

// Standalone (non-hook) notification pusher, callable from anywhere.
export function pushNotif(type: NotifType, params?: Record<string, string | number>, link?: NotifLink) {
  const n: Notif = { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, params, at: Date.now(), read: false, link };
  set({ notifications: [n, ...state.notifications].slice(0, 60) });
}

export function useNotifications() {
  const s = useSnapshot();
  return {
    notifications: s.notifications,
    unread: s.notifications.filter((n) => !n.read).length,
    push: pushNotif,
    markRead: (id: string) => set({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),
    markAllRead: () => set({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }),
    clearAll: () => set({ notifications: [] }),
  };
}

function addLog(text: string) {
  const log: AdminLog = { id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, at: Date.now() };
  set({ adminLogs: [log, ...state.adminLogs].slice(0, 100) });
}

export function useAdmin() {
  const s = useSnapshot();
  return {
    adminRemoved: s.adminRemoved,
    adminFeatured: s.adminFeatured,
    bannedUsers: s.bannedUsers,
    suspendedUsers: s.suspendedUsers,
    contributors: s.contributors,
    resolvedReports: s.resolvedReports,
    logs: s.adminLogs,
    removeListing: (id: string, name: string) => { set({ adminRemoved: [...new Set([...s.adminRemoved, id])] }); addLog(`Anúncio removido: ${name} (${id})`); },
    restoreListing: (id: string) => set({ adminRemoved: s.adminRemoved.filter((x) => x !== id) }),
    toggleFeatured: (id: string, name: string, next: boolean) => { set({ adminFeatured: { ...s.adminFeatured, [id]: next } }); addLog(`${next ? 'Destacou' : 'Removeu destaque de'}: ${name}`); },
    toggleBan: (id: string, nick: string) => { const on = s.bannedUsers.includes(id); set({ bannedUsers: toggle(s.bannedUsers, id) }); addLog(`${on ? 'Desbaniu' : 'Baniu'} usuário: ${nick}`); },
    toggleSuspend: (id: string, nick: string) => { const on = s.suspendedUsers.includes(id); set({ suspendedUsers: toggle(s.suspendedUsers, id) }); addLog(`${on ? 'Reativou' : 'Suspendeu'} vendedor: ${nick}`); },
    toggleContributor: (id: string, nick: string) => { const on = s.contributors.includes(id); set({ contributors: toggle(s.contributors, id) }); addLog(`${on ? 'Removeu selo Colaborador de' : 'Concedeu selo Colaborador a'}: ${nick}`); },
    resolveReport: (id: string, action: string) => { set({ resolvedReports: [...new Set([...s.resolvedReports, id])] }); addLog(`Denúncia ${id}: ${action}`); },
    sendGlobal: (text: string) => { pushNotif('global', { text }); addLog(`Notificação global enviada: "${text}"`); },
  };
}

/** Lightweight read-only hook for the "Colaborador" seal, usable anywhere. */
export function useContributors() {
  const s = useSnapshot();
  return { contributors: s.contributors, isContributor: (id: string | null | undefined) => !!id && s.contributors.includes(id) };
}
