// Domain types for the "Armário de Personagem" (Character Wardrobe) tool.

export type WardrobeClass =
  | 'fighter' | 'archer' | 'mechanician' | 'assassin' | 'pikeman'
  | 'knight' | 'shaman' | 'priestess' | 'magician' | 'atalanta';

export const WARDROBE_CLASSES: WardrobeClass[] = [
  'fighter', 'archer', 'mechanician', 'assassin', 'pikeman',
  'knight', 'shaman', 'priestess', 'magician', 'atalanta',
];

export const CLASS_PORTRAIT: Record<WardrobeClass, string> = Object.fromEntries(
  WARDROBE_CLASSES.map((c) => [c, `/wardrobe/classes/${c}.png`]),
) as Record<WardrobeClass, string>;

/** Plain thousands-dotted number (450000000 -> "450.000.000") — no k/kk/kkk
 *  abbreviation, unlike the Marketplace's fmtPrice. */
export function fmtWardrobeNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export type WardrobeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const WARDROBE_RARITIES: WardrobeRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const WARDROBE_RARITY_COLOR: Record<WardrobeRarity, string> = {
  common: '#9c9079',
  uncommon: '#5cb85c',
  rare: '#4a90d9',
  epic: '#b452d9',
  legendary: '#e6b93b',
};

/** The 11 equipment slots. */
export type EquipSlotKey =
  | 'amulet' | 'ring1' | 'ring2' | 'sheltom' | 'bracelet' | 'gauntlet' | 'boot'
  | 'armor' | 'weapon1h' | 'weapon2h' | 'offhand';

/** The item-catalog slot a wardrobe_items row belongs to (ring1/ring2 both draw from 'ring'). */
export type ItemSlot = 'amulet' | 'ring' | 'bracelet' | 'sheltom' | 'gauntlet' | 'boot' | 'armor' | 'weapon_1h' | 'weapon_2h' | 'orb' | 'shield';

export const SLOT_TO_ITEM_SLOT: Record<EquipSlotKey, ItemSlot | 'offhand'> = {
  amulet: 'amulet', ring1: 'ring', ring2: 'ring', sheltom: 'sheltom', bracelet: 'bracelet',
  gauntlet: 'gauntlet', boot: 'boot', armor: 'armor', weapon1h: 'weapon_1h', weapon2h: 'weapon_2h',
  offhand: 'offhand', // special-cased: orb OR shield
};

export interface WardrobeItem {
  id: number;
  slot: ItemSlot;
  name: string;
  subtype: string;
  rarity: WardrobeRarity; // the catalog's default tier — just a starting suggestion, see EquippedItem.rarity
  level: number;
  iconUrl: string;
}

/** A specific equipped instance: the base item plus the player's own rarity
 *  (in-game, the same item can be refined up to any of the 5 tiers, so rarity
 *  is chosen per equip, not fixed by the catalog) and, depending on the slot,
 *  either an Aging value, or free-text Mix/Affix lines — see SLOT_DETAIL. */
export interface EquippedItem {
  itemId: number;
  rarity: WardrobeRarity;
  aging: number | null;
  mix: string | null;
  affix: string | null;
}

export type Equipment = Record<EquipSlotKey, EquippedItem | null>;

/** Which extra detail fields a slot's picker/doll should show. */
export type SlotDetail = 'aging' | 'mix_affix' | 'affix_only';
export const SLOT_DETAIL: Record<EquipSlotKey, SlotDetail> = {
  armor: 'aging', weapon1h: 'aging', weapon2h: 'aging', offhand: 'aging',
  bracelet: 'mix_affix', gauntlet: 'mix_affix', boot: 'mix_affix',
  amulet: 'affix_only', ring1: 'affix_only', ring2: 'affix_only', sheltom: 'affix_only',
};

export const EMPTY_EQUIPMENT: Equipment = {
  amulet: null, ring1: null, ring2: null, sheltom: null, bracelet: null, gauntlet: null,
  boot: null, armor: null, weapon1h: null, weapon2h: null, offhand: null,
};

/** A Soul the character has, at the level the player picked (1/2/3 — same as the Soul Tree). */
export interface CharacterSoul {
  id: string; // Soul id, from the exact same catalog as the Soul Tree (src/data/souls.json)
  level: 1 | 2 | 3;
}

export interface WardrobeCharacter {
  id: string;
  ownerId: string;
  slug: string;
  nick: string;
  class: WardrobeClass;
  level: number;
  expPct: number;
  notes: string;
  priceCoins: number | null;
  priceGold: number | null;
  contactWhatsapp: string;
  contactDiscord: string;
  listedOnMarketplace: boolean;
  equipment: Equipment;
  souls: CharacterSoul[];
  createdAt: number;
  updatedAt: number;
}
