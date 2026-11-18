// Demo of the raffle for looking at the page without touching the database (open /rifa?demo in the local server only).
// Everything lives in memory and is lost on reload. It follows the same rules the database enforces (limit per person, taken numbers).
import type { HistoryItem, Raffle, TakenNumber } from './raffle';
import type { RaffleState } from './raffleApi';

const HOLD_HOURS = 48;

const raffle: Raffle = {
  id: 'demo', itemName: 'Lufia Soul', itemNote: '', imageUrl: '/fusion/MightyLufiaSoul.png',
  priceCoins: 1000, priceGoldKk: 350, totalNumbers: 30, maxPerPerson: 3, holdHours: HOLD_HOURS, payTo: 'ZoneBanco',
  payText: 'Combine o pagamento comigo pelo **Discord** (ou dentro do jogo), informando o seu nick e os números reservados. Assim que eu confirmar, o número passa a ficar “vendido”.',
  rules: 'Os números pagos entram no sorteio. **Boa sorte a todos!**', endsAt: null, status: 'open',
  winnerNumber: null, winnerNick: null, drawnAt: null, createdAt: new Date().toISOString(),
};

let taken: TakenNumber[] = [
  { n: 3, status: 'paid', nick: 'Ana', mine: false, expires: null },
  { n: 7, status: 'paid', nick: 'Beto', mine: false, expires: null },
  { n: 14, status: 'paid', nick: 'Carlos', mine: false, expires: null },
  { n: 22, status: 'paid', nick: 'Duda', mine: false, expires: null },
  { n: 5, status: 'reserved', nick: 'Eli', mine: false, expires: null },
  { n: 12, status: 'reserved', nick: 'Fabi', mine: false, expires: null },
];

const history: HistoryItem[] = [
  { id: 'h1', itemName: 'Dawlin Soul', itemNote: '', imageUrl: '/fusion/DawlinSoul.png', status: 'drawn', totalNumbers: 30, sold: 28, winnerNumber: 14, winnerNick: 'Zed', drawnAt: '2026-11-10T20:00:00Z', createdAt: '2026-11-01T00:00:00Z' },
  { id: 'h2', itemName: 'Xetan Soul', itemNote: '', imageUrl: '/fusion/XetanSoul.png', status: 'drawn', totalNumbers: 20, sold: 20, winnerNumber: 3, winnerNick: 'Lia', drawnAt: '2026-10-20T20:00:00Z', createdAt: '2026-10-10T00:00:00Z' },
  { id: 'h3', itemName: 'Kelvezu Soul', itemNote: '', imageUrl: '', status: 'cancelled', totalNumbers: 30, sold: 3, winnerNumber: null, winnerNick: null, drawnAt: null, createdAt: '2026-10-01T00:00:00Z' },
];

const wait = <T,>(v: T): Promise<T> => new Promise((r) => window.setTimeout(() => r(v), 150));

export const demoApi = {
  fetchRaffle: (): Promise<RaffleState> => wait({ raffle, taken: taken.map((t) => ({ ...t })) }),
  fetchRaffleHistory: (): Promise<HistoryItem[]> => wait(history),

  async reserveNumbers(numbers: number[], nick: string): Promise<void> {
    if (nick.trim().length < 2 || nick.trim().length > 30) throw new Error('informe o nick do seu personagem (2 a 30 letras)');
    if (numbers.length === 0) throw new Error('escolha pelo menos um número');
    const mine = taken.filter((t) => t.mine).length;
    if (mine + numbers.length > raffle.maxPerPerson) throw new Error(`limite de ${raffle.maxPerPerson} números por pessoa nesta rifa`);
    if (numbers.some((n) => taken.some((t) => t.n === n))) throw new Error('algum número acabou de ser reservado por outra pessoa; escolha outro');
    const expires = new Date(Date.now() + HOLD_HOURS * 3600000).toISOString();
    taken = [...taken, ...numbers.map((n): TakenNumber => ({ n, status: 'reserved', nick: nick.trim(), mine: true, expires }))];
    await wait(undefined);
  },

  async releaseMine(n: number): Promise<void> {
    taken = taken.filter((t) => !(t.n === n && t.mine && t.status === 'reserved'));
    await wait(undefined);
  },

  /** Demo only: what happens when the administrator confirms the payment of my reserved numbers. */
  async simulatePaid(): Promise<void> {
    taken = taken.map((t) => (t.mine && t.status === 'reserved' ? { ...t, status: 'paid', expires: null } : t));
    await wait(undefined);
  },

  /** Demo only: starts over. */
  async reset(): Promise<void> {
    taken = taken.filter((t) => !t.mine);
    await wait(undefined);
  },
};
