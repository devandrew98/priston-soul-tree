// React wiring for the real Supabase session (Phase 1). Tracks the logged-in
// user id + their profile and keeps them in sync via onAuthStateChange.
// When the backend is not configured this stays inert and the mock store runs.
import { useSyncExternalStore } from 'react';
import { BACKEND_ENABLED, supabase } from '../../lib/market/supabase';
import { fetchProfile, profileToSeller, type ProfileRow } from '../../lib/market/auth';
import type { Seller } from '../../lib/market/types';

interface SessionState {
  ready: boolean;      // finished the initial session check
  userId: string | null;
  profile: Seller | null;
  raw: ProfileRow | null;
}

let state: SessionState = { ready: !BACKEND_ENABLED, userId: null, profile: null, raw: null };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }
function set(patch: Partial<SessionState>) { state = { ...state, ...patch }; emit(); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

async function loadProfile(userId: string | null) {
  if (!userId) { set({ userId: null, profile: null, raw: null, ready: true }); return; }
  try {
    const row = await fetchProfile(userId);
    set({ userId, raw: row, profile: row ? profileToSeller(row) : null, ready: true });
  } catch {
    set({ userId, raw: null, profile: null, ready: true });
  }
}

if (BACKEND_ENABLED && supabase) {
  supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user?.id ?? null));
  // IMPORTANT: never run DB queries synchronously inside onAuthStateChange —
  // supabase-js holds an auth lock during the callback and awaiting a query
  // there deadlocks signIn/getSession. Defer out of the callback.
  supabase.auth.onAuthStateChange((_event, sess) => {
    const uid = sess?.user?.id ?? null;
    setTimeout(() => { void loadProfile(uid); }, 0);
  });
}

/** Force a profile re-fetch (e.g. after updating the avatar). */
export function refreshProfile() { if (state.userId) void loadProfile(state.userId); }

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
