// Reports and admin shut-downs for screen rooms (tables: supabase/23_screen_moderation.sql).
// Everything here fails soft: if the tables don't exist yet (or the backend is off) the rooms
// keep working and the moderation features just say they're unavailable.
import { supabase } from '../market/supabase';
import { normalizeRoomCode } from './p2p';

export type ReportReason = 'inappropriate' | 'spam' | 'other';
export const REPORT_REASONS: ReportReason[] = ['inappropriate', 'spam', 'other'];
export const REPORT_DETAILS_MAX = 500;

export interface RoomReport {
  id: string;
  roomCode: string;
  reason: ReportReason;
  details: string;
  createdAt: number;
}

/** Codes of rooms an admin has closed. Returns an empty set when it can't be read. */
export async function fetchClosedRooms(): Promise<Set<string>> {
  if (!supabase) return new Set();
  try {
    const { data, error } = await supabase.from('screen_closed_rooms').select('code');
    if (error || !data) return new Set();
    return new Set(data.map((r) => String(r.code)));
  } catch {
    return new Set();
  }
}

/** True when the report was stored. */
export async function reportRoom(code: string, reason: ReportReason, details: string): Promise<boolean> {
  const room = normalizeRoomCode(code);
  if (!supabase || !room || !REPORT_REASONS.includes(reason)) return false;
  try {
    const { error } = await supabase.from('screen_reports').insert({ room_code: room, reason, details: details.trim().slice(0, REPORT_DETAILS_MAX) });
    return !error;
  } catch {
    return false;
  }
}

/** Admin only (enforced by the database). */
export async function closeRoom(code: string, reason = ''): Promise<boolean> {
  const room = normalizeRoomCode(code);
  if (!supabase || !room) return false;
  try {
    const { error } = await supabase.from('screen_closed_rooms').upsert({ code: room, reason: reason.slice(0, 200) });
    return !error;
  } catch {
    return false;
  }
}

/** Admin only. Newest first. */
export async function fetchReports(): Promise<RoomReport[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('screen_reports').select('id, room_code, reason, details, created_at').order('created_at', { ascending: false }).limit(200);
    if (error || !data) return [];
    return data.map((r) => ({
      id: String(r.id),
      roomCode: String(r.room_code),
      reason: (REPORT_REASONS.includes(r.reason as ReportReason) ? r.reason : 'other') as ReportReason,
      details: String(r.details ?? ''),
      createdAt: new Date(String(r.created_at)).getTime(),
    }));
  } catch {
    return [];
  }
}

/** Admin only: clears every report of a room. */
export async function dismissReports(code: string): Promise<boolean> {
  const room = normalizeRoomCode(code);
  if (!supabase || !room) return false;
  try {
    const { error } = await supabase.from('screen_reports').delete().eq('room_code', room);
    return !error;
  } catch {
    return false;
  }
}

/** One report per room per browser per hour, so the button can't be mashed. */
const COOLDOWN_KEY = 'screen-report-at';
const COOLDOWN_MS = 60 * 60 * 1000;
export function reportOnCooldown(code: string, now = Date.now()): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(COOLDOWN_KEY) ?? '{}') as Record<string, number>;
    return now - (all[code] ?? 0) < COOLDOWN_MS;
  } catch {
    return false;
  }
}
export function markReported(code: string, now = Date.now()): void {
  try {
    const all = JSON.parse(localStorage.getItem(COOLDOWN_KEY) ?? '{}') as Record<string, number>;
    all[code] = now;
    localStorage.setItem(COOLDOWN_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
