import { isNumberType, type MarkerType } from '../../lib/clan/board';

const NAMES = {
  pt: { attack: 'Atacar', defend: 'Defender', rebuff: 'Rebuff', enemy: 'Inimigos', arrow: 'Seta (início)' },
  en: { attack: 'Attack', defend: 'Defend', rebuff: 'Rebuff', enemy: 'Enemies', arrow: 'Start arrow' },
} as const;

/** Display name of a sign type. */
export function markerName(t: MarkerType, lang: 'pt' | 'en'): string {
  return isNumberType(t) ? `Nº ${t.slice(1)}` : NAMES[lang][t as keyof (typeof NAMES)['pt']];
}
