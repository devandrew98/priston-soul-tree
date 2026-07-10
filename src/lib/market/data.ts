// Mock catalogue for the Marketplace MVP: categories, sellers, listings, medals,
// reputation tiers and a deterministic price-history generator (stable per item).
import type { Listing, PricePoint, Rarity, RepLevel, Seller } from './types';

export interface Category {
  id: string;
  icon: string;
  subs: string[];
}

// Category ids are stable keys; labels are localised in i18n (mk.cat.*).
export const CATEGORIES: Category[] = [
  { id: 'weapons', icon: '⚔️', subs: ['Espadas', 'Machados', 'Arcos', 'Garras', 'Adagas', 'Martelos', 'Lanças', 'Fantasmas', 'Foices', 'Varinhas', 'Cajados'] },
  { id: 'armors', icon: '🛡️', subs: ['Armaduras', 'Roupões', 'Orbes', 'Escudos', 'Botas', 'Luvas', 'Braceletes'] },
  { id: 'jewels', icon: '💍', subs: ['Anéis', 'Amuletos'] },
  { id: 'sheltoms', icon: '💠', subs: [] },
  { id: 'souls', icon: '✨', subs: [] },
  { id: 'pets', icon: '🐾', subs: [] },
  { id: 'premium', icon: '👑', subs: [] },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const CLASSES = ['Fighter', 'Mechanician', 'Archer', 'Pikeman', 'Atalanta', 'Knight', 'Magician', 'Priestess', 'Assassina', 'Shaman'];

export const CURRENCIES = ['gold', 'coins'] as const;

export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9c9079',
  rare: '#4a90d9',
  epic: '#b452d9',
  legendary: '#e6b93b',
};

export interface RepTier {
  id: RepLevel;
  label: string; // shown name (PristonTale-themed)
  icon: string;
  color: string;
  min: number; // min itemsSold to reach this tier
}

export const REP_TIERS: RepTier[] = [
  { id: 'bronze', label: 'Hopy', icon: '🥉', color: '#cd7f32', min: 0 },
  { id: 'silver', label: 'Bargon', icon: '🥈', color: '#c0c0c0', min: 25 },
  { id: 'gold', label: 'Head Cutter', icon: '🥇', color: '#e6b93b', min: 100 },
  { id: 'diamond', label: 'Groqueste', icon: '💎', color: '#5ad6d0', min: 300 },
  { id: 'legendary', label: 'Babel', icon: '👑', color: '#e0663b', min: 800 },
];

export interface Medal {
  id: string;
  icon: string;
}

// Medal labels/descriptions are localised (mk.medal.<id> / .d).
export const MEDALS: Medal[] = [
  { id: 'fast', icon: '⚡' },
  { id: 'trusted', icon: '🤝' },
  { id: 'veteran', icon: '🏰' },
  { id: 'topseller', icon: '💰' },
  { id: 'clean', icon: '🛡️' },
  { id: 'collector', icon: '📦' },
];

export const REVIEW_TAGS = ['communication', 'fast', 'kept_deal', 'recommended', 'would_again'];

const DAY = 86400000;
const now = Date.now();

export const SELLERS: Seller[] = [
  {
    id: 'hadder', nick: 'HaDDeR', avatar: '🐺', className: 'Knight', level: 168, clan: 'Dourados',
    joinedAt: now - 720 * DAY, lastSeen: now - 2 * 60000, online: true, verified: true,
    totalSalesValue: 8_420_000_000, itemsSold: 934, itemsBought: 210, ratingAvg: 4.9, ratingCount: 612,
    positivePct: 99, avgResponseMin: 3, avgCompleteMin: 11, reports: 0, medals: ['fast', 'trusted', 'veteran', 'topseller', 'clean'],
  },
  {
    id: 'commita', nick: 'CommitaoDourado', avatar: '🦁', className: 'Magician', level: 152, clan: 'Dourados',
    joinedAt: now - 610 * DAY, lastSeen: now - 40 * 60000, online: false, verified: true,
    totalSalesValue: 5_100_000_000, itemsSold: 501, itemsBought: 320, ratingAvg: 4.8, ratingCount: 388,
    positivePct: 98, avgResponseMin: 6, avgCompleteMin: 15, reports: 0, medals: ['trusted', 'topseller', 'veteran'],
  },
  {
    id: 'sylvara', nick: 'Sylvara', avatar: '🏹', className: 'Archer', level: 141, clan: 'MoonElves',
    joinedAt: now - 430 * DAY, lastSeen: now - 5 * 60000, online: true, verified: true,
    totalSalesValue: 2_780_000_000, itemsSold: 287, itemsBought: 96, ratingAvg: 4.7, ratingCount: 201,
    positivePct: 97, avgResponseMin: 8, avgCompleteMin: 19, reports: 0, medals: ['fast', 'collector'],
  },
  {
    id: 'gorrim', nick: 'Gorrim', avatar: '⚒️', className: 'Fighter', level: 133, clan: 'IronFist',
    joinedAt: now - 300 * DAY, lastSeen: now - 3 * 3600000, online: false, verified: false,
    totalSalesValue: 940_000_000, itemsSold: 118, itemsBought: 140, ratingAvg: 4.4, ratingCount: 88,
    positivePct: 92, avgResponseMin: 22, avgCompleteMin: 40, reports: 1, medals: ['collector'],
  },
  {
    id: 'nyx', nick: 'NyxShadow', avatar: '🌑', className: 'Atalanta', level: 149, clan: 'Nightfall',
    joinedAt: now - 210 * DAY, lastSeen: now - 15 * 60000, online: true, verified: false,
    totalSalesValue: 1_320_000_000, itemsSold: 156, itemsBought: 60, ratingAvg: 4.6, ratingCount: 121,
    positivePct: 95, avgResponseMin: 12, avgCompleteMin: 25, reports: 0, medals: ['fast'],
  },
  {
    id: 'draven', nick: 'DravenTrade', avatar: '🃏', className: 'Pikeman', level: 118, clan: '—',
    joinedAt: now - 95 * DAY, lastSeen: now - 6 * 3600000, online: false, verified: false,
    totalSalesValue: 180_000_000, itemsSold: 22, itemsBought: 44, ratingAvg: 3.6, ratingCount: 31,
    positivePct: 74, avgResponseMin: 55, avgCompleteMin: 90, reports: 4, medals: [],
  },
];

// ---- listings ----------------------------------------------------------------

interface Seed {
  name: string; cat: string; sub: string; rarity: Rarity; tier: number; lvl: number;
  price: number; currency: Listing['currency']; classReq: string; sockets: number; stats: [string, string][];
  desc: string;
}

const SEEDS: Seed[] = [
  { name: 'Murky Sword', cat: 'weapons', sub: 'Espadas', rarity: 'legendary', tier: 5, lvl: 120, price: 22_000_000_000, currency: 'gold', classReq: 'Knight', sockets: 3, stats: [['Dano', '742-810'], ['Força req.', '520'], ['Vel. Ataque', '+12%'], ['Crítico', '+8%']], desc: 'Lâmina lendária forjada nas profundezas de Pillai. Corte devastador.' },
  { name: 'Dragon Slayer', cat: 'weapons', sub: 'Machados', rarity: 'epic', tier: 4, lvl: 108, price: 6_500_000_000, currency: 'gold', classReq: 'Fighter', sockets: 2, stats: [['Dano', '540-611'], ['Força req.', '440'], ['Dano a Bosses', '+18%']], desc: 'Machado pesado especializado em caçada de chefes.' },
  { name: 'Elven Longbow', cat: 'weapons', sub: 'Arcos', rarity: 'epic', tier: 4, lvl: 104, price: 4_100_000_000, currency: 'gold', classReq: 'Archer', sockets: 2, stats: [['Dano', '410-470'], ['Destreza req.', '480'], ['Alcance', '+2'], ['Crítico', '+10%']], desc: 'Precisão élfica com alcance estendido.' },
  { name: 'Storm Halberd', cat: 'weapons', sub: 'Lanças', rarity: 'rare', tier: 3, lvl: 92, price: 850_000_000, currency: 'gold', classReq: 'Pikeman', sockets: 1, stats: [['Dano', '300-360'], ['Força req.', '360'], ['Dano Elétrico', '+40']], desc: 'Lança carregada com energia elétrica.' },
  { name: 'Arcane Staff', cat: 'weapons', sub: 'Cajados', rarity: 'legendary', tier: 5, lvl: 118, price: 18_000_000_000, currency: 'gold', classReq: 'Magician', sockets: 3, stats: [['Dano Mágico', '620-700'], ['Espírito req.', '540'], ['Mana', '+320'], ['Redução CD', '+12%']], desc: 'Cajado supremo dos arquimagos.' },

  { name: 'Titan Plate', cat: 'armors', sub: 'Armaduras', rarity: 'epic', tier: 4, lvl: 110, price: 3_200_000_000, currency: 'gold', classReq: 'Knight', sockets: 2, stats: [['Defesa', '+680'], ['HP', '+1200'], ['Resist. Física', '+15%']], desc: 'Armadura de placa titânica, muralha ambulante.' },
  { name: 'Shadow Robe', cat: 'armors', sub: 'Roupões', rarity: 'rare', tier: 3, lvl: 95, price: 720_000_000, currency: 'gold', classReq: 'Magician', sockets: 1, stats: [['Defesa', '+310'], ['Mana', '+450'], ['Resist. Mágica', '+12%']], desc: 'Manto leve tecido com fios de sombra.' },
  { name: 'Ranger Vest', cat: 'armors', sub: 'Armaduras', rarity: 'rare', tier: 3, lvl: 90, price: 540_000_000, currency: 'gold', classReq: 'Archer', sockets: 1, stats: [['Defesa', '+280'], ['Destreza', '+40'], ['Vel. Mov.', '+6%']], desc: 'Colete ágil para batedores.' },

  { name: 'Aegis of Dawn', cat: 'armors', sub: 'Escudos', rarity: 'legendary', tier: 5, lvl: 115, price: 12_000_000_000, currency: 'gold', classReq: 'Knight', sockets: 2, stats: [['Defesa', '+520'], ['Bloqueio', '+35%'], ['Reflexão', '+8%']], desc: 'Escudo sagrado que reflete o mal.' },
  { name: 'Oak Buckler', cat: 'armors', sub: 'Escudos', rarity: 'common', tier: 2, lvl: 60, price: 45_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Defesa', '+90'], ['Bloqueio', '+12%']], desc: 'Escudo simples de carvalho.' },

  { name: 'Gauntlets of Might', cat: 'armors', sub: 'Luvas', rarity: 'epic', tier: 4, lvl: 105, price: 2_400_000_000, currency: 'gold', classReq: 'Fighter', sockets: 2, stats: [['Defesa', '+210'], ['Força', '+35'], ['Dano', '+6%']], desc: 'Manoplas que amplificam a força bruta.' },
  { name: 'Silk Gloves', cat: 'armors', sub: 'Luvas', rarity: 'rare', tier: 3, lvl: 88, price: 320_000_000, currency: 'gold', classReq: 'Priestess', sockets: 1, stats: [['Defesa', '+120'], ['Espírito', '+28'], ['Cura', '+8%']], desc: 'Luvas delicadas das sacerdotisas.' },

  { name: 'Boots of Haste', cat: 'armors', sub: 'Botas', rarity: 'epic', tier: 4, lvl: 100, price: 1_900_000_000, currency: 'gold', classReq: 'Todas', sockets: 1, stats: [['Defesa', '+160'], ['Vel. Mov.', '+15%'], ['Esquiva', '+6%']], desc: 'Botas encantadas com pressa arcana.' },
  { name: 'Iron Greaves', cat: 'armors', sub: 'Botas', rarity: 'common', tier: 2, lvl: 55, price: 28_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Defesa', '+70']], desc: 'Grevas de ferro resistentes.' },

  { name: 'Bracelet of Kings', cat: 'armors', sub: 'Braceletes', rarity: 'legendary', tier: 5, lvl: 112, price: 9_800_000_000, currency: 'gold', classReq: 'Todas', sockets: 1, stats: [['Todos Atributos', '+25'], ['HP/MP', '+600'], ['EXP', '+5%']], desc: 'Relíquia da realeza de Ricarten.' },
  { name: 'Copper Band', cat: 'armors', sub: 'Braceletes', rarity: 'rare', tier: 3, lvl: 80, price: 210_000_000, currency: 'gold', classReq: 'Todas', sockets: 1, stats: [['Força', '+18'], ['Talento', '+12']], desc: 'Bracelete de cobre bem trabalhado.' },

  { name: "Ring of Fury", cat: 'jewels', sub: 'Anéis', rarity: 'epic', tier: 4, lvl: 102, price: 3_600_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Dano', '+9%'], ['Crítico', '+7%'], ['Fúria', '+15%']], desc: 'Anel que arde com fúria de batalha.' },
  { name: 'Ring of Warding', cat: 'jewels', sub: 'Anéis', rarity: 'rare', tier: 3, lvl: 85, price: 480_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Resist. Todas', '+10%'], ['HP', '+300']], desc: 'Proteção elemental balanceada.' },

  { name: 'Amulet of the Sage', cat: 'jewels', sub: 'Amuletos', rarity: 'legendary', tier: 5, lvl: 116, price: 14_500_000_000, currency: 'gold', classReq: 'Magician', sockets: 1, stats: [['Dano Mágico', '+18%'], ['Mana', '+500'], ['Redução CD', '+15%']], desc: 'Amuleto dos antigos sábios de Neuren.' },
  { name: 'Bone Amulet', cat: 'jewels', sub: 'Amuletos', rarity: 'common', tier: 2, lvl: 50, price: 18_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Espírito', '+10']], desc: 'Amuleto rústico de osso.' },

  { name: 'Sheltom Vermelho +9', cat: 'sheltoms', sub: 'Sheltom Vermelho', rarity: 'epic', tier: 4, lvl: 1, price: 2_100_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Bônus de Refino', '+9'], ['Dano', '+14%']], desc: 'Pedra de refino de alto nível.' },
  { name: 'Sheltom Azul +7', cat: 'sheltoms', sub: 'Sheltom Azul', rarity: 'rare', tier: 3, lvl: 1, price: 620_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Bônus de Refino', '+7'], ['Defesa', '+12%']], desc: 'Refino defensivo confiável.' },

  { name: 'Soul de Ignis Lv3', cat: 'souls', sub: 'Soul de Ataque', rarity: 'legendary', tier: 5, lvl: 1, price: 7_400_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Dano de Fogo', '+120'], ['Crítico', '+6%']], desc: 'Soul rara com essência de Ignis nível 3.' },
  { name: 'Soul de Tulla Lv2', cat: 'souls', sub: 'Soul de Defesa', rarity: 'epic', tier: 4, lvl: 1, price: 1_500_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Resist. Gelo', '+80'], ['HP', '+400']], desc: 'Soul defensiva do domínio congelado.' },
  { name: 'Soul de Deius Lv1', cat: 'souls', sub: 'Soul de Suporte', rarity: 'rare', tier: 3, lvl: 1, price: 260_000_000, currency: 'gold', classReq: 'Todas', sockets: 0, stats: [['Regen. MP', '+18%']], desc: 'Suporte de sustentação de mana.' },

  { name: 'Baby Draxos', cat: 'pets', sub: 'Pet de Combate', rarity: 'epic', tier: 4, lvl: 100, price: 850, currency: 'coins', classReq: 'Todas', sockets: 0, stats: [['Dano do Pet', '+220'], ['Vel. Ataque Pet', '+15%']], desc: 'Filhote de Draxos, companheiro feroz.' },
  { name: 'Coletor Guloso', cat: 'pets', sub: 'Pet de Coleta', rarity: 'rare', tier: 3, lvl: 40, price: 320, currency: 'coins', classReq: 'Todas', sockets: 0, stats: [['Auto-coleta', 'Sim'], ['Alcance', '+3']], desc: 'Coleta itens automaticamente.' },

  { name: 'Asa Celestial (Cosmético)', cat: 'premium', sub: 'Cosmético', rarity: 'legendary', tier: 5, lvl: 1, price: 250, currency: 'coins', classReq: 'Todas', sockets: 0, stats: [['Cosmético', 'Asas brilhantes'], ['Vaidade', '★★★★★']], desc: 'Asas celestiais puramente cosméticas.' },
  { name: 'Pacote Premium 30d', cat: 'premium', sub: 'Item Premium', rarity: 'epic', tier: 4, lvl: 1, price: 120, currency: 'coins', classReq: 'Todas', sockets: 0, stats: [['EXP', '+30%'], ['Drop', '+20%'], ['Duração', '30 dias']], desc: 'Benefícios premium por 30 dias.' },
];

const CAT_ICON: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.icon]));

const STATUS_CYCLE: Listing['status'][] = ['available', 'available', 'available', 'reserved', 'available', 'sold'];

export const LISTINGS: Listing[] = SEEDS.map((s, i) => {
  const seller = SELLERS[i % SELLERS.length];
  return {
    id: `it-${i + 1}`,
    name: s.name,
    itemLevel: s.lvl,
    icon: CAT_ICON[s.cat] || '📦',
    category: s.cat,
    subcategory: s.sub,
    rarity: s.rarity,
    tier: s.tier,
    sockets: s.sockets,
    classReq: s.classReq,
    stats: s.stats.map(([label, value]) => ({ label, value })),
    quantity: s.cat === 'sheltoms' || s.cat === 'souls' ? 1 + (i % 5) : 1,
    price: s.price,
    currency: s.currency,
    description: s.desc,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length],
    highlighted: s.rarity === 'legendary' || i % 6 === 0,
    sellerId: seller.id,
    views: 40 + ((i * 137) % 2200),
    createdAt: now - ((i * 7) % 45) * DAY - (i % 24) * 3600000,
  };
});

export const LISTING_BY_ID: Record<string, Listing> = Object.fromEntries(LISTINGS.map((l) => [l.id, l]));
export const SELLER_BY_ID: Record<string, Seller> = Object.fromEntries(SELLERS.map((s) => [s.id, s]));

// ---- reports queue (admin) ---------------------------------------------------

export interface Report {
  id: string;
  reporter: string; // nick
  targetType: 'item' | 'user';
  targetId: string;
  reason: string; // reason id → mk.report.reason.<id>
  note: string;
  at: number;
}

export const REPORTS: Report[] = [
  { id: 'r1', reporter: 'Kaelen', targetType: 'user', targetId: 'draven', reason: 'scam', note: 'Recebeu o pagamento e não entregou o item.', at: now - 2 * 3600000 },
  { id: 'r2', reporter: 'Mira', targetType: 'item', targetId: 'it-4', reason: 'wrong_stats', note: 'Atributos anunciados não conferem com o item.', at: now - 8 * 3600000 },
  { id: 'r3', reporter: 'Torvald', targetType: 'user', targetId: 'gorrim', reason: 'abuse', note: 'Comportamento ofensivo no chat.', at: now - 26 * 3600000 },
  { id: 'r4', reporter: 'Selene', targetType: 'item', targetId: 'it-20', reason: 'overpriced', note: 'Preço muito acima do mercado, possível manipulação.', at: now - 3 * 86400000 },
];

export const REPORT_REASONS = ['scam', 'wrong_stats', 'abuse', 'overpriced', 'spam'];

// ---- deterministic price history --------------------------------------------

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A stable ~365-day daily price series around the listing's current price, with
// a gentle trend + noise. Same input → same series (good for charts + stats).
export function priceHistory(listing: Listing, days = 365): PricePoint[] {
  const rnd = mulberry32(hashStr(listing.id + listing.name));
  const base = listing.price;
  const drift = (rnd() - 0.45) * 0.4; // overall trend factor
  const out: PricePoint[] = [];
  let level = base * (1 - drift * 0.6);
  for (let d = days; d >= 0; d--) {
    const progress = (days - d) / days;
    const target = base * (1 - drift * (1 - progress));
    level += (target - level) * 0.08 + (rnd() - 0.5) * base * 0.05;
    level = Math.max(base * 0.35, level);
    out.push({ t: now - d * DAY, price: Math.round(level) });
  }
  out[out.length - 1].price = base; // anchor "today" to the listing price
  return out;
}
