import { useI18n } from '../../lib/i18n';
import { SLOT_DETAIL, WARDROBE_RARITIES, WARDROBE_RARITY_COLOR, type EquippedItem, type EquipSlotKey, type WardrobeItem } from '../../lib/wardrobe/types';

export function EquipSlot({
  slotKey, label, icon, item, equipped, readOnly, onClick, onPatch, onClear,
}: {
  slotKey: EquipSlotKey;
  label: string;
  icon: string;
  item: WardrobeItem | null | undefined; // the catalog item (name/icon/level/subtype)
  equipped: EquippedItem | null | undefined; // the player's own rarity/aging/mix/affix for this equip
  readOnly?: boolean;
  onClick?: () => void;
  onPatch?: (patch: Partial<EquippedItem>) => void;
  onClear?: () => void;
}) {
  const { t } = useI18n();
  const rarity = equipped?.rarity;
  const rar = rarity ? WARDROBE_RARITY_COLOR[rarity] : undefined;
  const detail = SLOT_DETAIL[slotKey];

  return (
    <div className={`wd-slot ${item ? 'filled' : ''} ${readOnly ? 'ro' : ''}`} style={{ ['--rar' as string]: rar }}>
      <button type="button" className="wd-slot-btn" onClick={onClick} disabled={readOnly && !item}>
        {item ? <img src={item.iconUrl} alt={item.name} className="wd-slot-icon" /> : <span className="wd-slot-empty">{icon}</span>}
        {detail === 'aging' && equipped?.aging != null && <span className="wd-slot-aging">+{equipped.aging}</span>}
      </button>
      {item && !readOnly && onClear && (
        <button type="button" className="wd-slot-clear" onClick={onClear} title={t('wd.slot.clear')}>✕</button>
      )}
      <span className="wd-slot-label">{label}</span>

      {item && !readOnly && onPatch && (
        <div className="wd-slot-controls">
          <select className="wd-slot-rarity" value={rarity} onChange={(e) => onPatch({ rarity: e.target.value as EquippedItem['rarity'] })} style={{ color: rar }}>
            {WARDROBE_RARITIES.map((r) => <option key={r} value={r}>{t(`wd.rarity.${r}`)}</option>)}
          </select>
          {detail === 'aging' && (
            <input
              className="wd-slot-aginput"
              type="number"
              placeholder="Aging"
              value={equipped?.aging ?? ''}
              onChange={(e) => onPatch({ aging: e.target.value === '' ? null : Number(e.target.value) })}
            />
          )}
          {detail === 'mix_affix' && (
            <>
              <label className="wd-slot-fieldlabel">Mix
                <textarea
                  className="wd-slot-textarea" rows={2} placeholder={t(`wd.detail.mixph.${slotKey}`)}
                  value={equipped?.mix ?? ''} onChange={(e) => onPatch({ mix: e.target.value || null })}
                />
              </label>
              <label className="wd-slot-fieldlabel">Affix
                <textarea
                  className="wd-slot-textarea" rows={2} placeholder={t('wd.detail.affixph')}
                  value={equipped?.affix ?? ''} onChange={(e) => onPatch({ affix: e.target.value || null })}
                />
              </label>
            </>
          )}
          {detail === 'affix_only' && (
            <label className="wd-slot-fieldlabel">Affix
              <textarea
                className="wd-slot-textarea" rows={2} placeholder={t('wd.detail.affixph')}
                value={equipped?.affix ?? ''} onChange={(e) => onPatch({ affix: e.target.value || null })}
              />
            </label>
          )}
        </div>
      )}

      {item && (
        <div className="wd-tooltip">
          <b style={{ color: rar }}>{item.name}</b>
          <span>{rarity ? t(`wd.rarity.${rarity}`) : ''} · {t('wd.itemlevel.short')} {item.level}</span>
          {item.subtype && <span className="wd-muted">{item.subtype}</span>}
          {detail === 'aging' && equipped?.aging != null && <span className="wd-tooltip-aging">Aging +{equipped.aging}</span>}
          {equipped?.mix && <span className="wd-tooltip-detail">Mix: {equipped.mix}</span>}
          {equipped?.affix && <span className="wd-tooltip-detail">Affix: {equipped.affix}</span>}
        </div>
      )}
    </div>
  );
}
