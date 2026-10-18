// Client side of the visit counter (see api/visits.ts).
const API = '/api/visits';
const DAY_KEY = 'visit-counted-day';

const today = () => new Date().toISOString().slice(0, 10);

function alreadyCountedToday(): boolean {
  try { return localStorage.getItem(DAY_KEY) === today(); } catch { return false; }
}

async function callApi(method: 'GET' | 'POST'): Promise<number | null> {
  try {
    const res = await fetch(API, { method });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.count === 'number' && Number.isFinite(data.count) ? data.count : null;
  } catch {
    return null; // API not available (e.g. plain local dev) -> the counter simply stays hidden
  }
}

let pending: Promise<number | null> | null = null;

/**
 * Registers this visit (at most once per browser per day — the server dedupes too) and
 * resolves to the current total, or null when the counter isn't available. Memoized, so
 * calling it from main.tsx and from the Home page costs a single request.
 */
export function initVisits(): Promise<number | null> {
  if (!pending) {
    pending = (async () => {
      if (alreadyCountedToday()) return callApi('GET');
      const count = await callApi('POST');
      if (count !== null) {
        try { localStorage.setItem(DAY_KEY, today()); } catch { /* ignore */ }
      }
      return count;
    })();
  }
  return pending;
}
