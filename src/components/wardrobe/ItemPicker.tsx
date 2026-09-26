// Modal: search and pick an item for one equipment slot. No rarity filter here
// on purpose — rarity is chosen per equip afterward (see EquipSlot), since the
// same item can be refined to any tier in-game, not just its catalog default.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n';
import { fetchWardrobeItems } from '../../lib/wardrobe/items';
import { WARDROBE_RARITY_COLOR, type ItemSlot, type WardrobeItem } from '../../lib/wardrobe/types';

export function ItemPicker({
  slots, title, onPick, onClose,
}: {
  slots: ItemSlot[]; // one slot, or ['orb','shield'] for the offhand slot
  title: string;
  onPick: (item: WardrobeItem) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [all, setAll] = useState<WardrobeItem[] | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { fetchWardrobeItems().then(setAll).catch(() => setAll([])); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const list = useMemo(() => {
    if (!all) return [];
    const qq = q.trim().toLowerCase();
    return all
      .filter((it) => slots.includes(it.slot))
      .filter((it) => !qq || it.name.toLowerCase().includes(qq))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  }, [all, slots, q]);

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mk-modal wd-picker" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h2 className="mk-modal-title">{title}</h2>

        <input className="wd-picker-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('wd.picker.search')} autoFocus />
        <p className="mk-muted wd-picker-hint">{t('wd.picker.rarityhint')}</p>

        <div className="wd-picker-grid">
          {all === null && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
          {all !== null && list.length === 0 && <p className="mk-muted">{t('wd.picker.empty')}</p>}
          {list.map((it) => (
            <button key={it.id} className="wd-picker-card" style={{ ['--rar' as string]: WARDROBE_RARITY_COLOR[it.rarity] }} onClick={() => onPick(it)}>
              <img src={it.iconUrl} alt={it.name} />
              <span className="wd-picker-card-name">{it.name}</span>
              <span className="wd-picker-card-meta">{t('wd.itemlevel.short')} {it.level}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
