// =============================================================================
// souls.ts — catálogo de Souls do jogo (fonte de dados central da Árvore).
//
// As souls vêm de `src/data/souls.json` (raspadas da wiki oficial). Este módulo
// só CARREGA esse JSON e expõe formas convenientes pra UI e pro motor de IA:
//   - SOULS         : a lista crua, tipada como Soul[]
//   - SOULS_BY_ID   : mapa id -> Soul (lookup O(1))
//   - CATEGORY_*    : rótulos/ícones das 4 categorias
//   - STAT_META / ALL_STATS : metadados de cada atributo (derivados das souls)
//   - helpers de filtro por categoria/atributo
//
// ⚠️ Para AJUSTAR o valor de uma soul (ex.: o fix do Crios Soul), edite o
//    `src/data/souls.json`, NÃO este arquivo. Cada soul referencia por `id`,
//    então builds salvas continuam válidas mesmo que o `name` mude.
// =============================================================================

import raw from '../data/souls.json';
import type { Soul, Category, Unit } from './types';

/** Todas as souls do jogo (a ordem do JSON é preservada). */
export const SOULS: Soul[] = raw as Soul[];

/** Lookup rápido por id — usado em toda parte (Planner, editor, motor, filler). */
export const SOULS_BY_ID: Record<string, Soul> = Object.fromEntries(
  SOULS.map((s) => [s.id, s]),
);

/** Nome exibido de cada categoria (termos do jogo, iguais em PT/EN). */
export const CATEGORY_LABEL: Record<Category, string> = {
  attack: 'Attack',
  defense: 'Defense',
  support: 'Support',
  pvp: 'PvP',
};

/** Emoji de cada categoria (usado em chips/legendas). */
export const CATEGORY_ICON: Record<Category, string> = {
  attack: '⚔️',
  defense: '🛡️',
  support: '⏳',
  pvp: '⚔',
};

/** Metadados de um atributo (stat), derivados das souls que o concedem. */
export interface StatMeta {
  key: string;
  label: string;
  unit: Unit;
  category: Category; // categoria principal em que esse stat aparece primeiro
}

// Constrói o mapa de metadados varrendo TODAS as souls uma vez.
// "Primeira ocorrência vence": o primeiro soul que traz o atributo define o
// rótulo/unidade/categoria dele (evita duplicar e mantém consistência).
export const STAT_META: Record<string, StatMeta> = (() => {
  const m: Record<string, StatMeta> = {};
  for (const s of SOULS) {
    for (const st of s.stats) {
      if (!m[st.stat]) {
        m[st.stat] = { key: st.stat, label: st.statLabel, unit: st.unit, category: s.category };
      }
    }
  }
  return m;
})();

/** Lista de todos os atributos existentes (para os filtros do Inventário). */
export const ALL_STATS: StatMeta[] = Object.values(STAT_META);

/** Todas as souls de uma categoria (Attack/Defense/Support/PvP). */
export function soulsForCategory(cat: Category): Soul[] {
  return SOULS.filter((s) => s.category === cat);
}

/** Todas as souls que concedem um determinado atributo (ex.: 'absorb'). */
export function soulsForStat(stat: string): Soul[] {
  return SOULS.filter((s) => s.stats.some((st) => st.stat === stat));
}
