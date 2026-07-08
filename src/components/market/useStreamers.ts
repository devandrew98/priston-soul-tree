// Streamers data hook — DB (with light polling so live status refreshes) or mock.
import { useCallback, useEffect, useState } from 'react';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { MOCK_STREAMERS, fetchStreamers, type Streamer } from '../../lib/market/streamers';

const POLL_MS = 60_000;

export function useStreamers(): { streamers: Streamer[]; online: Streamer[]; offline: Streamer[]; loading: boolean; reload: () => void } {
  const [streamers, setStreamers] = useState<Streamer[]>(BACKEND_ENABLED ? [] : MOCK_STREAMERS);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    if (!BACKEND_ENABLED) return;
    fetchStreamers()
      .then((s) => setStreamers(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load, tick]);

  const reload = () => setTick((x) => x + 1);
  const online = streamers.filter((s) => s.live);
  const offline = streamers.filter((s) => !s.live);
  return { streamers, online, offline, loading, reload };
}
