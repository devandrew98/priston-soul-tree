// Generic site-wide on/off flags (e.g. "marketplace") editable from the admin
// panel — lets a section be temporarily disabled without touching any code.
import { supabase } from './supabase';

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

/** Fails open (true) on error/missing row — a glitch here should never hide a
 *  whole section from every visitor. */
export async function fetchSiteFlag(key: string): Promise<boolean> {
  const { data, error } = await sb().from('site_settings').select('enabled').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.enabled : true;
}

export async function setSiteFlag(key: string, enabled: boolean): Promise<void> {
  const { error } = await sb().from('site_settings').upsert({ key, enabled, updated_at: new Date().toISOString() });
  if (error) throw error;
}
