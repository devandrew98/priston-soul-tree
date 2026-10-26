import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev only: plain `vite` doesn't run the /api functions, so serve /api/visits from the real
 * handler but backed by an in-memory store. That lets the counter be tried locally without
 * Redis — and without ever touching the real production count.
 */
function devVisitsApi(): Plugin {
  return {
    name: 'dev-visits-api',
    apply: 'serve',
    configureServer(server) {
      // Link previews: answer crawler requests with index.html + page-specific Open Graph tags,
      // like the /api/share function does in production (see vercel.json).
      const BOT = /bot|crawler|spider|facebookexternalhit|whatsapp|telegram|discord|slack|twitter|linkedin|embedly|preview/i;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const internal = ['/api/', '/@', '/src/', '/node_modules/'].some((prefix) => url.pathname.startsWith(prefix));
        const skip = req.method !== 'GET' || url.pathname.includes('.') || internal;
        if (skip || !BOT.test(String(req.headers['user-agent'] ?? ''))) return next();
        try {
          const { buildMeta, injectMeta } = await server.ssrLoadModule('/api/share.ts');
          const html = readFileSync(join(server.config.root, 'index.html'), 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(injectMeta(html, buildMeta(url.pathname, Object.fromEntries(url.searchParams)), `http://${req.headers.host}`));
        } catch {
          next(); // never take the dev server down over a preview
        }
      });

      const seen = new Set<string>();
      const counts = new Map<string, number>();
      const store = {
        get: async (key: string) => counts.get(key) ?? null,
        incr: async (key: string) => { const v = (counts.get(key) ?? 0) + 1; counts.set(key, v); return v; },
        setIfNew: async (key: string) => { if (seen.has(key)) return false; seen.add(key); return true; },
      };
      server.middlewares.use('/api/visits', async (req, res) => {
        const { createHandler } = await server.ssrLoadModule('/api/visits.ts');
        const shim = res as typeof res & { status: (code: number) => typeof shim; json: (body: unknown) => void };
        shim.status = (code) => { res.statusCode = code; return shim; };
        shim.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        await createHandler(store)(req as never, shim as never);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devVisitsApi()],
});
