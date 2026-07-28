// Admin one-time tool: walks the existing image buckets and recompresses
// files that predate client-side compression (see lib/market/image.ts),
// overwriting them in place at the same path so no DB rows need updating.
import { supabase } from './supabase';
import { compressPhoto, squareThumbnail } from './image';

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

const BUCKETS = ['avatars', 'item-images', 'streamer-covers'] as const;
type Bucket = typeof BUCKETS[number];

export interface OptimizeItem { bucket: Bucket; path: string; beforeSize: number }
export interface OptimizeResult extends OptimizeItem { afterSize: number; skipped?: boolean; error?: string }

/** Lists every object across the 3 image buckets (one folder level: userId/file). */
export async function listAllImages(): Promise<OptimizeItem[]> {
  const out: OptimizeItem[] = [];
  for (const bucket of BUCKETS) {
    const { data: folders, error } = await sb().storage.from(bucket).list('', { limit: 1000 });
    if (error) throw error;
    for (const folder of folders ?? []) {
      if (!folder.name || folder.metadata) continue; // real file at top level, not a user folder — skip
      const { data: files, error: e2 } = await sb().storage.from(bucket).list(folder.name, { limit: 1000 });
      if (e2) throw e2;
      for (const f of files ?? []) {
        const size = (f.metadata as { size?: number } | null)?.size;
        if (size) out.push({ bucket, path: `${folder.name}/${f.name}`, beforeSize: size });
      }
    }
  }
  return out;
}

const SKIP_UNDER = { avatars: 40_000, 'item-images': 200_000, 'streamer-covers': 200_000 } as const;

/** Downloads, recompresses and re-uploads one image in place. */
export async function optimizeImage(item: OptimizeItem): Promise<OptimizeResult> {
  if (item.beforeSize < SKIP_UNDER[item.bucket]) return { ...item, afterSize: item.beforeSize, skipped: true };
  try {
    const { data, error } = await sb().storage.from(item.bucket).download(item.path);
    if (error || !data) throw error ?? new Error('download_failed');
    const original = new File([data], item.path.split('/').pop() || 'file', { type: data.type });

    const compressed = item.bucket === 'item-images'
      ? await compressPhoto(original, 1280, 0.82)
      : await squareThumbnail(original, item.bucket === 'avatars' ? 256 : 480, 0.85);

    if (compressed.size >= item.beforeSize) return { ...item, afterSize: item.beforeSize, skipped: true };

    const { error: upErr } = await sb().storage.from(item.bucket).upload(item.path, compressed, {
      upsert: true, contentType: compressed.type,
    });
    if (upErr) throw upErr;
    return { ...item, afterSize: compressed.size };
  } catch (e) {
    return { ...item, afterSize: item.beforeSize, error: e instanceof Error ? e.message : String(e) };
  }
}
