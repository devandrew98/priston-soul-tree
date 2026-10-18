import { describe, expect, it } from 'vitest';
import { BASE_COUNT, createHandler, readCount, registerVisit, type VisitStore } from '../../api/visits';

/** In-memory stand-in for Redis. */
function fakeStore(): VisitStore & { data: Map<string, number> } {
  const data = new Map<string, number>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    incr: async (k) => { const v = (data.get(k) ?? 0) + 1; data.set(k, v); return v; },
    setIfNew: async (k) => { if (data.has(k)) return false; data.set(k, 1); return true; },
  };
}

const day1 = new Date('2026-10-18T12:00:00Z');
const day2 = new Date('2026-10-19T12:00:00Z');

describe('visit counter', () => {
  it('starts at 3000 before anyone is counted', async () => {
    expect(BASE_COUNT).toBe(3000);
    expect(await readCount(fakeStore())).toBe(3000);
  });

  it('counts a visitor once per day, however many times they come back', async () => {
    const store = fakeStore();
    expect(await registerVisit(store, '1.1.1.1', day1)).toEqual({ counted: true, count: 3001 });
    expect(await registerVisit(store, '1.1.1.1', day1)).toEqual({ counted: false, count: 3001 });
    expect(await registerVisit(store, '2.2.2.2', day1)).toEqual({ counted: true, count: 3002 });
  });

  it('counts the same visitor again on a new day', async () => {
    const store = fakeStore();
    await registerVisit(store, '1.1.1.1', day1);
    expect((await registerVisit(store, '1.1.1.1', day2)).count).toBe(3002);
  });

  it('never stores the raw IP', async () => {
    const store = fakeStore();
    await registerVisit(store, '203.0.113.9', day1);
    expect([...store.data.keys()].some((k) => k.includes('203.0.113.9'))).toBe(false);
  });
});

describe('visits handler', () => {
  const call = async (store: VisitStore | null, method: string) => {
    let status = 0;
    let body: unknown;
    const res = {
      setHeader: () => res,
      status: (code: number) => { status = code; return res; },
      json: (payload: unknown) => { body = payload; return res; },
    };
    await createHandler(store)({ method, headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }, socket: {} } as never, res as never);
    return { status, body };
  };

  it('POST counts and GET only reads', async () => {
    const store = fakeStore();
    expect(await call(store, 'POST')).toEqual({ status: 200, body: { count: 3001 } });
    expect(await call(store, 'POST')).toEqual({ status: 200, body: { count: 3001 } }); // same visitor, same day
    expect(await call(store, 'GET')).toEqual({ status: 200, body: { count: 3001 } });
  });

  it('answers 503 when the counter has no storage and 405 for other methods', async () => {
    expect((await call(null, 'GET')).status).toBe(503);
    expect((await call(fakeStore(), 'DELETE')).status).toBe(405);
  });
});
