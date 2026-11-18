import { describe, expect, it } from 'vitest';
import {
  allowance, cellState, daysLeft, fmtGold, reservedCount, soldCount, toHistory, toRaffle, toTaken, toggleSelection,
  type TakenNumber,
} from './raffle';

const taken: TakenNumber[] = [
  { n: 3, status: 'paid', nick: 'Ana', mine: false, expires: null },
  { n: 5, status: 'reserved', nick: 'Beto', mine: false, expires: null },
  { n: 7, status: 'reserved', nick: 'Eu', mine: true, expires: '2026-12-01T00:00:00Z' },
  { n: 8, status: 'paid', nick: 'Eu', mine: true, expires: null },
];

describe('number grid', () => {
  it('tells free, reserved, paid and my own numbers apart', () => {
    expect(cellState(1, taken)).toBe('free');
    expect(cellState(3, taken)).toBe('paid');
    expect(cellState(5, taken)).toBe('reserved');
    expect(cellState(7, taken)).toBe('mine-reserved');
    expect(cellState(8, taken)).toBe('mine-paid');
  });
  it('counts sold (paid) and reserved separately', () => {
    expect(soldCount(taken)).toBe(2);
    expect(reservedCount(taken)).toBe(2);
  });
  it('the allowance is the limit minus what I already hold (reserved or paid)', () => {
    expect(allowance(3, taken)).toBe(1);
    expect(allowance(3, [])).toBe(3);
    expect(allowance(2, taken)).toBe(0);
    expect(allowance(1, taken)).toBe(0);
  });
});

describe('selection', () => {
  it('adds free numbers, sorted, and removes them when clicked again', () => {
    let s: number[] = [];
    s = toggleSelection(s, 10, [], 3);
    s = toggleSelection(s, 2, [], 3);
    expect(s).toEqual([2, 10]);
    expect(toggleSelection(s, 2, [], 3)).toEqual([10]);
  });
  it('stops at the allowance', () => {
    expect(toggleSelection([1, 2], 4, [], 2)).toEqual([1, 2]);
    expect(toggleSelection([], 4, [], 0)).toEqual([]);
  });
  it('ignores numbers that are not free', () => {
    expect(toggleSelection([], 3, taken, 3)).toEqual([]);
    expect(toggleSelection([], 5, taken, 3)).toEqual([]);
    expect(toggleSelection([], 7, taken, 3)).toEqual([]);
  });
});

describe('formatting and dates', () => {
  it('writes gold in kk', () => {
    expect(fmtGold(350)).toBe('350kk');
    expect(fmtGold(1500)).toBe('1,500kk');
  });
  it('counts whole days left, rounded up, and is null without a date', () => {
    const now = Date.UTC(2026, 10, 18, 12, 0, 0);
    expect(daysLeft(null, now)).toBeNull();
    expect(daysLeft('2026-11-27T12:00:00Z', now)).toBe(9);
    expect(daysLeft('2026-11-27T20:00:00Z', now)).toBe(10);
    expect(daysLeft('2026-11-18T08:00:00Z', now)).toBe(0);
    expect(daysLeft('2026-11-01T00:00:00Z', now)).toBe(0);
  });
});

describe('reading the database answers', () => {
  it('turns a raffle row into a raffle, with safe defaults', () => {
    const r = toRaffle({ id: 'a', item_name: 'Lufia Soul', item_note: 'Bound', image_url: '/fusion/LufiaSoul.png', price_coins: 1000, price_gold_kk: null, total_numbers: 30, max_per_person: 3, hold_hours: 48, pay_to: 'Banco', rules: '', ends_at: null, status: 'open', created_at: 'x' });
    expect(r).toMatchObject({ itemName: 'Lufia Soul', priceCoins: 1000, priceGoldKk: null, totalNumbers: 30, maxPerPerson: 3, status: 'open', winnerNumber: null });
    expect(toRaffle({ status: 'weird' }).status).toBe('open');
  });
  it('turns number rows and history rows', () => {
    expect(toTaken({ n: 4, status: 'paid', nick: 'Ana', mine: true })).toEqual({ n: 4, status: 'paid', nick: 'Ana', mine: true, expires: null });
    expect(toTaken({ n: 4, status: 'x', nick: 'Ana' }).status).toBe('reserved');
    expect(toHistory({ id: 'h', item_name: 'X', status: 'drawn', total_numbers: 30, sold: 12, winner_number: 7, winner_nick: 'Ana', drawn_at: 'd', created_at: 'c' })).toMatchObject({ status: 'drawn', sold: 12, winnerNumber: 7, winnerNick: 'Ana' });
    expect(toHistory({ status: 'cancelled' }).status).toBe('cancelled');
  });
});
