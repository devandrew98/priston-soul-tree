// DB data layer for real chat (Phase 5). Conversations are one-per-pair; the
// UI keys threads by the *peer* user id (the other participant).
import { supabase } from './supabase';
import { cacheProfiles } from './profileCache';
import { profileToSeller, type ProfileRow } from './auth';

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

export interface MsgRow {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface ConvRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  buyer: ProfileRow | null;
  seller: ProfileRow | null;
  messages: MsgRow[];
}

const PROFILE = 'id,nick,char_class,level,clan,avatar_url,verified,is_admin,is_contributor,created_at,last_seen';
const CONV_SELECT = `*, buyer:profiles!buyer_id(${PROFILE}), seller:profiles!seller_id(${PROFILE}), messages(id,sender_id,body,read_at,created_at)`;

function cacheParticipants(c: ConvRow) {
  for (const p of [c.buyer, c.seller]) {
    if (p) cacheProfiles([profileToSeller(p)], p.is_contributor ? [p.id] : []);
  }
}

/** All conversations for a user, with participants + messages. Caches profiles. */
export async function fetchConversations(userId: string): Promise<ConvRow[]> {
  const { data, error } = await sb()
    .from('conversations')
    .select(CONV_SELECT)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  if (error) throw error;
  const rows = (data as unknown as ConvRow[]) ?? [];
  rows.forEach(cacheParticipants);
  return rows;
}

/** Find (either direction) or create the conversation between two users. */
export async function getOrCreateConversation(userId: string, peerId: string): Promise<ConvRow> {
  const found = await sb()
    .from('conversations')
    .select(CONV_SELECT)
    .or(`and(buyer_id.eq.${userId},seller_id.eq.${peerId}),and(buyer_id.eq.${peerId},seller_id.eq.${userId})`)
    .maybeSingle();
  if (found.error) throw found.error;
  if (found.data) { const c = found.data as unknown as ConvRow; cacheParticipants(c); return c; }

  const created = await sb()
    .from('conversations')
    .insert({ buyer_id: userId, seller_id: peerId })
    .select(CONV_SELECT)
    .single();
  if (created.error) throw created.error;
  const c = created.data as unknown as ConvRow;
  cacheParticipants(c);
  return c;
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<MsgRow> {
  const { data, error } = await sb()
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('id,sender_id,body,read_at,created_at')
    .single();
  if (error) throw error;
  return data as MsgRow;
}

/** Mark the peer's messages in this conversation as read. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
