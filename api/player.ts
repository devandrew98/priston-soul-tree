import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomInt } from 'node:crypto';

// Lightweight per-player storage: the whole app state (inventory + builds +
// fusion level) is kept in Redis under a short "player code". No password —
// whoever has the code can read/write it (good enough for a free build planner).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const TTL_SECONDS = 60 * 60 * 24 * 365; // keep a player's data for 1 year (refreshed on save)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I
const MAX_BYTES = 200_000; // guard against oversized payloads

const key = (code: string) => `player:${code}`;

function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

function validData(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  try {
    return JSON.stringify(v).length <= MAX_BYTES;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) return res.status(503).json({ error: 'cloud_not_configured' });

  try {
    if (req.method === 'GET') {
      const code = String(req.query.code ?? '').toUpperCase().trim();
      if (!code) return res.status(400).json({ error: 'missing_code' });
      const data = await redis.get(key(code));
      if (data == null) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json({ code, data });
    }

    if (req.method === 'POST') {
      // Create a new player and return a fresh code.
      const { data } = (req.body ?? {}) as { data?: unknown };
      if (!validData(data)) return res.status(400).json({ error: 'invalid_data' });
      let code = genCode();
      for (let i = 0; i < 6 && (await redis.exists(key(code))); i++) code = genCode();
      await redis.set(key(code), data, { ex: TTL_SECONDS });
      return res.status(200).json({ code });
    }

    if (req.method === 'PUT') {
      // Update an existing player's data (creates it if the code is free).
      const { code, data } = (req.body ?? {}) as { code?: string; data?: unknown };
      const c = String(code ?? '').toUpperCase().trim();
      if (!c) return res.status(400).json({ error: 'missing_code' });
      if (!validData(data)) return res.status(400).json({ error: 'invalid_data' });
      await redis.set(key(c), data, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch {
    return res.status(500).json({ error: 'server_error' });
  }
}
