// Leveling checklist: a plan from the planner turned into a link (pristonzone.com/checklist#p=...) to a separate page where the quests
// are ticked off as they are done. The plan travels inside the link (no database, no login), so it can be shared with a group;
// each person's ticks stay in their own browser.
// To keep the link short, each quest is written as a 5-character code made from its id (the page matches it back to the quest).

export interface ChecklistPlan {
  v: 2;
  /** plan name */
  n: string;
  /** goal */
  lv: number;
  pct: number;
  /** quest codes (a quest id is accepted too) */
  q: string[];
  /** where the character is expected to be before delivering (after leveling), optional */
  pl?: number;
  pp?: number;
}

export const MAX_QUESTS = 120;

const b64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string): string => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

// ---------- short quest codes ----------
/** FNV-1a of the id, written in base 36 with 5 characters. */
export function questCode(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 0) % 60466176).toString(36).padStart(5, '0'); // 36^5
}
/** The code of a quest, or its whole id in the very rare case that another quest has the same code. */
export function tokenFor(id: string, allIds: string[]): string {
  const code = questCode(id);
  return allIds.some((o) => o !== id && questCode(o) === code) ? id : code;
}
/** The quest a code (or an id) in a link points to. */
export function resolveToken<T extends { id: string }>(token: string, quests: T[]): T | undefined {
  return quests.find((q) => q.id === token) ?? quests.find((q) => questCode(q.id) === token);
}

export const encodePlan = (p: ChecklistPlan): string => b64(JSON.stringify(p));

/** Reads a link's code; anything that is not a valid plan gives null (the code comes from outside, so every field is checked). Old links (v1, with ids) still open. */
export function decodePlan(code: string): ChecklistPlan | null {
  try {
    const o = JSON.parse(unb64(code.trim())) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || !Array.isArray(o.q)) return null;
    const q = o.q.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80).slice(0, MAX_QUESTS);
    const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : null);
    const out: ChecklistPlan = { v: 2, n: typeof o.n === 'string' ? o.n.slice(0, 80) : '', lv: Math.round(num(o.lv, 999) ?? 0), pct: num(o.pct, 99.9999) ?? 0, q };
    const pl = num(o.pl, 999), pp = num(o.pp, 99.9999);
    if (pl !== null && pl > 0) { out.pl = Math.round(pl); out.pp = pp ?? 0; }
    return out;
  } catch {
    return null;
  }
}

export const checklistUrl = (p: ChecklistPlan, origin: string): string => `${origin}/checklist#p=${encodePlan(p)}`;

/** The code in an address (#p=...), or null. */
export function codeFromHash(hash: string): string | null {
  const m = /(?:^#|&)p=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}

// ---------- the ticks of this browser ----------
const hash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const key = (code: string) => `pz-checklist-v1-${hash(code)}`;

export function loadTicks(code: string): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(key(code)) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v === true)) as Record<string, boolean>;
  } catch { return {}; }
}
export function saveTicks(code: string, ticks: Record<string, boolean>): void {
  try { localStorage.setItem(key(code), JSON.stringify(ticks)); } catch { /* private mode: the ticks last until the page closes */ }
}
