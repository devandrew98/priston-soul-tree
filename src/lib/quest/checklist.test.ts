import { describe, expect, it } from 'vitest';
import { MAX_QUESTS, checklistUrl, codeFromHash, decodePlan, encodePlan, type ChecklistPlan } from './checklist';

const plan: ChecklistPlan = { v: 1, n: 'Rota até o 211 — Ação', lv: 211, pct: 65.5, q: ['solo-quest-whispering-vale', 'hunt-deius-in-deius-arena'], p: 'Depois de upar: Level 210 · 40%' };

describe('checklist link', () => {
  it('goes through the link and comes back the same, accents included', () => {
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });
  it('the code is safe to put in an address', () => {
    expect(encodePlan(plan)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeFromHash(`#p=${encodePlan(plan)}`)).toBe(encodePlan(plan));
    expect(checklistUrl(plan, 'https://www.pristonzone.com')).toBe(`https://www.pristonzone.com/checklist#p=${encodePlan(plan)}`);
  });
  it('garbage is not a plan', () => {
    for (const bad of ['', '!!!', 'e30', encodePlan({ ...plan, q: 'x' as never })]) expect(decodePlan(bad)).toBeNull();
  });
  it('a link edited by hand cannot bring in strange values', () => {
    const evil = encodePlan({ v: 1, n: 'x'.repeat(500), lv: -5, pct: 1e9, q: [...Array(500).fill('a'), 7 as never, 'y'.repeat(200)], p: 'z'.repeat(999) });
    const r = decodePlan(evil)!;
    expect(r.n).toHaveLength(80);
    expect(r.lv).toBe(0);
    expect(r.pct).toBeLessThan(100);
    expect(r.q).toHaveLength(MAX_QUESTS);
    expect(r.q.every((x) => x === 'a')).toBe(true);
    expect(r.p).toHaveLength(200);
  });
});
