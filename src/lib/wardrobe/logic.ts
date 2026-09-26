// Equipment helpers. Weapon slots (1H, offhand, 2H) are all independent — a
// character can carry a one-handed weapon + shield/orb AND a two-handed
// weapon at the same time (an alternate weapon set), so no slot clears another.
import type { Equipment, EquipSlotKey, EquippedItem } from './types';

export function applyEquip(equipment: Equipment, slot: EquipSlotKey, item: EquippedItem | null): Equipment {
  return { ...equipment, [slot]: item };
}

export function patchEquipped(equipment: Equipment, slot: EquipSlotKey, patch: Partial<EquippedItem>): Equipment {
  const cur = equipment[slot];
  if (!cur) return equipment;
  return { ...equipment, [slot]: { ...cur, ...patch } };
}
