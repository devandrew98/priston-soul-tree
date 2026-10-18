import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';

// Site visit counter. The shown number is BASE_COUNT + what we have counted since this
// feature went live, so it starts from the visits the site already had.
//
// A visit is counted once per visitor per day: the key is a hash of (day + IP), so
// F5 / opening more pages / hammering the endpoint can't inflate it, and no raw IP is
// stored (the hash keys expire after about a day).
export const BASE_COUNT = 3000;
const COUNT_KEY = 'site:visits';
const SEEN_TTL_SECONDS = 60 * 60 * 25;

export interface VisitStore {
  get(key: string): Promise<number | null>;
  incr(key: string): Promise<number>;
  /** Sets the key only if it doesn't exist yet; true when it was newly set. */
  setIfNew(key: string, ttlSeconds: number): Promise<boolean>;
}

export async function readCount(store: VisitStore): Promise<number> {
  return BASE_COUNT + Number((await store.get(COUNT_KEY)) ?? 0);
}

export async function registerVisit(store: VisitStore, ip: string, now = new Date()): Promise<{ counted: boolean; count: number }> {
  const day = now.toISOString().slice(0, 10);
  const id = createHash('sha256').update(`${day}|${ip}|pristonzone`).digest('hex').slice(0, 32);
  const fresh = await store.setIfNew(`visit:${day}:${id}`, SEEN_TTL_SECONDS);
  if (fresh) await store.incr(COUNT_KEY);
  return { counted: fresh, count: await readCount(store) };
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

export function createHandler(store: VisitStore | null) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (!store) return res.status(503).json({ error: 'counter_not_configured' });
    try {
      if (req.method === 'POST') {
        const { count } = await registerVisit(store, clientIp(req));
        return res.status(200).json({ count });
      }
      if (req.method === 'GET') return res.status(200).json({ count: await readCount(store) });
      return res.status(405).json({ error: 'method_not_allowed' });
    } catch {
      return res.status(500).json({ error: 'server_error' });
    }
  };
}

// Same Upstash credentials as /api/build (native Upstash env vars or Vercel KV ones).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const redisStore: VisitStore | null = redis && {
  get: async (key) => (await redis.get<number>(key)) ?? null,
  incr: (key) => redis.incr(key),
  setIfNew: async (key, ttl) => (await redis.set(key, 1, { nx: true, ex: ttl })) === 'OK',
};

export default createHandler(redisStore);
