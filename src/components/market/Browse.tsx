import { useState } from 'react';
import { RARITIES, SELLERS } from '../../lib/market/data';
import { useCategories } from '../../lib/market/marketCategories';
import { EMPTY_FILTERS, type Filters, type SortKey } from '../../lib/market/helpers';
import { useI18n } from '../../lib/i18n';
import { ItemCard } from './ItemCard';
import { useBrowseListings } from './useMarketData';

const SORTS: SortKey[] = ['price_asc', 'price_desc', 'newest', 'oldest', 'views', 'rating', 'sold'];

export function Browse({ onOpen, onSeller }: { onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t, lang } = useI18n();
  const categories = useCategories();
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const { listings: results, loading } = useBrowseListings(f, sort);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  const activeFilters = Object.entries(f).filter(([k, v]) => {
    if (k === 'q') return false;
    const empty = v === '' || v === 0 || v === null || v === false;
    return !empty;
  }).length;

  return (
    <div className="mk-browse">
      {/* search bar */}
      <div className="mk-searchbar">
        <span className="mk-search-ic">🔍</span>
        <input
          className="mk-search"
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder={t('mk.search.ph')}
          autoFocus
        />
        {f.q && <button className="mk-search-clear" onClick={() => set('q', '')}>✕</button>}
        <button className={`mk-filter-toggle ${showFilters ? 'on' : ''}`} onClick={() => setShowFilters((s) => !s)}>
          ⚙ {t('mk.filters')} {activeFilters > 0 && <span className="mk-fcount">{activeFilters}</span>}
        </button>
      </div>

      {/* category chips */}
      <div className="mk-cats">
        <button className={f.category === '' ? 'on' : ''} onClick={() => set('category', '')}>{t('mk.allcats')}</button>
        {categories.map((c) => (
          <button key={c.key} className={f.category === c.key ? 'on' : ''} onClick={() => set('category', f.category === c.key ? '' : c.key)}>
            {c.icon} {c.label[lang]}
          </button>
        ))}
      </div>

      <div className={`mk-browse-body ${showFilters ? 'with-filters' : ''}`}>
        {/* filters */}
        {showFilters && (
          <aside className="mk-filters">
            <div className="mk-filters-head">
              <b>{t('mk.filters')}</b>
              <button className="mk-btn sm" onClick={() => setF({ ...EMPTY_FILTERS, q: f.q })}>{t('mk.clearfilters')}</button>
            </div>

            <FField label={t('mk.rarity.label')}>
              <select value={f.rarity} onChange={(e) => set('rarity', e.target.value)}>
                <option value="">{t('mk.any')}</option>
                {RARITIES.map((r) => <option key={r} value={r}>{t(`mk.rarity.${r}`)}</option>)}
              </select>
            </FField>

            <FField label={t('mk.minlevel')}>
              <input type="number" min={0} value={f.minLevel || ''} onChange={(e) => set('minLevel', Number(e.target.value) || 0)} placeholder="0" />
            </FField>

            <FField label={t('mk.price')}>
              <div className="mk-pricerange">
                <input type="number" value={f.minPrice ?? ''} onChange={(e) => set('minPrice', e.target.value ? Number(e.target.value) : null)} placeholder={t('mk.min')} />
                <span>—</span>
                <input type="number" value={f.maxPrice ?? ''} onChange={(e) => set('maxPrice', e.target.value ? Number(e.target.value) : null)} placeholder={t('mk.max')} />
              </div>
            </FField>

            <FField label={t('mk.seller')}>
              <select value={f.seller} onChange={(e) => set('seller', e.target.value)}>
                <option value="">{t('mk.any')}</option>
                {SELLERS.map((s) => <option key={s.id} value={s.id}>{s.nick}</option>)}
              </select>
            </FField>

            <label className="mk-fcheck"><input type="checkbox" checked={f.onlineOnly} onChange={(e) => set('onlineOnly', e.target.checked)} /> {t('mk.filter.online')}</label>
            <label className="mk-fcheck"><input type="checkbox" checked={f.verifiedOnly} onChange={(e) => set('verifiedOnly', e.target.checked)} /> {t('mk.filter.verified')}</label>
            <label className="mk-fcheck"><input type="checkbox" checked={f.highlightedOnly} onChange={(e) => set('highlightedOnly', e.target.checked)} /> {t('mk.filter.featured')}</label>
          </aside>
        )}

        {/* results */}
        <div className="mk-results">
          <div className="mk-results-head">
            <span className="mk-count-line">{t('mk.resultcount', { n: results.length })}</span>
            <label className="mk-sort">
              {t('mk.sortby')}
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {SORTS.map((s) => <option key={s} value={s}>{t(`mk.sort.${s}`)}</option>)}
              </select>
            </label>
          </div>
          <div className="mk-grid">
            {results.map((l) => <ItemCard key={l.id} listing={l} onOpen={onOpen} onSeller={onSeller} />)}
          </div>
          {loading && <p className="mk-empty">⏳ {t('mk.loading')}</p>}
          {!loading && results.length === 0 && <p className="mk-empty">🔍 {t('mk.noresults')}</p>}
        </div>
      </div>
    </div>
  );
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mk-ffield">
      <span>{label}</span>
      {children}
    </div>
  );
}
