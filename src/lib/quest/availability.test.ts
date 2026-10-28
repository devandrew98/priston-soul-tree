import { describe, expect, it } from 'vitest';
import { availableList, nextAvailableAt, questInfo, unlockedBetween } from './availability';
import type { Quest, QuestProgress } from './types';

const HOUR = 3_600_000;
const quest = (id: string, over: Partial<Quest> = {}): Quest => ({
  id, name: id, categoryId: 'normal', minLevel: null, maxLevel: null, map: '', npc: '', description: '', objectives: [], baseExp: 100,
  prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});
const done = (...times: number[]): QuestProgress => ({ status: 'completed', deliveries: times, updatedAt: 0 });
const NOW = 1_000_000 * HOUR;

describe('questInfo', () => {
  it('available when level and prerequisites are met', () => {
    expect(questInfo(quest('a', { minLevel: 10 }), { level: 10, progress: {} }, NOW).status).toBe('available');
  });
  it('locked below the minimum level and above the maximum level', () => {
    expect(questInfo(quest('a', { minLevel: 10 }), { level: 9, progress: {} }, NOW)).toMatchObject({ status: 'locked', reasons: ['level_min'] });
    expect(questInfo(quest('a', { maxLevel: 20 }), { level: 21, progress: {} }, NOW)).toMatchObject({ status: 'locked', reasons: ['level_max'] });
  });
  it('locked until every prerequisite was delivered', () => {
    const q = quest('b', { prerequisites: ['a'] });
    expect(questInfo(q, { level: 50, progress: {} }, NOW)).toMatchObject({ status: 'locked', reasons: ['prerequisite'] });
    expect(questInfo(q, { level: 50, progress: { a: done(NOW) } }, NOW).status).toBe('available');
  });
  it('the progress the player recorded', () => {
    const q = quest('a');
    expect(questInfo(q, { level: 1, progress: { a: { status: 'in_progress', deliveries: [], updatedAt: 0 } } }, NOW).status).toBe('in_progress');
    expect(questInfo(q, { level: 1, progress: { a: { status: 'ready', deliveries: [], updatedAt: 0 } } }, NOW).status).toBe('ready');
  });
  it('a quest done once stays completed', () => {
    expect(questInfo(quest('a'), { level: 1, progress: { a: done(NOW - 100 * HOUR) } }, NOW).status).toBe('completed');
  });
  it('a daily quest is available again 24 hours after the last delivery', () => {
    const q = quest('d', { repeatType: 'daily' });
    expect(questInfo(q, { level: 1, progress: { d: done(NOW - 5 * HOUR) } }, NOW)).toMatchObject({ status: 'completed', nextAvailableAt: NOW + 19 * HOUR });
    expect(questInfo(q, { level: 1, progress: { d: done(NOW - 25 * HOUR) } }, NOW).status).toBe('available');
  });
  it('an interval quest uses its own interval; a repeatable one has no wait', () => {
    const q = quest('i', { repeatType: 'interval', repeatIntervalHours: 72 });
    expect(questInfo(q, { level: 1, progress: { i: done(NOW - 71 * HOUR) } }, NOW).status).toBe('completed');
    expect(questInfo(q, { level: 1, progress: { i: done(NOW - 73 * HOUR) } }, NOW).status).toBe('available');
    expect(questInfo(quest('r', { repeatType: 'repeatable' }), { level: 1, progress: { r: done(NOW - 1000) } }, NOW).status).toBe('available');
  });
  it('the delivery history is separate: nextAvailableAt uses only the last one', () => {
    const q = quest('d', { repeatType: 'daily' });
    expect(nextAvailableAt(q, done(NOW - 100 * HOUR, NOW - 2 * HOUR), NOW)).toBe(NOW + 22 * HOUR);
  });
});

describe('availableList', () => {
  it('shows what can be done now and hides the rest', () => {
    const quests = [
      quest('low', { minLevel: 1, maxLevel: 100 }),
      quest('future', { minLevel: 80 }),
      quest('doneonce'),
      quest('off', { active: false }),
      quest('archived', { archived: true }),
      quest('ready'),
    ];
    const progress = { doneonce: done(NOW), ready: { status: 'ready', deliveries: [], updatedAt: 0 } as QuestProgress };
    const ids = availableList(quests, { level: 50, progress }, NOW).map((l) => l.quest.id);
    expect(ids).toEqual(['low', 'ready']);
  });
  it('lower-level quests stay while they can still be done', () => {
    expect(availableList([quest('old', { minLevel: 1, maxLevel: null })], { level: 99, progress: {} }, NOW)).toHaveLength(1);
  });
});

describe('unlockedBetween', () => {
  it('lists the quests unlocked on the way up, without marking them ready', () => {
    const quests = [quest('a', { minLevel: 71 }), quest('b', { minLevel: 73 }), quest('c', { minLevel: 90 }), quest('d', { minLevel: 72, prerequisites: ['x'] })];
    const r = unlockedBetween(quests, { progress: {} }, 70, 73);
    expect(r.map((u) => u.quest.id)).toEqual(['a', 'd', 'b']);
    expect(r.find((u) => u.quest.id === 'd')?.needsPrerequisite).toBe(true);
    expect(r.find((u) => u.quest.id === 'a')?.needsPrerequisite).toBe(false);
  });
  it('skips unique quests already delivered', () => {
    expect(unlockedBetween([quest('a', { minLevel: 71 })], { progress: { a: done(1) } }, 70, 80)).toEqual([]);
  });
});
