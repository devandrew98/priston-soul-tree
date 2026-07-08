// Pure helpers for the Marketplace: search / filter / sort, market stats from a
// price series, reputation tiers, recommendations, reviews and formatting.
import { LISTINGS, REVIEW_TAGS, SELLERS, SELLER_BY_ID } from './data';
import { priceHistory } from './data';
import type { Currency, Listing, MarketStats, PricePoint, Review, Seller, Trend } from './types';

export type SortKey = 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'views' | 'rating' | 'sold';

/** Map a backend anti-spam/limit error (raised by DB triggers, Fase 9) to an
 *  i18n key. Returns null for unrelated errors so the caller shows the raw text. */
export function limitErrorKey(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.includes('limit_active_listings')) return 'mk.limit.active';
  if (msg.includes('limit_rate_listings')) return 'mk.limit.rate';
  if (msg.includes('limit_rate_messages')) return 'mk.limit.messages';
  if (msg.includes('limit_rate_reports')) return 'mk.limit.reports';
  return null;
}

export interface Filters {
  q: string;
  category: string; // '' = all
  rarity: string; // '' = all
  minLevel: number;
  minPrice: number | null;
  maxPrice: number | null;
  seller: string; // seller id, '' = all
  onlineOnly: boolean;
  verifiedOnly: boolean;
  highlightedOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  q: '', category: '', rarity: '', minLevel: 0,
  minPrice: null, maxPrice: null, seller: '', onlineOnly: false, verifiedOnly: false, highlightedOnly: false,
};

export function filterListings(listings: Listing[], f: Filters): Listing[] {
  const q = f.q.trim().toLowerCase();
  return listings.filter((l) => {
    const seller = SELLER_BY_ID[l.sellerId];
    if (q) {
      const hay = `${l.name} ${l.subcategory} ${seller?.nick ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.category && l.category !== f.category) return false;
    if (f.rarity && l.rarity !== f.rarity) return false;
    if (f.minLevel && l.itemLevel < f.minLevel) return false;
    if (f.minPrice != null && l.price < f.minPrice) return false;
    if (f.maxPrice != null && l.price > f.maxPrice) return false;
    if (f.seller && l.sellerId !== f.seller) return false;
    if (f.onlineOnly && !seller?.online) return false;
    if (f.verifiedOnly && !seller?.verified) return false;
    if (f.highlightedOnly && !l.highlighted) return false;
    return true;
  });
}

export function sortListings(listings: Listing[], key: SortKey): Listing[] {
  const arr = [...listings];
  switch (key) {
    case 'price_asc': return arr.sort((a, b) => a.price - b.price);
    case 'price_desc': return arr.sort((a, b) => b.price - a.price);
    case 'newest': return arr.sort((a, b) => b.createdAt - a.createdAt);
    case 'oldest': return arr.sort((a, b) => a.createdAt - b.createdAt);
    case 'views': return arr.sort((a, b) => b.views - a.views);
    case 'rating': return arr.sort((a, b) => (SELLER_BY_ID[b.sellerId]?.ratingAvg ?? 0) - (SELLER_BY_ID[a.sellerId]?.ratingAvg ?? 0));
    case 'sold': return arr.sort((a, b) => (SELLER_BY_ID[b.sellerId]?.itemsSold ?? 0) - (SELLER_BY_ID[a.sellerId]?.itemsSold ?? 0));
    default: return arr;
  }
}

// ---- market intelligence -----------------------------------------------------

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function marketStats(listing: Listing, series: PricePoint[]): MarketStats {
  const prices = series.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const trendPct = first ? ((last - first) / first) * 100 : 0;
  const trend: Trend = trendPct > 3 ? 'up' : trendPct < -3 ? 'down' : 'stable';
  // Sibling listings of the same name give "listed"/"sold" counts + last sale.
  const siblings = LISTINGS.filter((l) => l.category === listing.category);
  const sold = siblings.filter((l) => l.status === 'sold').length + 3;
  return {
    min, max, avg, median: median(prices), listed: siblings.length, sold,
    lastSale: Math.round(last * 0.98), lastSaleAt: series[series.length - 2]?.t ?? Date.now(),
    trend, trendPct,
  };
}

// ---- recommendations ---------------------------------------------------------

export function similarItems(listing: Listing, limit = 4): Listing[] {
  return LISTINGS.filter((l) => l.id !== listing.id && l.category === listing.category)
    .sort((a, b) => Math.abs(a.price - listing.price) - Math.abs(b.price - listing.price))
    .slice(0, limit);
}

export function sellerItems(sellerId: string, excludeId?: string): Listing[] {
  return LISTINGS.filter((l) => l.sellerId === sellerId && l.id !== excludeId);
}

export function cheaperAlternatives(listing: Listing, limit = 3): Listing[] {
  return LISTINGS.filter((l) => l.category === listing.category && l.price < listing.price && l.id !== listing.id)
    .sort((a, b) => b.price - a.price)
    .slice(0, limit);
}

// ---- market-wide statistics --------------------------------------------------

export interface DayVolume {
  t: number; // epoch ms (day)
  value: number; // gold moved that day
}

export interface MarketOverview {
  totalListings: number;
  totalSold: number;
  totalVolume: number;
  avgSellHours: number;
  topViewed: Listing[];
  trending: { listing: Listing; pct: number }[];
  topFavorited: Listing[];
  topSellers: Seller[];
  volumeByDay: DayVolume[];
  volumeToday: number;
  volumeMonth: number;
}

const DAY = 86400000;

export function marketOverview(): MarketOverview {
  const totalListings = LISTINGS.length;
  const totalSold = SELLERS.reduce((a, s) => a + s.itemsSold, 0);
  const totalVolume = SELLERS.reduce((a, s) => a + s.totalSalesValue, 0);

  const topViewed = [...LISTINGS].sort((a, b) => b.views - a.views).slice(0, 5);
  const trending = LISTINGS
    .map((l) => ({ listing: l, pct: marketStats(l, priceHistory(l)).trendPct }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
  // "Favorited" proxy: rarer + more viewed items tend to be watched more.
  const rarityWeight: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
  const topFavorited = [...LISTINGS]
    .sort((a, b) => rarityWeight[b.rarity] * b.views - rarityWeight[a.rarity] * a.views)
    .slice(0, 5);
  const topSellers = [...SELLERS].sort((a, b) => b.itemsSold - a.itemsSold).slice(0, 5);

  // Deterministic 14-day volume series around the daily average.
  const dailyAvg = totalVolume / 365;
  const volumeByDay: DayVolume[] = [];
  const now = Date.now();
  for (let d = 13; d >= 0; d--) {
    const wobble = 0.6 + ((Math.sin(d * 1.7) + 1) / 2) * 0.9;
    volumeByDay.push({ t: now - d * DAY, value: Math.round(dailyAvg * wobble) });
  }
  const volumeToday = volumeByDay[volumeByDay.length - 1].value;
  const volumeMonth = Math.round(dailyAvg * 30);

  return {
    totalListings, totalSold, totalVolume, avgSellHours: 26,
    topViewed, trending, topFavorited, topSellers, volumeByDay, volumeToday, volumeMonth,
  };
}

// ---- reputation --------------------------------------------------------------
// Tiers are now editable + DB-backed; the resolver lives in ./repTiers.
export { repTier } from './repTiers';

// Deterministic mock reviews for a seller's public profile.
export function sellerReviews(seller: Seller, limit = 6): Review[] {
  const buyers = ['Kaelen', 'Mira', 'Torvald', 'Lysa', 'Bram', 'Eowyn', 'Roderic', 'Selene'];
  const avatars = ['🗡️', '🌹', '🪓', '🔮', '🛡️', '🏹', '⚔️', '🌙'];
  const comments = [
    'Negociação impecável, super recomendado!',
    'Rápido e honesto, voltaria a comprar.',
    'Item exatamente como anunciado.',
    'Respondeu na hora, ótimo vendedor.',
    'Preço justo e entrega rápida.',
    'Tudo certo, obrigado!',
  ];
  const out: Review[] = [];
  const n = Math.min(limit, Math.max(2, Math.round(seller.ratingCount / 100)));
  for (let i = 0; i < n; i++) {
    const stars = seller.positivePct > 96 ? 5 : i % 5 === 0 ? 4 : 5;
    out.push({
      id: `${seller.id}-rev-${i}`,
      fromNick: buyers[i % buyers.length],
      fromAvatar: avatars[i % avatars.length],
      stars,
      tags: REVIEW_TAGS.slice(0, 2 + (i % 3)),
      comment: comments[i % comments.length],
      at: Date.now() - (i + 1) * 3 * 86400000,
    });
  }
  return out;
}

// ---- formatting --------------------------------------------------------------

/** 22_000_000_000 → "22kkk", 1_500_000 → "1.5kk", 20_000 → "20k". Coins → raw + Coins. */
export function fmtPrice(value: number, currency: Currency = 'gold'): string {
  if (currency === 'coins') return `${value.toLocaleString('pt-BR')} Coins`;
  const units: [number, string][] = [
    [1_000_000_000, 'kkk'],
    [1_000_000, 'kk'],
    [1_000, 'k'],
  ];
  for (const [div, suf] of units) {
    if (value >= div) {
      const n = value / div;
      const s = n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
      return `${s}${suf}`;
    }
  }
  return value.toLocaleString('pt-BR');
}

export function currencyIcon(currency: Currency): string {
  return currency === 'coins' ? '💰' : '🪙';
}

/** Compact "há X" relative time in PT / "X ago" in EN handled by caller labels. */
export function sinceParts(ms: number): { value: number; unit: 'min' | 'h' | 'd' | 'mo' } {
  const s = Math.max(0, Date.now() - ms) / 1000;
  if (s < 3600) return { value: Math.max(1, Math.floor(s / 60)), unit: 'min' };
  if (s < 86400) return { value: Math.floor(s / 3600), unit: 'h' };
  if (s < 2592000) return { value: Math.floor(s / 86400), unit: 'd' };
  return { value: Math.floor(s / 2592000), unit: 'mo' };
}
