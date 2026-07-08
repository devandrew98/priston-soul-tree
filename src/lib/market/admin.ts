// DB data layer for the admin panel (Phase 7). All writes are guarded by RLS
// (is_admin) or a security-definer RPC; the client just calls these.
import { supabase } from './supabase';

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

// ---- reports ----------------------------------------------------------------
export interface AdminReport {
  id: string;
  reporterNick: string;
  targetType: 'item' | 'user';
  targetId: string;
  targetName: string;
  reason: string;
  note: string;
  at: number;
}

export async function fetchOpenReports(): Promise<AdminReport[]> {
  const { data, error } = await sb()
    .from('reports')
    .select('id,target_type,target_id,reason,note,created_at, reporter:profiles!reporter_id(nick)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data as unknown as {
    id: string; target_type: 'item' | 'user'; target_id: string; reason: string; note: string;
    created_at: string; reporter: { nick: string } | null;
  }[]) ?? [];

  const itemIds = rows.filter((r) => r.target_type === 'item').map((r) => r.target_id);
  const userIds = rows.filter((r) => r.target_type === 'user').map((r) => r.target_id);
  const [items, users] = await Promise.all([
    itemIds.length ? sb().from('listings').select('id,name').in('id', itemIds) : Promise.resolve({ data: [] }),
    userIds.length ? sb().from('profiles').select('id,nick').in('id', userIds) : Promise.resolve({ data: [] }),
  ]);
  const itemMap = new Map((items.data as { id: string; name: string }[]).map((i) => [i.id, i.name]));
  const userMap = new Map((users.data as { id: string; nick: string }[]).map((u) => [u.id, u.nick]));

  return rows.map((r) => ({
    id: r.id,
    reporterNick: r.reporter?.nick ?? '?',
    targetType: r.target_type,
    targetId: r.target_id,
    targetName: (r.target_type === 'item' ? itemMap.get(r.target_id) : userMap.get(r.target_id)) ?? r.target_id,
    reason: r.reason,
    note: r.note,
    at: new Date(r.created_at).getTime(),
  }));
}

export async function resolveReport(id: string, status: 'resolved' | 'dismissed'): Promise<void> {
  const { error } = await sb().from('reports').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Create a report (used by the item/seller "report" buttons). */
export async function createReport(reporterId: string, targetType: 'item' | 'user', targetId: string, reason: string, note = ''): Promise<void> {
  const { error } = await sb().from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, note });
  if (error) throw error;
}

// ---- listings moderation ----------------------------------------------------
export interface AdminListing {
  id: string;
  name: string;
  icon: string;
  image: string | null;
  sellerId: string;
  sellerNick: string;
  price: number;
  currency: string;
  status: string;
  removed: boolean;
  highlighted: boolean;
}

export async function fetchAdminListings(): Promise<AdminListing[]> {
  const { data, error } = await sb()
    .from('listings')
    .select('id,name,category,image_url,price,currency,status,removed,highlighted,seller_id, seller:profiles!seller_id(nick)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data as unknown as {
    id: string; name: string; category: string; image_url: string | null; price: number | string;
    currency: string; status: string; removed: boolean; highlighted: boolean; seller_id: string;
    seller: { nick: string } | null;
  }[]) ?? []).map((r) => ({
    id: r.id, name: r.name, icon: '📦', image: r.image_url, sellerId: r.seller_id,
    sellerNick: r.seller?.nick ?? '?', price: Number(r.price), currency: r.currency,
    status: r.status, removed: r.removed, highlighted: r.highlighted,
  }));
}

export async function setListingRemoved(id: string, removed: boolean): Promise<void> {
  const { error } = await sb().from('listings').update({ removed }).eq('id', id);
  if (error) throw error;
}
export async function setListingFeatured(id: string, highlighted: boolean): Promise<void> {
  const { error } = await sb().from('listings').update({ highlighted }).eq('id', id);
  if (error) throw error;
}

// ---- users moderation -------------------------------------------------------
export interface AdminUser {
  id: string;
  nick: string;
  avatar: string;
  className: string;
  level: number;
  banned: boolean;
  suspended: boolean;
  contributor: boolean;
  verified: boolean;
  repTierOverride: string | null;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await sb()
    .from('profiles')
    .select('id,nick,avatar_url,char_class,level,banned,suspended,is_contributor,verified,rep_tier_override')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data as {
    id: string; nick: string; avatar_url: string | null; char_class: string; level: number;
    banned: boolean; suspended: boolean; is_contributor: boolean; verified: boolean; rep_tier_override: string | null;
  }[]) ?? []).map((u) => ({
    id: u.id, nick: u.nick, avatar: u.avatar_url || '🧑', className: u.char_class, level: u.level,
    banned: u.banned, suspended: u.suspended, contributor: u.is_contributor, verified: u.verified,
    repTierOverride: u.rep_tier_override,
  }));
}

export async function setUserFlag(userId: string, patch: Partial<{ banned: boolean; suspended: boolean; is_contributor: boolean }>): Promise<void> {
  const { error } = await sb().from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// ---- logs + broadcast -------------------------------------------------------
export interface AdminLogRow { id: string; text: string; at: number }

export async function fetchAdminLogs(): Promise<AdminLogRow[]> {
  const { data, error } = await sb().from('admin_logs').select('id,text,created_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return ((data as { id: string; text: string; created_at: string }[]) ?? []).map((l) => ({ id: l.id, text: l.text, at: new Date(l.created_at).getTime() }));
}

export async function logAdminAction(adminId: string, text: string): Promise<void> {
  await sb().from('admin_logs').insert({ admin_id: adminId, text });
}

export async function adminBroadcast(message: string): Promise<void> {
  const { error } = await sb().rpc('admin_broadcast', { message });
  if (error) throw error;
}
