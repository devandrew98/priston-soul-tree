// App downloads managed from the admin panel: `path` holds the direct download
// URL of a GitHub Release asset (unlimited bandwidth, doesn't touch Supabase
// Storage/egress). Admins paste the link after uploading the file to a Release;
// everyone else just downloads.
import { supabase } from './supabase';

export const OVERLAY_KEY = 'overlay_timer_boss';

export interface AppDownload {
  key: string;
  path: string; // full URL of the release asset
  filename: string;
  size: number | null;
  version: string | null;
  notes: string | null;
  updatedAt: number;
}

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

interface Row { key: string; path: string; filename: string; size: number | null; version: string | null; notes: string | null; updated_at: string }
const toDownload = (r: Row): AppDownload => ({ key: r.key, path: r.path, filename: r.filename, size: r.size, version: r.version, notes: r.notes, updatedAt: new Date(r.updated_at).getTime() });

export async function fetchAppDownload(key: string): Promise<AppDownload | null> {
  const { data, error } = await sb().from('app_downloads').select('*').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? toDownload(data as Row) : null;
}

/** `path` is already an absolute URL (GitHub Release asset). */
export function downloadUrl(path: string): string {
  return path;
}

/** Admin: point the download at a GitHub Release asset URL, with optional changelog notes. */
export async function setAppDownload(key: string, input: { url: string; filename: string; version: string; size: number | null; notes: string }): Promise<void> {
  const { error } = await sb().from('app_downloads').upsert({
    key, path: input.url.trim(), filename: input.filename.trim() || 'download.exe',
    size: input.size, version: input.version.trim() || null, notes: input.notes.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
