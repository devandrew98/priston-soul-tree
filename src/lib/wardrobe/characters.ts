// CRUD for wardrobe characters (Supabase). Row <-> domain mapping + slug
// generation for the public share link.
import { supabase, BACKEND_ENABLED } from '../market/supabase';
import type { CharacterSoul, Equipment, WardrobeCharacter, WardrobeClass } from './types';
import { EMPTY_EQUIPMENT } from './types';

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

interface Row {
  id: string; owner_id: string; slug: string; nick: string; class: WardrobeClass; level: number; exp_pct: number | string;
  notes: string; price_coins: number | string | null; price_gold: number | string | null;
  contact_whatsapp: string; contact_discord: string; listed_on_marketplace: boolean;
  equipment: Equipment; souls: CharacterSoul[]; created_at: string; updated_at: string;
}

const SELECT = '*';

function toCharacter(r: Row): WardrobeCharacter {
  return {
    id: r.id, ownerId: r.owner_id, slug: r.slug, nick: r.nick, class: r.class, level: r.level,
    expPct: Number(r.exp_pct), notes: r.notes, priceCoins: r.price_coins != null ? Number(r.price_coins) : null,
    priceGold: r.price_gold != null ? Number(r.price_gold) : null, contactWhatsapp: r.contact_whatsapp ?? '',
    contactDiscord: r.contact_discord ?? '', listedOnMarketplace: !!r.listed_on_marketplace,
    equipment: { ...EMPTY_EQUIPMENT, ...(r.equipment ?? {}) }, souls: r.souls ?? [],
    createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  };
}

const slugify = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'char';
const randomSuffix = (): string => Math.random().toString(36).slice(2, 7);

export interface CharacterInput {
  nick: string; class: WardrobeClass; level: number; expPct: number; notes: string;
  priceCoins: number | null; priceGold: number | null; contactWhatsapp: string; contactDiscord: string;
  listedOnMarketplace: boolean; equipment: Equipment; souls: CharacterSoul[];
}

function toRowPatch(input: CharacterInput): Record<string, unknown> {
  return {
    nick: input.nick, class: input.class, level: input.level, exp_pct: input.expPct, notes: input.notes,
    price_coins: input.priceCoins, price_gold: input.priceGold, contact_whatsapp: input.contactWhatsapp,
    contact_discord: input.contactDiscord, listed_on_marketplace: input.listedOnMarketplace,
    equipment: input.equipment, souls: input.souls, updated_at: new Date().toISOString(),
  };
}

/** Creates a new character with a fresh unguessable slug; retries once on a slug collision. */
export async function createCharacter(ownerId: string, input: CharacterInput): Promise<WardrobeCharacter> {
  const base = slugify(input.nick);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const { data, error } = await sb().from('wardrobe_characters')
      .insert({ owner_id: ownerId, slug, ...toRowPatch(input) }).select(SELECT).single();
    if (!error) return toCharacter(data as Row);
    if (!/duplicate key/i.test(error.message) || attempt === 2) throw error;
  }
  throw new Error('slug_collision');
}

export async function updateCharacter(id: string, input: CharacterInput): Promise<void> {
  const { error } = await sb().from('wardrobe_characters').update(toRowPatch(input)).eq('id', id);
  if (error) throw error;
}

export async function deleteCharacter(id: string): Promise<void> {
  const { error } = await sb().from('wardrobe_characters').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCharacterBySlug(slug: string): Promise<WardrobeCharacter | null> {
  const { data, error } = await sb().from('wardrobe_characters').select(SELECT).eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data ? toCharacter(data as Row) : null;
}

export async function fetchCharacter(id: string): Promise<WardrobeCharacter | null> {
  const { data, error } = await sb().from('wardrobe_characters').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toCharacter(data as Row) : null;
}

export async function fetchMyCharacters(ownerId: string): Promise<WardrobeCharacter[]> {
  const { data, error } = await sb().from('wardrobe_characters').select(SELECT).eq('owner_id', ownerId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(toCharacter);
}

export { BACKEND_ENABLED };
