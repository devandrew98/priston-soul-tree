// The leader's board: the date of the Bless Castle, a note for the players, the signs placed on the map and the pencil drawings.
// Positions are percentages of the map image (0-100), so they stay right at any screen size.

export const NUMBER_TYPES = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'] as const;
export const MARKER_TYPES = ['attack', 'defend', 'rebuff', 'enemy', 'arrow', ...NUMBER_TYPES] as const;
export type MarkerType = (typeof MARKER_TYPES)[number];
export const isNumberType = (t: MarkerType): boolean => (NUMBER_TYPES as readonly string[]).includes(t);

/** `rot` is the direction of an arrow in degrees (0 = up, clockwise); other signs ignore it. */
export interface MapMarker { id: string; type: MarkerType; x: number; y: number; label: string; rot: number }

export const STROKE_COLORS = ['#ff4040', '#ffd24a', '#ffffff', '#4aa8ff', '#6fcf7f'] as const;
export type StrokeColor = (typeof STROKE_COLORS)[number];
/** One pencil line: `pts` is flat [x1, y1, x2, y2, ...] in map percentages. */
export interface Stroke { id: string; color: StrokeColor; pts: number[] }

export interface BoardData { note: string; markers: MapMarker[]; strokes: Stroke[]; bcAt: string | null }

export const NOTE_MAX = 600;
export const MAX_MARKERS = 60;
export const LABEL_MAX = 24;
export const MAX_STROKES = 60;
export const MAX_STROKE_POINTS = 120;
export const EMPTY_BOARD: BoardData = { note: '', markers: [], strokes: [], bcAt: null };

export const MARKER_ICON: Record<MarkerType, string> = {
  attack: '⚔️', defend: '🛡️', rebuff: '✨', enemy: '👹', arrow: '⬆',
  n1: '1', n2: '2', n3: '3', n4: '4', n5: '5', n6: '6', n7: '7',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number, d = 100) => Math.round(n * d) / d;
const isType = (v: unknown): v is MarkerType => typeof v === 'string' && (MARKER_TYPES as readonly string[]).includes(v);
const isColor = (v: unknown): v is StrokeColor => typeof v === 'string' && (STROKE_COLORS as readonly string[]).includes(v);

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
    const rot = Number(m.rot);
    out.push({
      id: typeof m.id === 'string' && m.id ? m.id.slice(0, 40) : `m${out.length}`,
      type: m.type,
      x: round(clamp(x, 0, 100)),
      y: round(clamp(y, 0, 100)),
      label: typeof m.label === 'string' ? m.label.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, LABEL_MAX) : '',
      rot: Number.isFinite(rot) ? ((Math.round(rot) % 360) + 360) % 360 : 0,
    });
  }
  return out;
}

export function sanitizeStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return [];
  const out: Stroke[] = [];
  for (const r of raw) {
    if (out.length >= MAX_STROKES) break;
    if (!r || typeof r !== 'object') continue;
    const s = r as Record<string, unknown>;
    if (!isColor(s.color) || !Array.isArray(s.pts)) continue;
    const pts: number[] = [];
    for (let i = 0; i + 1 < s.pts.length && pts.length < MAX_STROKE_POINTS * 2; i += 2) {
      const x = Number(s.pts[i]), y = Number(s.pts[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push(round(clamp(x, 0, 100), 10), round(clamp(y, 0, 100), 10));
    }
    if (pts.length < 4) continue;
    out.push({ id: typeof s.id === 'string' && s.id ? s.id.slice(0, 40) : `s${out.length}`, color: s.color, pts });
  }
  return out;
}

/** A valid ISO date (as sent by the database) or null. */
export function sanitizeBcAt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function sanitizeBoard(raw: { note?: unknown; markers?: unknown; strokes?: unknown; bcAt?: unknown } | null | undefined): BoardData {
  return {
    note: typeof raw?.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '',
    markers: sanitizeMarkers(raw?.markers),
    strokes: sanitizeStrokes(raw?.strokes),
    bcAt: sanitizeBcAt(raw?.bcAt),
  };
}

/** Adds a point to a line being drawn, skipping points too close to the last one (keeps the saved drawing small). */
export function appendPoint(pts: number[], x: number, y: number, minDist = 0.5): number[] {
  if (pts.length >= MAX_STROKE_POINTS * 2) return pts;
  const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
  if (pts.length >= 2 && Math.hypot(x - lx, y - ly) < minDist) return pts;
  return [...pts, round(x, 10), round(y, 10)];
}

/** Does the eraser at (x, y) touch this line? `rx`/`ry` is the eraser radius in map percentages on each axis. */
export function strokeHit(stroke: Stroke, x: number, y: number, rx: number, ry: number): boolean {
  const p = stroke.pts;
  const norm = (px: number, py: number) => [(px - x) / rx, (py - y) / ry] as const;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const [ax, ay] = norm(p[i], p[i + 1]);
    if (i + 3 < p.length) {
      const [bx, by] = norm(p[i + 2], p[i + 3]);
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : clamp(-(ax * dx + ay * dy) / len2, 0, 1);
      if (Math.hypot(ax + t * dx, ay + t * dy) <= 1) return true;
    } else if (Math.hypot(ax, ay) <= 1) return true;
  }
  return false;
}
