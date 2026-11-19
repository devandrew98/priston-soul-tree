// Example data for /balance?demo (local development only): shows how the classes changed in the latest patch cross with the ones that were not.
// Scenario: every class was tested on 20/10 (patch 1.0); Archer was tested a second time on 25/10 and did worse.
// Patch 2.0 (12/11) changed Fighter, Knight and Atalanta. Fighter and Knight were tested again (14/11, patch 2.0); Atalanta was NOT.
import type { BalanceChange, BalanceTest } from './balance';
import type { ClassSlug } from './skilltree/types';

let n = 0;
const t = (cls: ClassSlug, mobs: number, minutes: number, testedOn: string, patch: string, tester = 'Demo'): BalanceTest => ({
  id: `demo${++n}`, cls, mobs, seconds: minutes * 60, tester, level: 100, place: 'Whispering Vale', notes: '', patch, testedOn, mode: 'aoe', createdAt: testedOn,
});

export const DEMO_TESTS: BalanceTest[] = [
  t('fighter', 200, 5, '2026-10-20', '1.0'), t('archer', 230, 5, '2026-10-20', '1.0'), t('mechanician', 240, 5, '2026-10-20', '1.0'),
  t('assassin', 215, 5, '2026-10-20', '1.0'), t('pikeman', 180, 5, '2026-10-20', '1.0'), t('knight', 190, 5, '2026-10-20', '1.0'),
  t('shaman', 250, 5, '2026-10-20', '1.0'), t('priestess', 160, 5, '2026-10-20', '1.0'), t('magician', 150, 5, '2026-10-20', '1.0'),
  t('atalanta', 270, 5, '2026-10-20', '1.0'),
  t('archer', 205, 5, '2026-10-25', '1.0'), // a worse second test: the view keeps the best one (230)
  t('fighter', 255, 5, '2026-11-14', '2.0'),
  t('knight', 215, 5, '2026-11-14', '2.0'),
];

export const DEMO_CHANGES: BalanceChange[] = [
  { id: 'c1', cls: 'fighter', on: '2026-11-12', patch: '2.0', note: 'Skill de área reforçada' },
  { id: 'c2', cls: 'knight', on: '2026-11-12', patch: '2.0', note: 'Ajuste de dano' },
  { id: 'c3', cls: 'atalanta', on: '2026-11-12', patch: '2.0', note: 'Alcance alterado' },
];
