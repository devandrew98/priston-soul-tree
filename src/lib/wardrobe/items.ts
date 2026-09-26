// Item catalog for the Wardrobe (imported once from pristontale.eu — see
// supabase/22_wardrobe.sql). Small enough (~750 rows) to fetch once and filter
// entirely client-side, which is what gives the picker its instant search.
import { supabase, BACKEND_ENABLED } from '../market/supabase';
import type { ItemSlot, WardrobeItem } from './types';

interface Row { id: number; slot: ItemSlot; name: string; subtype: string; rarity: WardrobeItem['rarity']; level: number; icon_url: string }
const toItem = (r: Row): WardrobeItem => ({ id: r.id, slot: r.slot, name: r.name, subtype: r.subtype, rarity: r.rarity, level: r.level, iconUrl: r.icon_url });

let cache: Promise<WardrobeItem[]> | null = null;

async function load(): Promise<WardrobeItem[]> {
  const { data, error } = await supabase!.from('wardrobe_items').select('id,slot,name,subtype,rarity,level,icon_url');
  if (error) { cache = null; throw error; }
  return (data as Row[]).map(toItem);
}

/** All wardrobe items, fetched once and cached for the session. */
export function fetchWardrobeItems(): Promise<WardrobeItem[]> {
  if (!BACKEND_ENABLED || !supabase) return Promise.resolve([]);
  if (!cache) cache = load();
  return cache;
}

export const ITEM_BY_ID = new Map<number, WardrobeItem>();
fetchWardrobeItems().then((items) => { for (const it of items) ITEM_BY_ID.set(it.id, it); }).catch(() => {});
