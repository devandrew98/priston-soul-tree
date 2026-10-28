import { describe, expect, it } from 'vitest';
import { newCharacter, sanitizeCharacter } from './characters';

describe('sanitizeCharacter', () => {
  it('keeps a good character', () => {
    const c = newCharacter('Meu char');
    c.level = 69; c.expPct = 72.5;
    c.bonuses = { exp_potion: { on: true }, soul_tree: { on: true, percent: 8 } };
    c.progress = { a: { status: 'completed', deliveries: [1, 2], updatedAt: 5 } };
    expect(sanitizeCharacter(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
  it('rejects things that are not characters', () => {
    expect(sanitizeCharacter(null)).toBeNull();
    expect(sanitizeCharacter({ name: 'no id' })).toBeNull();
    expect(sanitizeCharacter('x')).toBeNull();
  });
  it('puts level and percentage in range and cuts long names', () => {
    const c = sanitizeCharacter({ id: 'a', name: 'x'.repeat(100), level: 5000, expPct: 250 })!;
    expect(c.level).toBe(999);
    expect(c.expPct).toBeLessThan(100);
    expect(c.name).toHaveLength(40);
    expect(sanitizeCharacter({ id: 'a', level: -4, expPct: -1 })!).toMatchObject({ level: 1, expPct: 0 });
  });
  it('drops progress with an unknown status and keeps deliveries sorted', () => {
    const c = sanitizeCharacter({ id: 'a', progress: { x: { status: 'hacked', deliveries: [] }, y: { status: 'completed', deliveries: [30, 10, 'bad', 20] } } })!;
    expect(Object.keys(c.progress)).toEqual(['y']);
    expect(c.progress.y.deliveries).toEqual([10, 20, 30]);
  });
  it('keeps the manual bonus percentage in range', () => {
    expect(sanitizeCharacter({ id: 'a', bonuses: { soul_tree: { on: true, percent: 99999 } } })!.bonuses.soul_tree.percent).toBe(1000);
  });
  it('plans keep their shape', () => {
    const c = sanitizeCharacter({ id: 'a', plans: [{ id: 'p', name: 'Plano', questIds: ['a', 'b'], target: { level: 70, pct: 0 }, dataVersion: 3, createdAt: 1, summary: { finalLevel: 70, finalPct: 12.5, preGainExp: 100 } }, 'junk'] })!;
    expect(c.plans).toHaveLength(1);
    expect(c.plans[0]).toMatchObject({ name: 'Plano', questIds: ['a', 'b'], dataVersion: 3, target: { level: 70, pct: 0 } });
  });
});
