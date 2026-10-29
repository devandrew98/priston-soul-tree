import { describe, expect, it } from 'vitest';
import { memoryApi } from './api';

// The in-memory version follows the same rules as supabase/35_dor_diary.sql (versions, conflicts, trash, history).
describe('versioned records', () => {
  it('refuses a stale save instead of overwriting it', async () => {
    const api = memoryApi();
    const a = await api.save(null, 'sleep', { date: '2026-10-20', hours: 6 }, null, 0);
    if (!a.ok) throw new Error('create failed');
    const first = await api.save(a.record.id, 'sleep', { date: '2026-10-20', hours: 7 }, null, 1);
    expect(first.ok).toBe(true);
    const stale = await api.save(a.record.id, 'sleep', { date: '2026-10-20', hours: 8 }, null, 1);
    expect(stale.ok).toBe(false);
    expect(stale.ok === false && stale.record.data).toMatchObject({ hours: 7 });
  });

  it('keeps every version and can bring an old one back as a new version', async () => {
    const api = memoryApi();
    const a = await api.save(null, 'sleep', { date: '2026-10-20', hours: 6 }, null, 0);
    if (!a.ok) throw new Error('create failed');
    await api.save(a.record.id, 'sleep', { date: '2026-10-20', hours: 9 }, null, 1);
    const back = await api.restoreVersion(a.record.id, 1);
    expect(back.data).toMatchObject({ hours: 6 });
    expect(back.version).toBe(3);
    expect((await api.history(a.record.id)).map((h) => h.op)).toEqual(['create', 'update', 'restore_version']);
  });

  it('deleting goes to the trash and can be undone; the history stays', async () => {
    const api = memoryApi();
    const a = await api.save(null, 'nopain', { date: '2026-10-20' }, null, 0);
    if (!a.ok) throw new Error('create failed');
    const del = await api.remove(a.record.id, 1);
    expect(del.ok && del.record.deletedAt).toBeTruthy();
    expect((await api.list())[0].deletedAt).toBeTruthy();
    const back = await api.restore(a.record.id);
    expect(back.deletedAt).toBeNull();
    expect((await api.history(a.record.id)).map((h) => h.op)).toEqual(['create', 'delete', 'restore']);
  });
});
