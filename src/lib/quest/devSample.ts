// ILLUSTRATIVE DATA, DEVELOPMENT ONLY. These quests and EXP values are made up to try the screens locally
// (`npm run dev` + ?fakedb). They are never loaded in production and are NOT game values.
import { DEFAULT_SETTINGS, type ExpBonus, type ExpLevel, type Quest, type QuestCategory, type QuestData } from './types';

export const SAMPLE_BANNER = 'DADOS ILUSTRATIVOS DE DESENVOLVIMENTO — não são valores do jogo';

export const defaultCategories = (): QuestCategory[] => [
  { id: 'normal', name: 'Quests normais', sort: 1, color: '#6fa8dc', active: true, builtin: true },
  { id: 'boss', name: 'Quests de bosses', sort: 2, color: '#e06666', active: true, builtin: true },
  { id: 'daily', name: 'Quests diárias', sort: 3, color: '#93c47d', active: true, builtin: true },
  { id: 'repeatable', name: 'Quests repetíveis', sort: 4, color: '#f6b26b', active: true, builtin: true },
  { id: 'special', name: 'Quests especiais', sort: 5, color: '#c27ba0', active: true, builtin: true },
];

/** The four initial bonuses of the brief (these are the only "official" values; the percentages can be changed by the admin). */
export const defaultBonuses = (): ExpBonus[] => [
  { id: 'exp_potion', name: 'EXP Potion', kind: 'toggle', percent: 30, enabled: true, appliesTo: [], sort: 1, builtin: true },
  { id: 'world_buff', name: 'World Buff', kind: 'toggle', percent: 5, enabled: true, appliesTo: [], sort: 2, builtin: true },
  { id: 'fast_honey', name: 'Fast Honey', kind: 'toggle', percent: 10, enabled: true, appliesTo: [], sort: 3, builtin: true },
  { id: 'soul_tree', name: 'Soul Tree', kind: 'manual', percent: 0, enabled: true, appliesTo: [], sort: 4, builtin: true },
];

const q = (id: string, name: string, over: Partial<Quest>): Quest => ({
  id, name: `[EXEMPLO] ${name}`, categoryId: 'normal', minLevel: null, maxLevel: null, map: 'Mapa de exemplo', npc: 'NPC de exemplo', description: 'Quest ilustrativa para testar a tela.',
  objectives: [{ kind: 'monster', name: 'Monstro de exemplo', qty: 10 }], baseExp: null, prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});

export function sampleData(): QuestData {
  // EXP needed per level: invented, smooth growth, levels 60-130.
  const expLevels: ExpLevel[] = [];
  for (let level = 60; level <= 130; level++) expLevels.push({ level, value: Math.round(1_000_000 * Math.pow(1.07, level - 60)), active: true });
  const quests: Quest[] = [
    q('EX-001', 'Primeiros passos', { minLevel: 60, maxLevel: 70, baseExp: 250_000 }),
    q('EX-002', 'Continuação dos passos', { minLevel: 62, prerequisites: ['EX-001'], baseExp: 400_000 }),
    q('EX-003', 'Limpeza da caverna', { minLevel: 65, baseExp: 900_000, objectives: [{ kind: 'monster', name: 'Morcego de exemplo', qty: 30 }, { kind: 'item', name: 'Presa de exemplo', qty: 5 }] }),
    q('EX-004', 'Caçada ao chefe da caverna', { categoryId: 'boss', minLevel: 68, baseExp: 1_500_000, objectives: [{ kind: 'boss', name: 'Chefe de exemplo', qty: 1 }] }),
    q('EX-005', 'Entrega diária', { categoryId: 'daily', minLevel: 60, repeatType: 'daily', baseExp: 120_000 }),
    q('EX-006', 'Coleta repetível', { categoryId: 'repeatable', minLevel: 64, repeatType: 'repeatable', baseExp: 150_000 }),
    q('EX-007', 'Missão a cada 3 dias', { categoryId: 'special', minLevel: 66, repeatType: 'interval', repeatIntervalHours: 72, baseExp: 700_000 }),
    q('EX-008', 'Quest de nível alto', { minLevel: 90, baseExp: 5_000_000 }),
    q('EX-009', 'Quest sem EXP cadastrada', { minLevel: 60, baseExp: null }),
    q('EX-010', 'Quest do level 70 em diante', { minLevel: 70, baseExp: 3_000_000, prerequisites: ['EX-003'] }),
  ];
  return { categories: defaultCategories(), quests, expLevels, bonuses: defaultBonuses(), settings: { ...DEFAULT_SETTINGS, dataVersion: 1 } };
}
