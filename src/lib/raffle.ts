// The raffle (/rifa): types and the pure rules of the number grid. The database decides everything that matters
// (limits, who gets a number, the draw); these helpers only decide what the page shows.

export type RaffleStatus = 'open' | 'drawn' | 'cancelled';

export interface Raffle {
  id: string;
  itemName: string;
  itemNote: string;
  imageUrl: string;
  priceCoins: number | null;
  /** Gold price in "kk" (millions): 350 = 350kk. */
  priceGoldKk: number | null;
  totalNumbers: number;
  maxPerPerson: number;
  holdHours: number;
  /** In-game character that receives the payment. */
  payTo: string;
  /** How to pay, written by the administrator per raffle (in the game, on Discord...). Empty = the page shows a default sentence. */
  payText: string;
  rules: string;
  endsAt: string | null;
  status: RaffleStatus;
  winnerNumber: number | null;
  winnerNick: string | null;
  drawnAt: string | null;
  createdAt: string;
}

export interface TakenNumber {
  n: number;
  status: 'reserved' | 'paid';
  nick: string;
  mine: boolean;
  /** Only for the viewer's own reservations: when it expires. */
  expires: string | null;
}

export type CellState = 'free' | 'reserved' | 'paid' | 'mine-reserved' | 'mine-paid';

export interface HistoryItem {
  id: string;
  itemName: string;
  itemNote: string;
  imageUrl: string;
  status: Exclude<RaffleStatus, 'open'>;
  totalNumbers: number;
  sold: number;
  winnerNumber: number | null;
  winnerNick: string | null;
  drawnAt: string | null;
  createdAt: string;
}

/** What to draw for number `n`. */
export function cellState(n: number, taken: TakenNumber[]): CellState {
  const t = taken.find((x) => x.n === n);
  if (!t) return 'free';
  if (t.mine) return t.status === 'paid' ? 'mine-paid' : 'mine-reserved';
  return t.status;
}

/** How many more numbers this person may still pick: the limit minus the numbers they already hold. */
export function allowance(max: number, taken: TakenNumber[]): number {
  return Math.max(0, max - taken.filter((t) => t.mine).length);
}

/** Toggles a number in the selection. A free number is added only while the allowance lasts; anything not free is ignored. */
export function toggleSelection(selected: number[], n: number, taken: TakenNumber[], left: number): number[] {
  if (selected.includes(n)) return selected.filter((x) => x !== n);
  if (cellState(n, taken) !== 'free' || selected.length >= left) return selected;
  return [...selected, n].sort((a, b) => a - b);
}

export const soldCount = (taken: TakenNumber[]): number => taken.filter((t) => t.status === 'paid').length;
export const reservedCount = (taken: TakenNumber[]): number => taken.filter((t) => t.status === 'reserved').length;

/** 350 -> "350kk". */
export const fmtGold = (kk: number): string => `${kk.toLocaleString('en-US')}kk`;

/** Whole days left until `endsAt` (rounded up; 0 when it is today or past); null without a date. Only informative: nothing closes by itself. */
export function daysLeft(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
}

// ---------- reading what the database returns ----------
type J = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function toRaffle(j: J): Raffle {
  return {
    id: str(j.id), itemName: str(j.item_name), itemNote: str(j.item_note), imageUrl: str(j.image_url),
    priceCoins: numOrNull(j.price_coins), priceGoldKk: numOrNull(j.price_gold_kk),
    totalNumbers: Number(j.total_numbers) || 0, maxPerPerson: Number(j.max_per_person) || 1, holdHours: Number(j.hold_hours) || 48,
    payTo: str(j.pay_to), payText: str(j.pay_text), rules: str(j.rules), endsAt: typeof j.ends_at === 'string' ? j.ends_at : null,
    status: (j.status === 'drawn' || j.status === 'cancelled' ? j.status : 'open'),
    winnerNumber: numOrNull(j.winner_number), winnerNick: typeof j.winner_nick === 'string' ? j.winner_nick : null,
    drawnAt: typeof j.drawn_at === 'string' ? j.drawn_at : null, createdAt: str(j.created_at),
  };
}

export const toTaken = (j: J): TakenNumber => ({
  n: Number(j.n), status: j.status === 'paid' ? 'paid' : 'reserved', nick: str(j.nick), mine: j.mine === true,
  expires: typeof j.expires === 'string' ? j.expires : null,
});

export const toHistory = (j: J): HistoryItem => ({
  id: str(j.id), itemName: str(j.item_name), itemNote: str(j.item_note), imageUrl: str(j.image_url),
  status: j.status === 'cancelled' ? 'cancelled' : 'drawn', totalNumbers: Number(j.total_numbers) || 0, sold: Number(j.sold) || 0,
  winnerNumber: numOrNull(j.winner_number), winnerNick: typeof j.winner_nick === 'string' ? j.winner_nick : null,
  drawnAt: typeof j.drawn_at === 'string' ? j.drawn_at : null, createdAt: str(j.created_at),
});
