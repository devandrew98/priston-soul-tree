// Visual equipment layout shared by the builder (clickable) and the public
// read-only character page.
import { useI18n } from '../../lib/i18n';
import type { EquippedItem, Equipment, EquipSlotKey, WardrobeItem } from '../../lib/wardrobe/types';
import { EquipSlot } from './EquipSlot';

const SLOT_ICON: Record<EquipSlotKey, string> = {
  amulet: '📿', ring1: '💍', ring2: '💍', sheltom: '💠', bracelet: '⛓️', gauntlet: '🧤',
  boot: '👢', armor: '👕', weapon1h: '🗡️', weapon2h: '⚔️', offhand: '🛡️',
};

export function EquipmentDoll({
  equipment, itemsById, readOnly, onSlotClick, onPatch, onClear,
}: {
  equipment: Equipment;
  itemsById: Map<number, WardrobeItem>;
  readOnly?: boolean;
  onSlotClick?: (slot: EquipSlotKey) => void;
  onPatch?: (slot: EquipSlotKey, patch: Partial<EquippedItem>) => void;
  onClear?: (slot: EquipSlotKey) => void;
}) {
  const { t } = useI18n();
  const itemFor = (key: EquipSlotKey) => { const eq = equipment[key]; return eq ? itemsById.get(eq.itemId) ?? null : null; };
  const slot = (key: EquipSlotKey) => (
    <EquipSlot
      key={key}
      slotKey={key}
      label={t(`wd.slot.${key}`)}
      icon={SLOT_ICON[key]}
      item={itemFor(key)}
      equipped={equipment[key]}
      readOnly={readOnly}
      onClick={onSlotClick ? () => onSlotClick(key) : undefined}
      onPatch={onPatch ? (patch) => onPatch(key, patch) : undefined}
      onClear={onClear ? () => onClear(key) : undefined}
    />
  );

  return (
    <div className="wd-doll">
      <div className="wd-doll-col left">
        {slot('amulet')}
        {slot('ring1')}
        {slot('ring2')}
        {slot('sheltom')}
      </div>
      <div className="wd-doll-col center">
        {slot('armor')}
        <div className="wd-doll-weapons">
          {slot('weapon1h')}
          {slot('offhand')}
          {slot('weapon2h')}
        </div>
      </div>
      <div className="wd-doll-col right">
        {slot('bracelet')}
        {slot('gauntlet')}
        {slot('boot')}
      </div>
    </div>
  );
}
