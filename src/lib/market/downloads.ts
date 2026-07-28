// App downloads managed from the admin panel: the installer lives in the
// `downloads` Storage bucket; admins replace it, everyone else just downloads.
import { supabase } from './supabase';

export const OVERLAY_KEY = 'overlay_timer_boss';
const BUCKET = 'downloads';

export interface AppDownload {
  key: string;
  path: string;
  filename: string;
  size: number | null;
  version: string | null;
  updatedAt: number;
}

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

interface Row { key: string; path: string; filename: string; size: number | null; version: string | null; updated_at: string }
const toDownload = (r: Row): AppDownload => ({ key: r.key, path: r.path, filename: r.filename, size: r.size, version: r.version, updatedAt: new Date(r.updated_at).getTime() });

export async function fetchAppDownload(key: string): Promise<AppDownload | null> {
  const { data, error } = await sb().from('app_downloads').select('*').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? toDownload(data as Row) : null;
}

/** Public URL of a stored installer (path already changes each upload, so no cache-bust needed). */
export function downloadUrl(path: string): string {
  return sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Admin: upload a new installer (versioned path), point the row at it, drop the old file. */
export async function uploadAppDownload(key: string, file: File, version: string): Promise<void> {
  const prev = await fetchAppDownload(key).catch(() => null);
  const ext = (file.name.split('.').pop() || 'exe').toLowerCase();
  const path = `${key}/${Date.now()}.${ext}`;
  const { error: upErr } = await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) throw upErr;
  const { error } = await sb().from('app_downloads').upsert({
    key, path, filename: file.name, size: file.size, version: version.trim() || null, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  if (prev?.path && prev.path !== path) await sb().storage.from(BUCKET).remove([prev.path]).catch(() => {});
}
