import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { randomInt, randomUUID } from 'node:crypto';

// Upstash Redis credentials. Works with either the native Upstash env vars or
// the ones a Vercel KV / Marketplace integration injects.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const TTL_SECONDS = 60 * 60 * 24 * 180; // keep shared builds for 180 days
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I to avoid confusion

interface SharedBuild {
  name: string;
  slots: Record<string, unknown>;
  publicEdit: boolean;
  editToken: string;
  createdAt: number;
  updatedAt: number;
}

const key = (code: string) => `build:${code}`;

function genCode(len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

function isSlots(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!redis) return res.status(503).json({ error: 'cloud_not_configured' });

  try {
    if (req.method === 'POST') {
      const { name, slots, publicEdit } = (req.body ?? {}) as Partial<SharedBuild>;
      if (!isSlots(slots)) return res.status(400).json({ error: 'invalid_build' });

      // find an unused code (retry a few times on the rare collision)
      let code = genCode();
      for (let i = 0; i < 6 && (await redis.exists(key(code))); i++) code = genCode();

      const editToken = randomUUID();
      const now = Date.now();
      const rec: SharedBuild = {
        name: String(name ?? 'Build').slice(0, 80),
        slots,
        publicEdit: !!publicEdit,
        editToken,
        createdAt: now,
        updatedAt: now,
      };
      await redis.set(key(code), rec, { ex: TTL_SECONDS });
      return res.status(200).json({ code, editToken });
    }

    if (req.method === 'GET') {
      const code = String(req.query.code ?? '').toUpperCase().trim();
      if (!code) return res.status(400).json({ error: 'missing_code' });
      const rec = (await redis.get(key(code))) as SharedBuild | null;
      if (!rec) return res.status(404).json({ error: 'not_found' });
      // never leak the editToken to readers
      return res.status(200).json({
        code,
        name: rec.name,
        slots: rec.slots,
        publicEdit: rec.publicEdit,
        updatedAt: rec.updatedAt,
      });
    }

    if (req.method === 'PUT') {
      const { code, editToken, name, slots, publicEdit } = (req.body ?? {}) as Partial<SharedBuild> & { code?: string };
      const c = String(code ?? '').toUpperCase().trim();
      if (!c) return res.status(400).json({ error: 'missing_code' });
      const rec = (await redis.get(key(c))) as SharedBuild | null;
      if (!rec) return res.status(404).json({ error: 'not_found' });

      const isCreator = !!editToken && editToken === rec.editToken;
      const allowed = rec.publicEdit || isCreator;
      if (!allowed) return res.status(403).json({ error: 'forbidden' });
      if (slots !== undefined && !isSlots(slots)) return res.status(400).json({ error: 'invalid_build' });

      const updated: SharedBuild = {
        ...rec,
        name: name !== undefined ? String(name).slice(0, 80) : rec.name,
        slots: slots !== undefined ? slots : rec.slots,
        // only the creator may flip the public/private edit flag
        publicEdit: isCreator && typeof publicEdit === 'boolean' ? publicEdit : rec.publicEdit,
        updatedAt: Date.now(),
      };
      await redis.set(key(c), updated, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
}
