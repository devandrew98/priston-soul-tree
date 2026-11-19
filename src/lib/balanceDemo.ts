// Example data for /balance?demo (local development only): shows how changed classes and untouched classes cross.
// Scenario: every class was tested on 20/10 (patch 1.0). Then Fighter changed (05/11) and was tested again (08/11),
// Mechanician changed (10/11) and was NOT tested again, Knight changed (12/11) and was tested again (14/11).
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
  t('fighter', 255, 5, '2026-11-08', '1.1'),
  t('knight', 215, 5, '2026-11-14', '1.2'),
];

export const DEMO_CHANGES: BalanceChange[] = [
  { id: 'c1', cls: 'fighter', on: '2026-11-05', patch: '1.1', note: 'Skill de área reforçada' },
  { id: 'c2', cls: 'mechanician', on: '2026-11-10', patch: '1.1', note: 'Dano das torres alterado' },
  { id: 'c3', cls: 'knight', on: '2026-11-12', patch: '1.2', note: 'Ajuste de dano' },
];
