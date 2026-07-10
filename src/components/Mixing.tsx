// Mixing formulas browser: pick a category, search by effect, and/or filter by
// the sheltoms you have. Data mirrors the PristonTale EU wiki.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import { ALL_SHELTOMS, MIX_CATEGORIES, type MixCategory, type MixFormula, sheltomIcon } from '../lib/mixing';

function SheltomChip({ name, qty }: { name: string; qty?: number }) {
  return (
    <span className="mix-shel" title={name}>
      <img src={sheltomIcon(name)} alt="" loading="lazy" />
      <span className="mix-shel-name">{name}</span>
      {qty != null && <b className="mix-shel-qty">×{qty}</b>}
    </span>
  );
}

function FormulaRow({ f, highlight, onOpen }: { f: MixFormula; highlight: Set<string>; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" className="mix-row" onClick={onOpen}>
      <div className="mix-effects">
        <span className="mix-col-label">{t('mix.effect')}</span>
        <ul>{f.effects.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
      <div className="mix-sheltoms">
        <span className="mix-col-label">{t('mix.required')}</span>
        <div className="mix-shel-list">
          {f.sheltoms.map((s) => (
            <span key={s.name} className={highlight.size && highlight.has(s.name) ? 'mix-shel-hit' : ''}>
              <SheltomChip name={s.name} qty={s.qty} />
            </span>
          ))}
        </div>
      </div>
      <span className="mix-row-open">🔍</span>
    </button>
  );
}

/** Detailed view of a single formula. */
function FormulaModal({ f, cat, onClose }: { f: MixFormula; cat: MixCategory; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalSheltoms = f.sheltoms.reduce((a, s) => a + s.qty, 0);

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mix-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <span className="mix-modal-cat">{cat.icon} {cat.name}</span>

        <section className="mix-modal-block">
          <h3 className="mix-modal-h">{t('mix.effect')}</h3>
          <ul className="mix-modal-effects">
            {f.effects.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </section>

        <section className="mix-modal-block">
          <h3 className="mix-modal-h">{t('mix.required')}</h3>
          <div className="mix-modal-shels">
            {f.sheltoms.map((s) => (
              <div key={s.name} className="mix-modal-shel">
                <img src={sheltomIcon(s.name)} alt="" />
                <b className="mix-modal-shel-qty">×{s.qty}</b>
                <span className="mix-modal-shel-name">{s.name}</span>
              </div>
            ))}
          </div>
          <p className="mix-modal-total">{t('mix.total', { n: totalSheltoms })}</p>
        </section>
      </div>
    </div>,
    document.body,
  );
}

export function Mixing() {
  const { t } = useI18n();
  const [catId, setCatId] = useState(MIX_CATEGORIES[0].id);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MixFormula | null>(null);

  const cat = MIX_CATEGORIES.find((c) => c.id === catId) ?? MIX_CATEGORIES[0];

  const toggleShel = (name: string) => setPicked((prev) => {
    const nx = new Set(prev);
    if (nx.has(name)) nx.delete(name); else nx.add(name);
    return nx;
  });

  const formulas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cat.formulas.filter((f) => {
      if (needle && !f.effects.some((e) => e.toLowerCase().includes(needle))) return false;
      // "Só as que eu consigo fazer": every required sheltom must be selected.
      if (picked.size && !f.sheltoms.every((s) => picked.has(s.name))) return false;
      return true;
    });
  }, [cat, q, picked]);

  return (
    <div className="mk mixing">
      <div className="mix-head">
        <h1 className="mk-h1">⚗️ {t('mix.title')}</h1>
        <p className="mk-muted">{t('mix.subtitle')}</p>
      </div>

      <div className="mix-cats">
        {MIX_CATEGORIES.map((c) => (
          <button key={c.id} className={c.id === catId ? 'on' : ''} onClick={() => setCatId(c.id)}>
            {c.icon} {c.name} <span className="mix-cat-count">{c.formulas.length}</span>
          </button>
        ))}
      </div>

      <div className="mix-tools">
        <div className="mix-search">
          <span>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mix.search.ph')} />
          {q && <button className="mix-clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <div className="mix-filter">
          <span className="mix-filter-label">{t('mix.filter.label')}</span>
          <div className="mix-filter-chips">
            {ALL_SHELTOMS.map((s) => (
              <button key={s} className={`mix-chip ${picked.has(s) ? 'on' : ''}`} onClick={() => toggleShel(s)}>
                <img src={sheltomIcon(s)} alt="" loading="lazy" /> {s}
              </button>
            ))}
            {picked.size > 0 && <button className="mix-chip clear" onClick={() => setPicked(new Set())}>✕ {t('mix.filter.clear')}</button>}
          </div>
          {picked.size > 0 && <p className="mk-muted mix-filter-hint">{t('mix.filter.hint')}</p>}
        </div>
      </div>

      <div className="mix-count">{t('mix.showing', { n: formulas.length, total: cat.formulas.length })}</div>

      <div className="mix-list">
        {formulas.map((f, i) => <FormulaRow key={i} f={f} highlight={picked} onOpen={() => setOpen(f)} />)}
        {formulas.length === 0 && <p className="mk-muted mix-empty">{t('mix.none')}</p>}
      </div>

      {open && <FormulaModal f={open} cat={cat} onClose={() => setOpen(null)} />}
    </div>
  );
}
