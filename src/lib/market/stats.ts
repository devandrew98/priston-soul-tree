// DB-backed market statistics + item price history (Phase 8), computed from the
// real listings and the sales table.
import { supabase } from './supabase';
import { LISTING_SELECT, rowToListing, type ListingRow } from './listings';
import type { Listing, MarketStats, PricePoint, Trend } from './types';

function sb() {
  if (!supabase) throw new Error('backend_not_configured');
  return supabase;
}

const DAY = 86400000;
const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

interface SaleRow { category: string; name: string; price: number | string; sold_at: string }

export interface TopSoldItem { name: string; category: string; count: number; volume: number }
export interface TopSeller { id: string; nick: string; avatar: string; ratingAvg: number; ratingCount: number; itemsSold: number }

export interface DbOverview {
  totalListings: number;
  totalSold: number;
  totalVolume: number;
  volumeToday: number;
  volumeMonth: number;
  volumeByDay: { t: number; value: number }[];
  topViewed: Listing[];
  topSold: TopSoldItem[];
  topSellers: TopSeller[];
}

export async function fetchMarketOverview(): Promise<DbOverview> {
  const now = Date.now();
  const [countRes, salesRes, viewedRes, sellersRes] = await Promise.all([
    sb().from('listings').select('id', { count: 'exact', head: true }).eq('removed', false),
    sb().from('sales').select('category,name,price,sold_at').order('sold_at', { ascending: false }).limit(1000),
    sb().from('listings').select(LISTING_SELECT).eq('removed', false).order('views', { ascending: false }).limit(5),
    sb().from('seller_public').select('id,nick,avatar_url,rating_avg,rating_count,items_sold')
      .order('items_sold', { ascending: false }).order('rating_count', { ascending: false }).limit(5),
  ]);

  const totalListings = countRes.count ?? 0;
  const sales = (salesRes.data as SaleRow[]) ?? [];
  const totalSold = sales.length;
  const totalVolume = sales.reduce((a, s) => a + Number(s.price), 0);

  const volumeByDay: { t: number; value: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const start = new Date(now - d * DAY); start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    const value = sales
      .filter((s) => { const t = new Date(s.sold_at).getTime(); return t >= from && t < from + DAY; })
      .reduce((a, s) => a + Number(s.price), 0);
    volumeByDay.push({ t: from, value });
  }
  const volumeToday = volumeByDay[volumeByDay.length - 1].value;
  const monthStart = now - 30 * DAY;
  const volumeMonth = sales.filter((s) => new Date(s.sold_at).getTime() >= monthStart).reduce((a, s) => a + Number(s.price), 0);

  const byName = new Map<string, TopSoldItem>();
  for (const s of sales) {
    const cur = byName.get(s.name) ?? { name: s.name, category: s.category, count: 0, volume: 0 };
    cur.count += 1;
    cur.volume += Number(s.price);
    byName.set(s.name, cur);
  }
  const topSold = [...byName.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  const topViewed = ((viewedRes.data as ListingRow[]) ?? []).map(rowToListing);
  const topSellers = ((sellersRes.data as { id: string; nick: string; avatar_url: string | null; rating_avg: number; rating_count: number; items_sold: number }[]) ?? [])
    .map((s) => ({ id: s.id, nick: s.nick, avatar: s.avatar_url || '🧑', ratingAvg: Number(s.rating_avg) || 0, ratingCount: s.rating_count || 0, itemsSold: s.items_sold || 0 }));

  return { totalListings, totalSold, totalVolume, volumeToday, volumeMonth, volumeByDay, topViewed, topSold, topSellers };
}

/** Price history + market stats for an item, from real category sales
 *  (falls back to current listings when there are no sales yet). */
export async function fetchItemMarket(listing: Listing): Promise<{ series: PricePoint[]; stats: MarketStats }> {
  const [salesRes, listedRes] = await Promise.all([
    sb().from('sales').select('price,sold_at').eq('category', listing.category).order('sold_at', { ascending: true }).limit(500),
    sb().from('listings').select('price').eq('category', listing.category).eq('removed', false),
  ]);
  const sales = (salesRes.data as { price: number | string; sold_at: string }[]) ?? [];
  const listedPrices = ((listedRes.data as { price: number | string }[]) ?? []).map((l) => Number(l.price));
  const series: PricePoint[] = sales.map((s) => ({ t: new Date(s.sold_at).getTime(), price: Number(s.price) }));

  const basis = series.length ? series.map((p) => p.price) : listedPrices.length ? listedPrices : [listing.price];
  const first = series.length ? series[0].price : 0;
  const last = series.length ? series[series.length - 1].price : 0;
  const trendPct = first ? ((last - first) / first) * 100 : 0;
  const trend: Trend = trendPct > 3 ? 'up' : trendPct < -3 ? 'down' : 'stable';

  const stats: MarketStats = {
    min: Math.min(...basis),
    max: Math.max(...basis),
    avg: Math.round(basis.reduce((a, b) => a + b, 0) / basis.length),
    median: median(basis),
    listed: listedPrices.length,
    sold: sales.length,
    lastSale: sales.length ? Number(sales[sales.length - 1].price) : 0,
    lastSaleAt: sales.length ? new Date(sales[sales.length - 1].sold_at).getTime() : 0,
    trend,
    trendPct,
  };
  return { series, stats };
}
