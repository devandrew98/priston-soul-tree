// In-game shop location: the two city maps + grid-coordinate helpers.
// A location is stored as a relative point (x,y in 0..1) on the city map; the
// A1–J10 coordinate is derived from it for display.
import type { ShopCity, ShopLocation } from './types';

export interface ShopCityDef {
  id: ShopCity;
  name: string;
  img: string;
}

export const SHOP_CITIES: ShopCityDef[] = [
  { id: 'ricarten', name: 'Ricarten', img: '/maps/ricarten.jpg' },
  { id: 'pillai', name: 'Pillai', img: '/maps/pillai.jpg' },
];

export const shopCity = (id: ShopCity): ShopCityDef => SHOP_CITIES.find((c) => c.id === id) ?? SHOP_CITIES[0];

const COLS = 10; // 1..10 (colunas, esquerda→direita)
const ROWS = 10; // A..J (linhas, topo→baixo)
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Grid coordinate for a relative point, e.g. { x:0.55, y:0.35 } -> "D6". */
export function shopCoord(loc: { x: number; y: number }): string {
  const col = Math.min(COLS - 1, Math.floor(clamp01(loc.x) * COLS)) + 1; // 1..10
  const rowIdx = Math.min(ROWS - 1, Math.floor(clamp01(loc.y) * ROWS));   // 0..9
  return `${String.fromCharCode(65 + rowIdx)}${col}`;
}

/** Human label like "Ricarten — D6". */
export function shopLabel(loc: ShopLocation): string {
  return `${shopCity(loc.city).name} — ${shopCoord(loc)}`;
}
