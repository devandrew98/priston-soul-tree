// Tiny in-memory cache of seller profiles fetched from the DB, so the existing
// getSeller(id) resolver (used by cards/detail) keeps working for real listings
// without threading seller objects through every component.
import type { Seller } from './types';

const cache = new Map<string, Seller>();
const contributors = new Set<string>();

export function cacheProfiles(sellers: Seller[], contributorIds: string[] = []) {
  for (const s of sellers) cache.set(s.id, s);
  for (const id of contributorIds) contributors.add(id);
}

export function getCachedProfile(id: string): Seller | undefined {
  return cache.get(id);
}

export function isCachedContributor(id: string): boolean {
  return contributors.has(id);
}
