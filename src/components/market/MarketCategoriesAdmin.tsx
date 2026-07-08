// Admin CRUD for marketplace item categories (Armas, Armaduras, ...). Admin-only.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  type MarketCategory,
  deleteCategory, fetchCategories, loadCategories, newCategoryKey, saveCategory,
} from '../../lib/market/marketCategories';

export function MarketCategoriesAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<MarketCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => fetchCategories().then(setRows).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const addNew = async () => {
    const sort = rows.length ? Math.max(...rows.map((r) => r.sort)) + 1 : 0;
    await saveCategory({ key: newCategoryKey(), icon: '📦', label: { pt: t('mk.admin.cat.new'), en: t('mk.admin.cat.new') }, subs: [], sort }).catch(() => {});
    await loadCategories();
    reload();
  };

  return (
    <div className="mk-tiers-admin">
      <p className="mk-muted">{t('mk.admin.cat.hint')}</p>
      {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
      {rows.map((c) => <CatRow key={c.key} cat={c} onChange={() => { loadCategories(); reload(); }} />)}
      <button className="mk-btn primary mk-tiers-add" onClick={addNew}>➕ {t('mk.admin.cat.add')}</button>
    </div>
  );
}

function CatRow({ cat, onChange }: { cat: MarketCategory; onChange: () => void }) {
  const { t } = useI18n();
  const [icon, setIcon] = useState(cat.icon);
  const [pt, setPt] = useState(cat.label.pt);
  const [en, setEn] = useState(cat.label.en);
  const [subs, setSubs] = useState(cat.subs.join(', '));
  const [sort, setSort] = useState(cat.sort);
  const [busy, setBusy] = useState(false);
  const subsArr = subs.split(',').map((s) => s.trim()).filter(Boolean);
  const dirty = icon !== cat.icon || pt !== cat.label.pt || en !== cat.label.en || subsArr.join('|') !== cat.subs.join('|') || sort !== cat.sort;

  const save = async () => {
    setBusy(true);
    try { await saveCategory({ key: cat.key, icon, label: { pt, en }, subs: subsArr, sort }); onChange(); }
    finally { setBusy(false); }
  };
  const remove = async () => { await deleteCategory(cat.key).catch(() => {}); onChange(); };

  return (
    <div className="mk-cat-row">
      <div className="mk-cat-main">
        <input className="mk-tier-icon" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} title={t('mk.admin.tier.icon')} />
        <input value={pt} onChange={(e) => setPt(e.target.value)} placeholder="🇧🇷 PT" />
        <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="🇬🇧 EN" />
        <input className="mk-tier-num" type="number" value={sort} onChange={(e) => setSort(Number(e.target.value) || 0)} title={t('mk.admin.strm.order')} />
        <span className="mk-tier-acts">
          <button className="mk-btn sm primary" onClick={save} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
          <button className="mk-btn sm danger" onClick={remove}>{t('mk.delete')}</button>
        </span>
      </div>
      <input className="mk-cat-subs" value={subs} onChange={(e) => setSubs(e.target.value)} placeholder={t('mk.admin.cat.subs')} />
    </div>
  );
}
