import { useEffect, useState } from 'react';
import { useAuth } from '../market/store';
import { supabase } from '../../lib/market/supabase';
import { CLAN_FAKE } from '../../lib/clan/repo';

/**
 * Does the signed-in user have access to the clan tool (admin, or leader/vice of a clan)? Only used to show the menu entry
 * and the page; what each person can actually read or change is decided by the database (RLS).
 */
export function useClanAccess(): { loading: boolean; allowed: boolean } {
  const { isLoggedIn, userId, ready } = useAuth();
  const [state, setState] = useState<{ key: string; allowed: boolean } | null>(null);
  const key = isLoggedIn ? userId ?? '' : '';

  useEffect(() => {
    if (CLAN_FAKE || !key || !supabase) return;
    let cancelled = false;
    void Promise.resolve(supabase.rpc('clan_tool_access')).then(({ data, error }) => {
      if (!cancelled) setState({ key, allowed: !error && data === true });
    });
    return () => { cancelled = true; };
  }, [key]);

  if (CLAN_FAKE) return { loading: false, allowed: true };
  if (!ready) return { loading: true, allowed: false };
  if (!key) return { loading: false, allowed: false };
  if (!state || state.key !== key) return { loading: true, allowed: false };
  return { loading: false, allowed: state.allowed };
}
