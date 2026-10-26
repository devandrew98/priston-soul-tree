import { describe, expect, it } from 'vitest';
import { encodeBuild } from '../skilltree/buildCode';
import { getSkillClass } from '../skilltree/classes';
import { emptySkillBar, placeOnBar } from '../skilltree/skillBar';
import { sanitizeBuild } from '../skilltree/rules';
import { cleanBuildName, createMemoryRepo, openUrlFor, skillBuildPayload, skillBuildSummary, soulBuildPayload } from './userBuilds';

const skills = getSkillClass('fighter').tiers.flatMap((t) => t.skills);
const levels = sanitizeBuild('fighter', 120, [], { [skills[0].id]: 5, [skills[1].id]: 2 });

describe('payload and links', () => {
  it('a saved skill build opens the same build link the share button makes', () => {
    const bar = placeOnBar(emptySkillBar(), skills[0].id, 0, null);
    const payload = skillBuildPayload('fighter', 120, [], levels, bar);
    const url = openUrlFor({ kind: 'skills', name: 'PvP', classSlug: 'fighter', level: 120, payload });
    expect(url).toContain('/skill-tree/fighter?');
    const params = new URLSearchParams(url!.split('?')[1]);
    expect(params.get('build')).toBe(encodeBuild('fighter', [], levels));
    expect(params.get('level')).toBe('120');
    expect(params.get('name')).toBe('PvP');
    expect(params.get('bar')).toMatch(/^[0-9a-f.]{18}$/);
  });

  it('summarizes the points used', () => {
    expect(skillBuildSummary('fighter', levels)).toBe('7 SP · 0 EP');
  });

  it('a saved souls build opens through the existing #b= importer', () => {
    expect(openUrlFor({ kind: 'souls', name: 'x', classSlug: null, level: null, payload: soulBuildPayload('abc_DEF-123') })).toBe('/souls#b=abc_DEF-123');
  });

  it('refuses payloads that were tampered with', () => {
    const bad = (payload: string, kind: 'skills' | 'souls' = 'skills', classSlug: 'fighter' | null = 'fighter') => openUrlFor({ kind, name: 'x', classSlug, level: 1, payload });
    expect(bad('not json')).toBeNull();
    expect(bad(JSON.stringify({ b: '<script>' }))).toBeNull();
    expect(bad(JSON.stringify({ b: 'AAAA' }), 'skills', null)).toBeNull();
    expect(bad(JSON.stringify({ c: '"><img src=x>' }), 'souls', null)).toBeNull();
  });

  it('cleans names', () => {
    expect(cleanBuildName('  Minha   build \n')).toBe('Minha build');
    expect(cleanBuildName('x'.repeat(200))).toHaveLength(60);
  });
});

describe('in-memory repository (same rules as the database)', () => {
  const user = { id: 'u1', nick: 'Ana' };
  const sample = { kind: 'skills' as const, name: 'A', classSlug: 'fighter' as const, level: 120, payload: '{}', summary: '', isPublic: false };

  it('keeps private builds out of the gallery until made public', async () => {
    const repo = createMemoryRepo(user);
    const saved = await repo.save(sample);
    expect(await repo.listPublic('skills', { sort: 'new' })).toHaveLength(0);
    await repo.setPublic(saved.id, true);
    expect(await repo.listPublic('skills', { sort: 'new' })).toHaveLength(1);
    expect((await repo.listMine('skills'))).toHaveLength(1);
  });

  it('counts a like once and removes it on unlike', async () => {
    const repo = createMemoryRepo(user);
    const b = await repo.save({ ...sample, isPublic: true });
    await repo.setLiked(b.id, true);
    await repo.setLiked(b.id, true);
    expect((await repo.listPublic('skills', { sort: 'likes' }))[0].likes).toBe(1);
    expect((await repo.likedIds([b.id])).has(b.id)).toBe(true);
    await repo.setLiked(b.id, false);
    expect((await repo.listPublic('skills', { sort: 'likes' }))[0].likes).toBe(0);
  });

  it('filters the gallery by class and sorts by likes', async () => {
    const repo = createMemoryRepo(user);
    const a = await repo.save({ ...sample, name: 'A', isPublic: true });
    await repo.save({ ...sample, name: 'B', classSlug: 'archer', isPublic: true });
    await repo.setLiked(a.id, true);
    expect((await repo.listPublic('skills', { classSlug: 'archer', sort: 'new' })).map((b) => b.name)).toEqual(['B']);
    expect((await repo.listPublic('skills', { sort: 'likes' }))[0].name).toBe('A');
  });

  it('stops at 40 builds per account', async () => {
    const repo = createMemoryRepo(user);
    for (let i = 0; i < 40; i++) await repo.save(sample);
    await expect(repo.save(sample)).rejects.toThrow(/limit/);
  });
});
