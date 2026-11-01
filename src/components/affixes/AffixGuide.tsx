// pristonzone.com/afixos: the Affix Guide. Pick the item, say what you want (a stat, an item level) and the affixes that fit come first.
import { useMemo, useState } from 'react';
import { AFFIXES, type Affix, type ItemType, type StatKey } from '../../lib/affixes/data';
import {
  ITEM_TYPES, STAT_KEYS, STONES, TIERS, bracket, filterAffixes, sortAffixes,
  type Query, type SortMode, type Tier,
} from '../../lib/affixes/guide';
import { useI18n } from '../../lib/i18n';

type L = { pt: string; en: string };

const TXT = {
  title: { pt: 'Guia de Afixos', en: 'Affix Guide' },
  subtitle: { pt: 'Escolha o item, diga o que você quer e veja os afixos que servem, os melhores primeiro.', en: 'Pick the item, say what you want, and see the affixes that fit, best first.' },
  how: { pt: 'Como funciona (tiers e pedras)', en: 'How it works (tiers and stones)' },
  howIntro: {
    pt: 'Cada afixo é um prefixo ou um sufixo. Os afixos de cada tipo de item ficam em quatro faixas de nível, chamadas de Tier. Um afixo pertence ao Tier em que a faixa de nível dele cabe.',
    en: 'Each affix is a prefix or a suffix. The affixes of every item type sit in four level brackets, called Tiers. An affix belongs to the Tier its level range fits in.',
  },
  tierCol: { pt: 'Tier', en: 'Tier' },
  rangeCol: { pt: 'Faixa de nível do afixo', en: 'Affix level range' },
  stonesIntro: {
    pt: 'As pedras só funcionam em itens da faixa delas, mas podem sortear qualquer afixo cuja faixa se sobreponha à do item.',
    en: 'Stones only work on items in their own window, but can roll any affix whose range overlaps the item level.',
  },
  stoneCol: { pt: 'Pedra', en: 'Stone' },
  itemLevelCol: { pt: 'Nível do item', en: 'Item level' },
  eligibleCol: { pt: 'Afixos que ela pode sortear', en: 'Affixes it can roll' },
  example: {
    pt: 'Exemplo: Marksman (sufixo de anel) é Tier 4, faixa 100–130. Ele sai em qualquer anel de nível 100 a 120, com uma Great-Tier (anel nível 100–110) ou uma Perfect-Tier (anel nível 111–120).',
    en: 'Example: Marksman (ring suffix) is Tier 4, range 100–130. It rolls on any ring of level 100 to 120, with a Great-Tier stone (ring level 100–110) or a Perfect-Tier stone (ring level 111–120).',
  },
  item: { pt: 'Item', en: 'Item' },
  kind: { pt: 'Tipo', en: 'Type' },
  all: { pt: 'Todos', en: 'All' },
  prefix: { pt: 'Prefixo', en: 'Prefix' },
  prefixes: { pt: 'Prefixos', en: 'Prefixes' },
  suffixes: { pt: 'Sufixos', en: 'Suffixes' },
  suffix: { pt: 'Sufixo', en: 'Suffix' },
  want: { pt: 'O que eu quero', en: 'What I want' },
  anything: { pt: 'Todos os Atributos', en: 'All Stats' },
  tier: { pt: 'Tier', en: 'Tier' },
  search: { pt: 'Buscar pelo nome do afixo', en: 'Search by affix name' },
  sort: { pt: 'Ordenar', en: 'Sort' },
  sortBest: { pt: 'Melhor valor do atributo', en: 'Best value of the stat' },
  sortTier: { pt: 'Tier (do mais alto)', en: 'Tier (highest first)' },
  sortCommon: { pt: 'Mais comum', en: 'Most common' },
  sortRare: { pt: 'Mais raro', en: 'Rarest' },
  sortName: { pt: 'Nome (A–Z)', en: 'Name (A–Z)' },
  count: { pt: '{n} afixos', en: '{n} affixes' },
  none: { pt: 'Nenhum afixo com esses filtros.', en: 'No affix with these filters.' },
  clear: { pt: 'Limpar filtros', en: 'Clear filters' },
  rarity: { pt: 'Raridade', en: 'Rarity' },
  chance: { pt: 'Chance', en: 'Chance' },
  chanceHint: { pt: 'Peso do sorteio: quanto maior, mais comum.', en: 'Roll weight: the bigger, the more common.' },
  ringNote: {
    pt: 'A lista de anéis que recebemos traz só os prefixos dos tiers 1 a 3 e os sufixos do tier 4. Os demais ainda não estão aqui.',
    en: 'The ring list we received only has the tier 1–3 prefixes and the tier 4 suffixes. The rest is not here yet.',
  },
  noGauntletSuffix: { pt: 'Luvas não têm sufixos no Tier 4.', en: 'Gauntlets have no Tier 4 suffixes.' },
  tipsTitle: { pt: 'Dicas', en: 'Tips' },
  source: { pt: 'Tabelas da Season 11, como informadas ao site.', en: 'Season 11 tables, as given to the site.' },
} as const satisfies Record<string, L>;

const STONE_NAME: Record<'low' | 'average' | 'great' | 'perfect', L> = {
  low: { pt: 'Low-Tier', en: 'Low-Tier' }, average: { pt: 'Average-Tier', en: 'Average-Tier' },
  great: { pt: 'Great-Tier', en: 'Great-Tier' }, perfect: { pt: 'Perfect-Tier', en: 'Perfect-Tier' },
};

const STONE_ROLLS: Record<'low' | 'average' | 'great' | 'perfect', L> = {
  low: { pt: 'Todos os afixos do Tier 1 (0–59)', en: 'All Tier 1 affixes (0–59)' },
  average: { pt: 'Todos do Tier 2 (40–99), mais os do Tier 1 que chegam a 40–59', en: 'All Tier 2 (40–99), plus the Tier 1 ones reaching 40–59' },
  great: { pt: 'Todos do Tier 3 (60–112), mais os do Tier 2 que chegam a 80–99', en: 'All Tier 3 (60–112), plus the Tier 2 ones reaching 80–99' },
  perfect: { pt: 'Todos do Tier 4 (100–130), mais os do Tier 3 que chegam a 111–112', en: 'All Tier 4 (100–130), plus the Tier 3 ones reaching 111–112' },
};

const TIPS: L[] = [
  { pt: 'Reroll com estratégia: guarde os rerolls para itens de alto nível ou raros.', en: 'Strategic rerolling: save rerolls for high-end or rare items.' },
  { pt: 'Combine atributos: busque afixos que completem a sua build de classe.', en: 'Stat synergy: target affixes that complement your class build.' },
  { pt: 'Cuide dos recursos: essas pedras podem ser raras, use com cuidado.', en: 'Resource awareness: these stones can be rare, use them wisely.' },
];

const ITEM_NAME: Record<ItemType, { icon: string; name: L }> = {
  amulet: { icon: '📿', name: { pt: 'Amuletos', en: 'Amulets' } },
  boots: { icon: '👢', name: { pt: 'Botas', en: 'Boots' } },
  bracelet: { icon: '⌚', name: { pt: 'Braceletes', en: 'Bracelets' } },
  gauntlet: { icon: '🧤', name: { pt: 'Luvas', en: 'Gauntlets' } },
  ring: { icon: '💍', name: { pt: 'Anéis', en: 'Rings' } },
};

/** The names of the stats as the site shows them (the same in both languages, except Critical and Defense). */
const STAT_NAME: Record<StatKey, L> = {
  ATK: { pt: 'Attack Power', en: 'Attack Power' },
  AR: { pt: 'Attack Rating', en: 'Attack Rating' },
  Crit: { pt: 'Crítico', en: 'Critical' },
  Defense: { pt: 'Defensa', en: 'Defense' },
  Absorb: { pt: 'Absorb', en: 'Absorb' },
  Block: { pt: 'Block', en: 'Block' },
  HP: { pt: 'HP', en: 'HP' },
  MP: { pt: 'MP', en: 'MP' },
  'HP Regen': { pt: 'HP Regen', en: 'HP Regen' },
  'MP Regen': { pt: 'MP Regen', en: 'MP Regen' },
  'Move Speed': { pt: 'Move Speed', en: 'Move Speed' },
};

const MAX_WEIGHT = Math.max(...AFFIXES.map((a) => a.weight));
const fmt = (n: number) => String(n).replace('.', ',');
const range = (min: number, max: number) => (min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`);
const sub = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

const EMPTY: Query = { item: 'amulet', kind: 'all', level: null, stat: 'all', tier: 'all', text: '' };

function AffixRow({ a, stat, lang }: { a: Affix; stat: 'all' | StatKey; lang: 'pt' | 'en' }) {
  const b = bracket(a.tier);
  return (
    <li className="af-row">
      <div className="af-top">
        <b className="af-name">{a.name}</b>
        <span className={`af-tag ${a.kind}`}>{a.kind === 'prefix' ? TXT.prefix[lang] : TXT.suffix[lang]}</span>
        <span className="af-tag tier" title={`${TXT.rangeCol[lang]}: ${b.min}–${b.max}`}>Tier {a.tier} · {b.min}–{b.max}</span>
      </div>
      <div className="af-stats">
        {a.stats.map(([k, min, max]) => (
          <span key={k} className={`af-stat${stat === k ? ' hit' : ''}`}>{STAT_NAME[k][lang]} <b>+{range(min, max)}</b></span>
        ))}
      </div>
      <div className="af-meta">
        <span>{TXT.rarity[lang]} {a.rarity[0]}–{a.rarity[1]}</span>
        <span className="af-chance" title={TXT.chanceHint[lang]}>
          {TXT.chance[lang]} <b>{a.weight.toLocaleString('pt-BR')}</b>
          <i className="af-bar"><i style={{ width: `${(a.weight / MAX_WEIGHT) * 100}%` }} /></i>
        </span>
      </div>
    </li>
  );
}

export function AffixGuide() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [q, setQ] = useState<Query>(EMPTY);
  const [sort, setSort] = useState<SortMode>('tier');

  const patch = (p: Partial<Query>) => setQ((x) => ({ ...x, ...p }));
  const pickStat = (stat: 'all' | StatKey) => { patch({ stat }); setSort(stat === 'all' ? 'tier' : 'best'); };

  const list = useMemo(() => sortAffixes(filterAffixes(q), sort, q.stat), [q, sort]);
  const grouped = sort === 'tier';
  const dirty = q.kind !== 'all' || q.stat !== 'all' || q.tier !== 'all' || q.text !== '';
  const clear = () => { setQ((x) => ({ ...EMPTY, item: x.item })); setSort('tier'); };


  return (
    <div className="mk af">
      <h1 className="mk-h1">💎 {T('title')}</h1>
      <p className="mk-muted">{T('subtitle')}</p>

      <details className="sr-card af-how">
        <summary>{T('how')}</summary>
        <p>{T('howIntro')}</p>
        <table className="af-table">
          <thead><tr><th>{T('tierCol')}</th><th>{T('rangeCol')}</th></tr></thead>
          <tbody>{TIERS.map((t) => <tr key={t.tier}><td>Tier {t.tier}</td><td>{t.min}–{t.max}</td></tr>)}</tbody>
        </table>
        <p>{T('stonesIntro')}</p>
        <table className="af-table">
          <thead><tr><th>{T('stoneCol')}</th><th>{T('itemLevelCol')}</th><th>{T('eligibleCol')}</th></tr></thead>
          <tbody>{STONES.map((s) => <tr key={s.id}><td>{STONE_NAME[s.id][lang]}</td><td>{s.min}–{s.max}</td><td>{STONE_ROLLS[s.id][lang]}</td></tr>)}</tbody>
        </table>
        <p className="mk-muted">{T('example')}</p>
      </details>

      <section className="sr-card af-filters">
        <div className="af-field">
          <span className="af-label">{T('item')}</span>
          <div className="af-chips" role="group" aria-label={T('item')}>
            {ITEM_TYPES.map((it) => (
              <button key={it} type="button" className={`af-chip${q.item === it ? ' on' : ''}`} aria-pressed={q.item === it} onClick={() => patch({ item: it })}>
                <span className="af-ico">{ITEM_NAME[it].icon}</span> {ITEM_NAME[it].name[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="af-field">
          <span className="af-label">{T('kind')}</span>
          <div className="af-chips" role="group" aria-label={T('kind')}>
            {([['all', T('all')], ['prefix', T('prefix')], ['suffix', T('suffix')]] as const).map(([k, label]) => (
              <button key={k} type="button" className={`af-chip${q.kind === k ? ' on' : ''}`} aria-pressed={q.kind === k} onClick={() => patch({ kind: k })}>{label}</button>
            ))}
          </div>
        </div>

        <div className="af-field">
          <span className="af-label">{T('want')}</span>
          <div className="af-chips" role="group" aria-label={T('want')}>
            <button type="button" className={`af-chip${q.stat === 'all' ? ' on' : ''}`} aria-pressed={q.stat === 'all'} onClick={() => pickStat('all')}>{T('anything')}</button>
            {STAT_KEYS.map((s) => (
              <button key={s} type="button" className={`af-chip${q.stat === s ? ' on' : ''}`} aria-pressed={q.stat === s} onClick={() => pickStat(s)}>{STAT_NAME[s][lang]}</button>
            ))}
          </div>
        </div>

        <div className="af-row-fields">
          <label className="af-field af-small">
            <span className="af-label">{T('tier')}</span>
            <select value={String(q.tier)} onChange={(e) => patch({ tier: e.target.value === 'all' ? 'all' : (Number(e.target.value) as Tier) })}>
              <option value="all">{T('all')}</option>
              {TIERS.map((t) => <option key={t.tier} value={t.tier}>Tier {t.tier} ({t.min}–{t.max})</option>)}
            </select>
          </label>
          <label className="af-field af-grow">
            <span className="af-label">{T('search')}</span>
            <input type="search" value={q.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Marksman, Iron Skin…" />
          </label>
          <label className="af-field af-small">
            <span className="af-label">{T('sort')}</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
              <option value="best" disabled={q.stat === 'all'}>{T('sortBest')}</option>
              <option value="tier">{T('sortTier')}</option>
              <option value="common">{T('sortCommon')}</option>
              <option value="rare">{T('sortRare')}</option>
              <option value="name">{T('sortName')}</option>
            </select>
          </label>
        </div>

      </section>

      {q.item === 'ring' && <p className="mk-note af-note">{T('ringNote')}</p>}

      <div className="af-count">
        <b>{sub(TXT.count[lang], { n: list.length })}</b>
        {dirty && <button type="button" className="mk-btn sm" onClick={clear}>{T('clear')}</button>}
      </div>

      {list.length === 0 && <p className="mk-muted">{T('none')}</p>}

      {grouped ? (
        (['prefix', 'suffix'] as const).filter((k) => list.some((a) => a.kind === k)).map((k) => (
          <section key={k} className="af-group">
            <h2 className="af-h">{k === 'prefix' ? TXT.prefixes[lang] : TXT.suffixes[lang]}</h2>
            {([4, 3, 2, 1] as Tier[]).filter((t) => list.some((a) => a.kind === k && a.tier === t)).map((t) => (
              <div key={t}>
                <h3 className="af-tier">Tier {t} <small>({bracket(t).min}–{bracket(t).max})</small></h3>
                <ul className="af-list">{list.filter((a) => a.kind === k && a.tier === t).map((a) => <AffixRow key={`${a.kind}-${a.tier}-${a.name}`} a={a} stat={q.stat} lang={lang} />)}</ul>
              </div>
            ))}
          </section>
        ))
      ) : (
        <ul className="af-list">{list.map((a) => <AffixRow key={`${a.kind}-${a.tier}-${a.name}`} a={a} stat={q.stat} lang={lang} />)}</ul>
      )}

      {q.item === 'gauntlet' && q.kind !== 'prefix' && <p className="mk-muted">{T('noGauntletSuffix')}</p>}

      <section className="sr-card af-tips">
        <h2 className="mk-h2">💡 {T('tipsTitle')}</h2>
        <ul>{TIPS.map((t, i) => <li key={i}>{t[lang]}</li>)}</ul>
        <small className="mk-muted">{T('source')}</small>
      </section>
    </div>
  );
}
