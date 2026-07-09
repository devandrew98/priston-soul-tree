// Marketplace domain types. Front-end MVP — data is mocked in data.ts, but the
// shapes mirror what a real API (Users / Items / Sellers / Prices) would return,
// so wiring a backend later is a drop-in replacement.

export type Currency = 'gold' | 'coins';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ListingStatus = 'available' | 'reserved' | 'sold';

export type Trend = 'up' | 'down' | 'stable';

export type RepLevel = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';

export interface Stat {
  label: string;
  value: string;
}

export interface Seller {
  id: string;
  nick: string;
  avatar: string; // emoji / single glyph used as avatar
  className: string; // Priston Tale class
  level: number;
  clan: string;
  joinedAt: number; // epoch ms
  lastSeen: number; // epoch ms
  online: boolean;
  verified: boolean;
  totalSalesValue: number; // gold moved
  itemsSold: number;
  itemsBought: number;
  ratingAvg: number; // 0..5
  ratingCount: number;
  positivePct: number; // 0..100
  avgResponseMin: number;
  avgCompleteMin: number;
  reports: number; // number of times reported
  medals: string[]; // medal ids (see MEDALS)
  repTierOverride?: string | null; // admin-assigned category (rep_tiers.key); null = automatic
}

export interface Listing {
  id: string;
  name: string;
  itemLevel: number;
  icon: string; // emoji fallback icon
  image?: string; // uploaded item image (data URL); when present, shown instead of icon
  category: string; // category id
  subcategory: string;
  rarity: Rarity;
  tier: number; // legacy (no longer shown/edited)
  sockets: number; // legacy (no longer shown/edited)
  classReq: string; // legacy (no longer shown/edited)
  stats: Stat[];
  quantity: number;
  price: number;
  currency: Currency;
  description: string;
  status: ListingStatus;
  highlighted: boolean;
  sellerId: string;
  views: number;
  createdAt: number; // epoch ms
  soldAt?: number; // epoch ms — momento em que virou "sold" (vem de updated_at)
}

export interface PricePoint {
  t: number; // epoch ms (day)
  price: number;
}

export interface MarketStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  listed: number;
  sold: number;
  lastSale: number; // price
  lastSaleAt: number; // epoch ms
  trend: Trend;
  trendPct: number; // signed % change over the window
}

export interface Review {
  id: string;
  fromNick: string;
  fromAvatar: string;
  stars: number; // 1..5
  tags: string[]; // review tag ids
  comment: string;
  at: number; // epoch ms
}
