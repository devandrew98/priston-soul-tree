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
