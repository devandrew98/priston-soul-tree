// Supabase browser client for the Marketplace.
// When the env vars are absent (e.g. local dev before setup), the client is
// null and the app transparently falls back to the local mock store — nothing
// breaks. Wire the real backend by setting these in .env.local / Vercel:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when a real Supabase backend is configured. */
export const BACKEND_ENABLED = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = BACKEND_ENABLED
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
