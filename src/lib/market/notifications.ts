// DB data layer for notifications (Phase 6). Rows are created server-side by
// triggers (see supabase/03_notifications.sql); the client reads/marks its own.
import { supabase } from './supabase';

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

export interface NotifRow {
  id: string;
  user_id: string;
  type: string;
  params: Record<string, string | number> | null;
  link: { kind: string; id?: string } | null;
  read: boolean;
  created_at: string;
}

export async function fetchNotifications(userId: string): Promise<NotifRow[]> {
  const { data, error } = await sb()
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data as NotifRow[]) ?? [];
}

export async function markNotifRead(id: string): Promise<void> {
  const { error } = await sb().from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllNotifRead(userId: string): Promise<void> {
  const { error } = await sb().from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  if (error) throw error;
}

export async function clearNotifs(userId: string): Promise<void> {
  const { error } = await sb().from('notifications').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function insertNotif(
  userId: string,
  type: string,
  params?: Record<string, string | number>,
  link?: { kind: string; id?: string },
): Promise<void> {
  const { error } = await sb().from('notifications').insert({ user_id: userId, type, params: params ?? {}, link: link ?? null });
  if (error) throw error;
}
