// Modal: add/remove Souls the character has, at a level (1-3, same as
// in-game). Reuses the exact same Souls catalog as the Soul Tree
// (src/lib/souls.ts) and its category grouping — no separate list.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n';
import { SOULS, CATEGORY_LABEL, CATEGORY_ICON } from '../../lib/souls';
import type { Category } from '../../lib/types';
import { SoulIcon } from '../SoulIcon';
import type { CharacterSoul } from '../../lib/wardrobe/types';

const CATEGORIES: Category[] = ['attack', 'defense', 'support', 'pvp'];

export function SoulsPicker({ selected, onChange, onClose }: { selected: CharacterSoul[]; onChange: (souls: CharacterSoul[]) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category>('attack');
  const byId = useMemo(() => new Map(selected.map((s) => [s.id, s.level])), [selected]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const qq = q.trim().toLowerCase();
  const list = useMemo(
    () => SOULS.filter((s) => s.category === cat && (!qq || s.name.toLowerCase().includes(qq))).sort((a, b) => a.name.localeCompare(b.name)),
    [cat, qq],
  );
  const countInCat = (c: Category) => selected.filter((s) => SOULS.find((x) => x.id === s.id)?.category === c).length;

  const setLevel = (soulId: string, level: 1 | 2 | 3) => {
    const cur = byId.get(soulId);
    if (cur === level) onChange(selected.filter((s) => s.id !== soulId)); // clicking the active level removes it
    else if (cur != null) onChange(selected.map((s) => (s.id === soulId ? { ...s, level } : s)));
    else onChange([...selected, { id: soulId, level }]);
  };

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mk-modal wd-picker souls" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h2 className="mk-modal-title">✨ {t('wd.souls.pick')}</h2>
        <p className="mk-muted">{t('wd.souls.count', { n: selected.length })}</p>

        <div className="wd-souls-cattabs">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
              {CATEGORY_ICON[c]} {CATEGORY_LABEL[c]}
              {countInCat(c) > 0 && <span className="wd-souls-cattabs-badge">{countInCat(c)}</span>}
            </button>
          ))}
        </div>

        <input className="wd-picker-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('wd.souls.search')} />

        <div className="wd-picker-grid souls wd-souls-scroll">
          {list.length === 0 && <p className="mk-muted">{t('wd.picker.empty')}</p>}
          {list.map((s) => {
            const level = byId.get(s.id);
            return (
              <div key={s.id} className={`wd-picker-card soul ${level ? 'on' : ''}`}>
                <SoulIcon soul={s} size={40} />
                <span className="wd-picker-card-name">{s.name}</span>
                <span className="wd-picker-card-meta">{s.mapLevel != null ? `Lv${s.mapLevel}` : ''}</span>
                <div className="wd-soul-levels">
                  {[1, 2, 3].map((lv) => (
                    <button key={lv} type="button" className={level === lv ? 'on' : ''} onClick={() => setLevel(s.id, lv as 1 | 2 | 3)}>{lv}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="wd-modal-actions">
          <button className="mk-btn primary" onClick={onClose}>✓ {t('mk.close')}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
