// The leader's board: a note for the players and the signs placed on the Bless Castle map.
// Positions are percentages of the map image (0-100), so they stay right at any screen size.

export const MARKER_TYPES = ['attack', 'defend', 'rebuff', 'enemy'] as const;
export type MarkerType = (typeof MARKER_TYPES)[number];

export interface MapMarker { id: string; type: MarkerType; x: number; y: number; label: string }
export interface BoardData { note: string; markers: MapMarker[] }

export const NOTE_MAX = 600;
export const MAX_MARKERS = 60;
export const LABEL_MAX = 24;
export const EMPTY_BOARD: BoardData = { note: '', markers: [] };

export const MARKER_ICON: Record<MarkerType, string> = { attack: '⚔️', defend: '🛡️', rebuff: '✨', enemy: '👹' };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isType = (v: unknown): v is MarkerType => typeof v === 'string' && (MARKER_TYPES as readonly string[]).includes(v);

/** Whatever comes from the database / a link is cleaned before it is shown: known types only, positions inside the map, short labels. */
export function sanitizeMarkers(raw: unknown): MapMarker[] {
  if (!Array.isArray(raw)) return [];
  const out: MapMarker[] = [];
  for (const r of raw) {
    if (out.length >= MAX_MARKERS) break;
    if (!r || typeof r !== 'object') continue;
    const m = r as Record<string, unknown>;
    const x = Number(m.x), y = Number(m.y);
    if (!isType(m.type) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      id: typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : `m${out.length}`,
      type: m.type,
      x: Math.round(clamp(x, 0, 100) * 100) / 100,
      y: Math.round(clamp(y, 0, 100) * 100) / 100,
      label: typeof m.label === 'string' ? m.label.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, LABEL_MAX) : '',
    });
  }
  return out;
}

export function sanitizeBoard(raw: { note?: unknown; markers?: unknown } | null | undefined): BoardData {
  return {
    note: typeof raw?.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '',
    markers: sanitizeMarkers(raw?.markers),
  };
}
