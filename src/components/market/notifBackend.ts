// Backend-backed notifications (Phase 6) with Supabase Realtime. Loaded per
// logged-in user; new rows (created by DB triggers) stream in live.
import { useSyncExternalStore } from 'react';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import * as api from '../../lib/market/notifications';
import type { NotifRow } from '../../lib/market/notifications';
import type { Notif, NotifLink, NotifType } from './store';

interface State {
  userId: string | null;
  items: Notif[];
}

let state: State = { userId: null, items: [] };
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function set(patch: Partial<State>) { state = { ...state, ...patch }; emit(); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

function rowToNotif(r: NotifRow): Notif {
  return {
    id: r.id,
    type: r.type as NotifType,
    params: r.params ?? undefined,
    at: new Date(r.created_at).getTime(),
    read: r.read,
    link: (r.link as NotifLink | null) ?? undefined,
  };
}

async function load(userId: string | null) {
  if (!userId) { set({ userId: null, items: [] }); return; }
  set({ userId });
  try {
    const rows = await api.fetchNotifications(userId);
    if (state.userId === userId) set({ items: rows.map(rowToNotif) });
  } catch { /* ignore */ }
}

if (BACKEND_ENABLED && supabase) {
  const client = supabase;
  client.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
  client.auth.onAuthStateChange((_e, sess) => {
    const uid = sess?.user?.id ?? null;
    setTimeout(() => { void load(uid); }, 0);
  });
  client
    .channel('mk-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      const n = rowToNotif(payload.new as NotifRow);
      if (state.items.some((x) => x.id === n.id)) return;
      set({ items: [n, ...state.items].slice(0, 60) });
    })
    .subscribe();
}

export function useNotifState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function notifMarkRead(id: string) {
  set({ items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)) });
  api.markNotifRead(id).catch(() => {});
}

export function notifMarkAllRead() {
  const uid = state.userId;
  set({ items: state.items.map((n) => ({ ...n, read: true })) });
  if (uid) api.markAllNotifRead(uid).catch(() => {});
}

export function notifClearAll() {
  const uid = state.userId;
  set({ items: [] });
  if (uid) api.clearNotifs(uid).catch(() => {});
}

export function notifPush(type: NotifType, params?: Record<string, string | number>, link?: NotifLink) {
  const uid = state.userId;
  if (!uid) return;
  api.insertNotif(uid, type, params, link).then(() => load(uid)).catch(() => {});
}
