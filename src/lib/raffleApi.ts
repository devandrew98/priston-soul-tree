// Talks to the database for the raffle. Tables are closed: everything goes through the functions of supabase/49_raffle.sql
// (the administrator also creates the raffle straight in the table, which only the administrator may do).
import { supabase } from './market/supabase';
import {
  toHistory, toRaffle, toTaken,
  type HistoryItem, type Raffle, type TakenNumber,
} from './raffle';

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

export interface RaffleState { raffle: Raffle | null; taken: TakenNumber[] }

export async function fetchRaffle(): Promise<RaffleState> {
  const { data, error } = await sb().rpc('raffle_state');
  if (error) throw error;
  const j = data as { raffle: Record<string, unknown> | null; numbers?: Record<string, unknown>[] };
  return { raffle: j.raffle ? toRaffle(j.raffle) : null, taken: (j.numbers ?? []).map(toTaken) };
}

export async function fetchRaffleHistory(): Promise<HistoryItem[]> {
  const { data, error } = await sb().rpc('raffle_history');
  if (error) throw error;
  return (data as Record<string, unknown>[]).map(toHistory);
}

export async function reserveNumbers(numbers: number[], nick: string): Promise<void> {
  const { error } = await sb().rpc('raffle_reserve', { p_numbers: numbers, p_nick: nick });
  if (error) throw error;
}

export async function releaseMine(n: number): Promise<void> {
  const { error } = await sb().rpc('raffle_release_mine', { p_number: n });
  if (error) throw error;
}

// ---------- administrator ----------
export interface AdminNumber {
  n: number; status: 'reserved' | 'paid'; nick: string; siteNick: string | null;
  reservedAt: string; expiresAt: string | null; paidAt: string | null;
}

export async function fetchAdminNumbers(): Promise<AdminNumber[]> {
  const { data, error } = await sb().rpc('raffle_admin_numbers');
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((j) => ({
    n: Number(j.n), status: j.status === 'paid' ? 'paid' : 'reserved', nick: String(j.nick ?? ''), siteNick: typeof j.site_nick === 'string' ? j.site_nick : null,
    reservedAt: String(j.reserved_at ?? ''), expiresAt: typeof j.expires_at === 'string' ? j.expires_at : null, paidAt: typeof j.paid_at === 'string' ? j.paid_at : null,
  }));
}

export async function markPaid(n: number): Promise<void> {
  const { error } = await sb().rpc('raffle_mark_paid', { p_number: n });
  if (error) throw error;
}

export async function releaseNumber(n: number): Promise<void> {
  const { error } = await sb().rpc('raffle_release', { p_number: n });
  if (error) throw error;
}

/** The draw: the database picks the winner at random among the paid numbers. */
export async function drawRaffle(): Promise<{ number: number; nick: string; paid: number }> {
  const { data, error } = await sb().rpc('raffle_draw');
  if (error) throw error;
  const j = data as { number: number; nick: string; paid: number };
  return { number: j.number, nick: j.nick, paid: j.paid };
}

export async function cancelRaffle(): Promise<void> {
  const { error } = await sb().rpc('raffle_cancel');
  if (error) throw error;
}

export interface NewRaffle {
  itemName: string; itemNote: string; imageUrl: string; priceCoins: number | null; priceGoldKk: number | null;
  totalNumbers: number; maxPerPerson: number; holdHours: number; payTo: string; payText: string; rules: string; endsAt: string | null;
}

export async function createRaffle(r: NewRaffle): Promise<void> {
  const { error } = await sb().from('raffles').insert({
    item_name: r.itemName.trim(), item_note: r.itemNote.trim(), image_url: r.imageUrl.trim(),
    price_coins: r.priceCoins, price_gold_kk: r.priceGoldKk, total_numbers: r.totalNumbers, max_per_person: r.maxPerPerson,
    hold_hours: r.holdHours, pay_to: r.payTo.trim(), rules: r.rules.trim(), ends_at: r.endsAt,
    // sent only when written, so creating a raffle keeps working before supabase/50 was run
    ...(r.payText.trim() ? { pay_text: r.payText.trim() } : {}),
  });
  if (error) throw error;
}
