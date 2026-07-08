// DB layer for the Streamers tab (Supabase). Public read; admin-only writes.
import { supabase } from './supabase';
import { uploadToBucket } from './auth';

export type Platform = 'twitch' | 'youtube';

export interface Streamer {
  id: string;
  name: string;
  platform: Platform;
  handle: string;
  url: string;
  coverUrl: string;
  live: boolean;
  viewers: number;
  title: string;
  sort: number;
}

interface StreamerRow {
  id: string; name: string; platform: Platform; handle: string; url: string;
  cover_url: string; live: boolean; viewers: number; title: string; sort: number;
}

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

function rowToStreamer(r: StreamerRow): Streamer {
  return {
    id: r.id, name: r.name, platform: r.platform, handle: r.handle, url: r.url,
    coverUrl: r.cover_url, live: r.live, viewers: r.viewers, title: r.title, sort: r.sort,
  };
}

/** Channel URL for a streamer — explicit url wins, else derived from the handle. */
export function channelUrl(s: { platform: Platform; handle: string; url: string }): string {
  if (s.url) return s.url;
  if (s.platform === 'twitch') return `https://twitch.tv/${s.handle}`;
  const h = s.handle.startsWith('UC') ? `channel/${s.handle}` : s.handle.startsWith('@') ? s.handle : `@${s.handle}`;
  return `https://youtube.com/${h}`;
}

export async function fetchStreamers(): Promise<Streamer[]> {
  const { data, error } = await sb().from('streamers').select('*').order('sort', { ascending: true }).order('name', { ascending: true });
  if (error) throw error;
  return (data as StreamerRow[]).map(rowToStreamer);
}

export interface StreamerInput {
  name: string;
  platform: Platform;
  handle: string;
  url: string;
  sort: number;
  live?: boolean;
}

export async function createStreamer(input: StreamerInput, coverUrl: string): Promise<void> {
  const { error } = await sb().from('streamers').insert({
    name: input.name, platform: input.platform, handle: input.handle, url: input.url,
    sort: input.sort, cover_url: coverUrl, live: input.live ?? false,
  });
  if (error) throw error;
}

export async function updateStreamer(id: string, patch: Partial<StreamerInput> & { coverUrl?: string }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.platform !== undefined) row.platform = patch.platform;
  if (patch.handle !== undefined) row.handle = patch.handle;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.sort !== undefined) row.sort = patch.sort;
  if (patch.live !== undefined) row.live = patch.live;
  if (patch.coverUrl !== undefined) row.cover_url = patch.coverUrl;
  const { error } = await sb().from('streamers').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteStreamer(id: string): Promise<void> {
  const { error } = await sb().from('streamers').delete().eq('id', id);
  if (error) throw error;
}

/** Upload a square cover image; returns its public URL. */
export async function uploadStreamerCover(userId: string, file: File): Promise<string> {
  return uploadToBucket('streamer-covers', userId, file);
}

// Demo data for local dev without a backend (BACKEND_ENABLED === false).
export const MOCK_STREAMERS: Streamer[] = [
  { id: 'm1', name: 'HaDDeR', platform: 'twitch', handle: 'hadder', url: '', coverUrl: '', live: true, viewers: 42, title: 'Farmando Sylla — vem!', sort: 0 },
  { id: 'm2', name: 'CommitaoDourado', platform: 'youtube', handle: '@commitao', url: '', coverUrl: '', live: true, viewers: 0, title: 'Boss run ao vivo', sort: 1 },
  { id: 'm3', name: 'Icelady', platform: 'twitch', handle: 'icelady', url: '', coverUrl: '', live: false, viewers: 0, title: '', sort: 2 },
];
