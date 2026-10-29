import { describe, expect, it } from 'vitest';
import { MAX_QUESTS, checklistUrl, codeFromHash, decodePlan, encodePlan, questCode, resolveToken, tokenFor, type ChecklistPlan } from './checklist';

const plan: ChecklistPlan = { v: 2, n: 'Rota até o 211 — Ação', lv: 211, pct: 65.5, q: ['abc12', 'xyz99'], pl: 210, pp: 40 };

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
    const evil = encodePlan({ v: 2, n: 'x'.repeat(500), lv: -5, pct: 1e9, q: [...Array(500).fill('a'), 7 as never, 'y'.repeat(200)], pl: 99999, pp: -3 });
    const r = decodePlan(evil)!;
    expect(r.n).toHaveLength(80);
    expect(r.lv).toBe(0);
    expect(r.pct).toBeLessThan(100);
    expect(r.q).toHaveLength(MAX_QUESTS);
    expect(r.q.every((x) => x === 'a')).toBe(true);
    expect(r.pl).toBe(999);
    expect(r.pp).toBe(0);
  });
  it('links made before the change (version 1, with ids and a text) still open', () => {
    const old = btoa(JSON.stringify({ v: 1, n: 'Antigo', lv: 150, pct: 0, q: ['solo-quest-whispering-vale'], p: 'Depois de upar: Level 149 · 10%' })).replace(/=+$/, '');
    expect(decodePlan(old)).toMatchObject({ n: 'Antigo', lv: 150, q: ['solo-quest-whispering-vale'] });
  });
});

describe('short quest codes', () => {
  const ids = ['kill-85-effigy-in-whispering-vale', 'hunt-deius-in-deius-arena', 'solo-quest-whispering-vale'];
  it('are 5 characters and the same every time', () => {
    for (const id of ids) expect(questCode(id)).toMatch(/^[0-9a-z]{5}$/);
    expect(questCode(ids[0])).toBe(questCode(ids[0]));
  });
  it('lead back to the quest, whether the link has the code or the whole id', () => {
    const quests = ids.map((id) => ({ id }));
    expect(resolveToken(tokenFor(ids[1], ids), quests)).toEqual({ id: ids[1] });
    expect(resolveToken(ids[2], quests)).toEqual({ id: ids[2] });
    expect(resolveToken('zzzzz', quests)).toBeUndefined();
  });
  it('the link gets far shorter than with the whole ids', () => {
    const long = encodePlan({ v: 2, n: 'Rota', lv: 150, pct: 0, q: ids });
    const short = encodePlan({ v: 2, n: 'Rota', lv: 150, pct: 0, q: ids.map((i) => tokenFor(i, ids)) });
    expect(short.length).toBeLessThan(long.length * 0.6);
  });
});
