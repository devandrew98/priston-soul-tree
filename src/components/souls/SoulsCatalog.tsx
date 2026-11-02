// pristonzone.com/lista-souls: every soul of the game, what it gives (same data as the Soul Tree) and where it drops.
import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { RARITY_LABEL } from '../../lib/formula';
import { CATEGORY_LABEL } from '../../lib/souls';
import {
  CATALOG, EMPTY_QUERY, MAPS, STAT_LABELS, filterCatalog, plain, sortCatalog,
  type CatalogSoul, type Query, type SortMode,
} from '../../lib/soulsCatalog';
import type { Category, Rarity } from '../../lib/types';
import { SoulIcon } from '../SoulIcon';

type L = { pt: string; en: string };

const TXT = {
  title: { pt: 'Souls', en: 'Souls' },
  subtitle: { pt: 'Todas as souls do jogo: o que cada uma dá de atributo e onde ela cai.', en: 'Every soul in the game: the stats each one gives and where it drops.' },
  type: { pt: 'Tipo', en: 'Type' },
  all: { pt: 'Todas', en: 'All' },
  stat: { pt: 'Atributo', en: 'Stat' },
  anyStat: { pt: 'Todos os atributos', en: 'All stats' },
  map: { pt: 'Onde cai', en: 'Where it drops' },
  anyMap: { pt: 'Qualquer lugar', en: 'Anywhere' },
  rarity: { pt: 'Raridade', en: 'Rarity' },
  anyRarity: { pt: 'Todas', en: 'All' },
  search: { pt: 'Buscar por soul, atributo ou mapa', en: 'Search by soul, stat or map' },
  sort: { pt: 'Ordenar', en: 'Sort' },
  sortLevel: { pt: 'Nível (menor primeiro)', en: 'Level (lowest first)' },
  sortLevelDesc: { pt: 'Nível (maior primeiro)', en: 'Level (highest first)' },
  sortName: { pt: 'Nome (A–Z)', en: 'Name (A–Z)' },
  sortStat: { pt: 'Maior valor do atributo', en: 'Best value of the stat' },
  sortRarity: { pt: 'Raridade', en: 'Rarity' },
  count: { pt: '{n} souls', en: '{n} souls' },
  none: { pt: 'Nenhuma soul com esses filtros.', en: 'No soul with these filters.' },
  clear: { pt: 'Limpar filtros', en: 'Clear filters' },
  level: { pt: 'Nível', en: 'Level' },
  rank: { pt: 'Rank', en: 'Rank' },
  mapLevel: { pt: 'Nível do Mapa', en: 'Map Level' },
  drops: { pt: 'Mapa', en: 'Map' },
  filterMap: { pt: 'Filtrar por este local', en: 'Filter by this place' },
  note: {
    pt: 'Os atributos e valores são os da Árvore de Souls. Os locais vêm da tabela de souls do PristonZONE; o número ao lado do local é o que consta na tabela.',
    en: 'Stats and values are the ones from the Soul Tree. The places come from the PristonZONE souls table; the number next to a place is the one listed in the table.',
  },
} as const satisfies Record<string, L>;

const CATEGORY_NAME: Record<Category, string> = CATEGORY_LABEL;

function Card({ c, onMap, mapHit, statHit, lang }: { c: CatalogSoul; onMap: (m: string) => void; mapHit: string; statHit: string; lang: 'pt' | 'en' }) {
  const { soul } = c;
  return (
    <li className="sl-card">
      <div className="sl-top">
        <span className="sl-ico"><SoulIcon soul={soul} size={56} /></span>
        <div className="sl-head">
          <b className="sl-name">{soul.name}</b>
          <div className="sl-tags">
            <span className={`chip ${soul.category}`}>{CATEGORY_NAME[soul.category]}</span>
            <span className={`rarity-tag ${soul.rarity}`}>{RARITY_LABEL[soul.rarity]}</span>
          </div>
          <span className="sl-maplevel">{TXT.mapLevel[lang]} - <b>{c.level}</b></span>
        </div>
      </div>

      <div className="sl-statlist">
        {soul.stats.map((st) => (
          <div key={st.stat} className={`sl-stat${st.statLabel === statHit ? ' hit' : ''}`}>
            <span className="sl-stat-name">{st.statLabel}</span>
            <span className="sl-ranks">
              {st.ranks.map((v, i) => (
                <span key={i} className="sl-rk"><i>{TXT.level[lang]} {i + 1}</i><b>{plain(v)}{st.unit === 'pct' ? '%' : ''}</b></span>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="sl-where">
        <span className="sl-where-label">📍 {TXT.drops[lang]}</span>
        <div className="sl-places">
          {c.where.map(([map, n]) => {
            const filterable = MAPS.includes(map);
            const extra = n !== undefined ? <small>({n})</small> : null;
            return filterable ? (
              <button key={map} type="button" className={`sl-place${map === mapHit ? ' on' : ''}`} title={TXT.filterMap[lang]} onClick={() => onMap(map)}>{map} {extra}</button>
            ) : <span key={map} className="sl-place plain">{map} {extra}</span>;
          })}
        </div>
      </div>
    </li>
  );
}

export function SoulsCatalog() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [q, setQ] = useState<Query>(EMPTY_QUERY);
  const [sort, setSort] = useState<SortMode>('level');
  const patch = (p: Partial<Query>) => setQ((cur) => ({ ...cur, ...p }));

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: CATALOG.length };
    for (const c of CATALOG) m[c.soul.category] = (m[c.soul.category] ?? 0) + 1;
    return m;
  }, []);

  const effectiveSort: SortMode = sort === 'stat' && q.stat === 'all' ? 'level' : sort;
  const list = useMemo(() => sortCatalog(filterCatalog(q), effectiveSort, q.stat), [q, effectiveSort]);
  const dirty = q.category !== 'all' || q.text !== '' || q.stat !== 'all' || q.map !== 'all' || q.rarity !== 'all';

  const pickStat = (stat: string) => { patch({ stat }); if (stat !== 'all') setSort('stat'); else if (sort === 'stat') setSort('level'); };

  return (
    <div className="mk af sl">
      <h1 className="mk-h1">👻 {T('title')}</h1>
      <p className="mk-muted">{T('subtitle')}</p>

      <section className="sr-card af-filters">
        <div className="af-field">
          <span className="af-label">{T('type')}</span>
          <div className="af-chips" role="group" aria-label={T('type')}>
            {(['all', 'attack', 'defense', 'support', 'pvp'] as const).map((k) => (
              <button key={k} type="button" className={`af-chip${q.category === k ? ' on' : ''}`} aria-pressed={q.category === k} onClick={() => patch({ category: k })}>
                {k === 'all' ? T('all') : CATEGORY_NAME[k]} <small>{counts[k] ?? 0}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="af-row-fields">
          <label className="af-field af-grow">
            <span className="af-label">{T('search')}</span>
            <input type="search" value={q.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Headcutter, Block, Oasis…" />
          </label>
          <label className="af-field af-small">
            <span className="af-label">{T('stat')}</span>
            <select value={q.stat} onChange={(e) => pickStat(e.target.value)}>
              <option value="all">{T('anyStat')}</option>
              {STAT_LABELS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="af-field af-small">
            <span className="af-label">{T('map')}</span>
            <select value={q.map} onChange={(e) => patch({ map: e.target.value })}>
              <option value="all">{T('anyMap')}</option>
              {MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        <div className="af-row-fields">
          <label className="af-field af-small">
            <span className="af-label">{T('rarity')}</span>
            <select value={q.rarity} onChange={(e) => patch({ rarity: e.target.value as 'all' | Rarity })}>
              <option value="all">{T('anyRarity')}</option>
              {(['common', 'rare', 'legendary'] as const).map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
            </select>
          </label>
          <label className="af-field af-small">
            <span className="af-label">{T('sort')}</span>
            <select value={effectiveSort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="level">{T('sortLevel')}</option>
              <option value="levelDesc">{T('sortLevelDesc')}</option>
              <option value="name">{T('sortName')}</option>
              <option value="rarity">{T('sortRarity')}</option>
              <option value="stat" disabled={q.stat === 'all'}>{T('sortStat')}</option>
            </select>
          </label>
        </div>
      </section>

      <div className="af-count">
        <b>{TXT.count[lang].replace('{n}', String(list.length))}</b>
        {dirty && <button type="button" className="mk-btn sm" onClick={() => { setQ(EMPTY_QUERY); setSort('level'); }}>{T('clear')}</button>}
      </div>

      {list.length === 0 && <p className="mk-muted">{T('none')}</p>}

      <ul className="sl-list">
        {list.map((c) => <Card key={c.soul.id} c={c} lang={lang} mapHit={q.map} statHit={q.stat} onMap={(m) => patch({ map: q.map === m ? 'all' : m })} />)}
      </ul>

      <p className="mk-muted sl-note">{T('note')}</p>
    </div>
  );
}
