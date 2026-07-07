// Backend-backed real chat (Phase 5) with Supabase Realtime. Threads are keyed
// by peer id so the existing Chat UI (keyed by seller/peer) works unchanged.
import { useSyncExternalStore } from 'react';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import * as chat from '../../lib/market/chat';
import type { ChatMessage } from './store';

interface Thread {
  convId: string;
  peerId: string;
  messages: (ChatMessage & { read: boolean })[];
}

interface State {
  userId: string | null;
  threads: Record<string, Thread>; // keyed by peerId
}

let state: State = { userId: null, threads: {} };
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function set(patch: Partial<State>) { state = { ...state, ...patch }; emit(); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

const peerOf = (c: chat.ConvRow, userId: string) => (c.buyer_id === userId ? c.seller_id : c.buyer_id);
const toMsg = (m: chat.MsgRow, userId: string): ChatMessage & { read: boolean } => ({
  id: m.id,
  from: m.sender_id === userId ? 'me' : 'them',
  text: m.body,
  at: new Date(m.created_at).getTime(),
  read: m.read_at != null,
});

async function loadConversations(userId: string | null) {
  if (!userId) { set({ userId: null, threads: {} }); return; }
  set({ userId });
  try {
    const convs = await chat.fetchConversations(userId);
    const threads: Record<string, Thread> = {};
    for (const c of convs) {
      const peerId = peerOf(c, userId);
      const messages = [...c.messages]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((m) => toMsg(m, userId));
      threads[peerId] = { convId: c.id, peerId, messages };
    }
    if (state.userId === userId) set({ threads });
  } catch { /* ignore */ }
}

// Append a realtime/echoed message into its thread (dedupe by id).
function ingest(row: chat.MsgRow & { conversation_id: string }) {
  const userId = state.userId;
  if (!userId) return;
  const entry = Object.entries(state.threads).find(([, th]) => th.convId === row.conversation_id);
  if (!entry) { void loadConversations(userId); return; } // new conversation from a peer
  const [peerId, th] = entry;
  if (th.messages.some((m) => m.id === row.id)) return; // already have it
  const messages = [...th.messages, toMsg(row, userId)];
  set({ threads: { ...state.threads, [peerId]: { ...th, messages } } });
}

if (BACKEND_ENABLED && supabase) {
  const client = supabase;
  client.auth.getSession().then(({ data }) => loadConversations(data.session?.user?.id ?? null));
  client.auth.onAuthStateChange((_e, sess) => {
    const uid = sess?.user?.id ?? null;
    setTimeout(() => { void loadConversations(uid); }, 0);
  });
  client
    .channel('mk-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      ingest(payload.new as chat.MsgRow & { conversation_id: string });
    })
    .subscribe();
}

export function useChatState(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function chatUnread(peerId: string): number {
  const th = state.threads[peerId];
  if (!th) return 0;
  return th.messages.filter((m) => m.from === 'them' && !m.read).length;
}

export function chatOpen(peerId: string, seed?: string) {
  const userId = state.userId;
  if (!userId) return;
  // Show the thread immediately (optimistic) if new.
  if (!state.threads[peerId]) set({ threads: { ...state.threads, [peerId]: { convId: '', peerId, messages: [] } } });
  chat.getOrCreateConversation(userId, peerId)
    .then((c) => {
      set({ threads: { ...state.threads, [peerId]: { ...(state.threads[peerId] || { peerId, messages: [] }), convId: c.id } } });
      if (seed) return chat.sendMessage(c.id, userId, seed).then((m) => ingest({ ...m, conversation_id: c.id }));
    })
    .catch(() => {});
}

export function chatSend(peerId: string, text: string) {
  const userId = state.userId;
  const th = state.threads[peerId];
  if (!userId || !th?.convId) return;
  chat.sendMessage(th.convId, userId, text)
    .then((m) => ingest({ ...m, conversation_id: th.convId }))
    .catch(() => {});
}

export function chatMarkRead(peerId: string) {
  const userId = state.userId;
  const th = state.threads[peerId];
  if (!userId || !th?.convId) return;
  const hasUnread = th.messages.some((m) => m.from === 'them' && !m.read);
  if (!hasUnread) return;
  set({ threads: { ...state.threads, [peerId]: { ...th, messages: th.messages.map((m) => (m.from === 'them' ? { ...m, read: true } : m)) } } });
  chat.markConversationRead(th.convId, userId).catch(() => {});
}
