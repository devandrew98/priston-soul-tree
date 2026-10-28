// Item comparison: two items side by side, each in the rarity of your choice, with the perfect (best roll) stats.
import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { RARITIES, WEAPON_GROUPS, type Rarity, type WeaponGroup } from '../../lib/aging/cost';
import {
  COMPARE_CATEGORIES, COMPARE_ITEMS, MAX_AGE, compareHasRarity, compareItems, type CompareCategory, type CompareItem, type StatKey,
} from '../../lib/aging/compare';

const TXT = {
  title: { pt: 'Comparar itens', en: 'Compare items' },
  intro: { pt: 'Escolha dois itens e veja lado a lado os atributos perfeitos (melhor valor possível de cada um), na raridade que você quiser.', en: 'Pick two items and see their perfect stats (best possible value of each) side by side, in the rarity you want.' },
  category: { pt: 'Tipo', en: 'Type' },
  rarity: { pt: 'Raridade', en: 'Rarity' },
  weaponType: { pt: 'Categoria da arma', en: 'Weapon category' },
  allWeapons: { pt: 'Todas', en: 'All' },
  item: { pt: 'Item', en: 'Item' },
  age: { pt: 'Aging', en: 'Aging' },
  level: { pt: 'Nível', en: 'Level' },
  none: { pt: 'Nenhum item encontrado.', en: 'No items found.' },
  stat: { pt: 'Atributo', en: 'Stat' },
  diff: { pt: 'Diferença', en: 'Difference' },
  note: { pt: 'Valores perfeitos da database do pristontale.eu: o maior número de cada faixa, já com o bônus da raridade escolhida e o aging de +0 até o escolhido (o ganho de crítico por aging é estimado nos levels intermediários). Orb e Shield não entram porque os dados deles no site estão errados.', en: 'Perfect values from the pristontale.eu database: the highest number of each range, with the bonus of the chosen rarity and the aging from +0 up to the chosen one (the critical gain per aging is estimated at the in-between levels). Orbs and shields are left out because their data on the site is wrong.' },
} as const;

const CAT_NAMES: Record<CompareCategory, { pt: string; en: string }> = {
  weapon: { pt: 'Armas', en: 'Weapons' },
  armor: { pt: 'Armaduras', en: 'Armors' },
  robe: { pt: 'Robes', en: 'Robes' },
};
const RARITY_NAMES: Record<Rarity, { pt: string; en: string }> = {
  uncommon: { pt: 'Incomum', en: 'Uncommon' },
  rare: { pt: 'Raro', en: 'Rare' },
  epic: { pt: 'Épico', en: 'Epic' },
  legendary: { pt: 'Lendário', en: 'Legendary' },
};
const GROUP_NAMES: Record<WeaponGroup, { pt: string; en: string }> = {
  axes: { pt: 'Axes', en: 'Axes' }, swords: { pt: 'Espadas', en: 'Swords' }, bow: { pt: 'Bow', en: 'Bow' }, dagger: { pt: 'Dagger', en: 'Dagger' },
  hammer: { pt: 'Hammer', en: 'Hammer' }, javelin: { pt: 'Javelin', en: 'Javelin' }, mace: { pt: 'Mace', en: 'Mace' }, phantom: { pt: 'Phantom', en: 'Phantom' },
  scythe: { pt: 'Scythe', en: 'Scythe' }, wand: { pt: 'Wand/Staff', en: 'Wand/Staff' }, talon: { pt: 'Talon', en: 'Talon' },
};
const STAT_NAMES: Record<StatKey, { pt: string; en: string }> = {
  dmin: { pt: 'Dano mínimo', en: 'Minimum damage' },
  dmax: { pt: 'Dano máximo', en: 'Maximum damage' },
  crit: { pt: 'Crítico', en: 'Critical' },
  atr: { pt: 'Attack Rating', en: 'Attack Rating' },
  def: { pt: 'Defesa', en: 'Defense' },
  abs: { pt: 'Absorção', en: 'Absorption' },
};

interface Side { rarity: Rarity; group: WeaponGroup | 'all'; itemId: number | null; age: number }
const START: Side = { rarity: 'legendary', group: 'all', itemId: null, age: 0 };
const clampAge = (n: number) => Math.max(0, Math.min(MAX_AGE, n));

export function ItemCompare() {
  const { lang } = useI18n();
  const T = <K extends keyof typeof TXT>(k: K) => TXT[k][lang];
  const locale = lang === 'pt' ? 'pt-BR' : 'en-US';
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const fmtDiff = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));

  const [category, setCategory] = useState<CompareCategory>('weapon');
  const [a, setA] = useState<Side>(START);
  const [b, setB] = useState<Side>(START);

  const listFor = (s: Side): CompareItem[] => COMPARE_ITEMS
    .filter((i) => i.category === category && (category !== 'weapon' || s.group === 'all' || i.weaponGroup === s.group) && compareHasRarity(i, s.rarity))
    .sort((x, y) => y.level - x.level || x.name.localeCompare(y.name));
  const listA = useMemo(() => listFor(a), [category, a.group, a.rarity]); // eslint-disable-line react-hooks/exhaustive-deps
  const listB = useMemo(() => listFor(b), [category, b.group, b.rarity]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemA = listA.find((i) => i.id === a.itemId) ?? listA[0] ?? null;
  // The second item starts on the second entry so the table is not a comparison of an item with itself.
  const itemB = listB.find((i) => i.id === b.itemId) ?? listB[b.itemId === null && listB.length > 1 ? 1 : 0] ?? null;
  const rows = itemA && itemB ? compareItems({ item: itemA, rarity: a.rarity, age: a.age }, { item: itemB, rarity: b.rarity, age: b.age }) : [];

  // Changing the type clears the item and the group but keeps the rarity and the aging the player chose.
  const changeCategory = (c: CompareCategory) => { setCategory(c); setA({ ...a, group: 'all', itemId: null }); setB({ ...b, group: 'all', itemId: null }); };

  const panel = (label: 'A' | 'B', s: Side, set: (s: Side) => void, list: CompareItem[], item: CompareItem | null) => (
    <section className="sr-card ag-cmp-side">
      {category === 'weapon' && (
        <label className="mk-field ag-field"><span>{T('weaponType')}</span>
          <select value={s.group} onChange={(e) => set({ ...s, group: e.target.value as WeaponGroup | 'all', itemId: null })}>
            <option value="all">{T('allWeapons')}</option>
            {WEAPON_GROUPS.map((g) => <option key={g} value={g}>{GROUP_NAMES[g][lang]}</option>)}
          </select>
        </label>
      )}
      <div className="ag-cmp-row">
        <label className="mk-field ag-field"><span>{T('item')} ({list.length})</span>
          <select value={item?.id ?? ''} onChange={(e) => set({ ...s, itemId: Number(e.target.value) })} disabled={!list.length}>
            {list.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.level})</option>)}
          </select>
        </label>
        <label className="mk-field ag-field"><span>{T('rarity')}</span>
          <select value={s.rarity} onChange={(e) => set({ ...s, rarity: e.target.value as Rarity, itemId: null })}>
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_NAMES[r][lang]}</option>)}
          </select>
        </label>
      </div>
      <div className="ag-age">
        <span>{T('age')}</span>
        <div className="ag-stepper">
          <button type="button" aria-label="-1" disabled={s.age <= 0} onClick={() => set({ ...s, age: clampAge(s.age - 1) })}>−</button>
          <input type="text" inputMode="numeric" autoComplete="off" aria-label={`${T('age')} ${label}`} value={s.age} placeholder="0"
            onFocus={(e) => e.target.select()} onChange={(e) => set({ ...s, age: clampAge(Number.parseInt(e.target.value.replace(/D/g, '').slice(0, 2), 10) || 0) })} />
          <button type="button" aria-label="+1" disabled={s.age >= MAX_AGE} onClick={() => set({ ...s, age: clampAge(s.age + 1) })}>+</button>
        </div>
      </div>
      {item ? (
        <div className="ag-cmp-item">
          <img src={`/aging/items/${item.id}.png`} alt={item.name} className="ag-item-img" />
          <div>
            <h4 className={`ag-name ag-rar-${s.rarity}`}>{item.name}</h4>
            <p>{RARITY_NAMES[s.rarity][lang]} · {T('level')} {item.level}{s.age > 0 && <b className="ag-gold-sm"> · +{s.age}</b>}</p>
          </div>
        </div>
      ) : <p className="sk-notice">{T('none')}</p>}
    </section>
  );

  return (
    <div className="ag">
      <h1 className="mk-h1">⚖ {T('title')}</h1>
      <p className="ag-intro">{T('intro')}</p>

      <section className="sr-card ag-setup">
        <label className="mk-field ag-field"><span>{T('category')}</span>
          <select value={category} onChange={(e) => changeCategory(e.target.value as CompareCategory)}>
            {COMPARE_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_NAMES[c][lang]}</option>)}
          </select>
        </label>
      </section>

      <div className="ag-cmp-sides">
        {panel('A', a, setA, listA, itemA)}
        {panel('B', b, setB, listB, itemB)}
      </div>

      {itemA && itemB && (
        <section className="sr-card">
          <div className="qt-scroll ag-cmp-table-wrap">
            <table className="ag-table ag-cmp-table">
              <thead>
                <tr>
                  <th>{T('stat')}</th>
                  <th className={`ag-rar-${a.rarity}`}>{itemA.name}{a.age > 0 && ` +${a.age}`}</th>
                  <th className={`ag-rar-${b.rarity}`}>{itemB.name}{b.age > 0 && ` +${b.age}`}</th>
                  <th>{T('diff')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{STAT_NAMES[r.key][lang]}</td>
                    <td className={r.better === 'a' ? 'ag-cmp-win' : ''}>{fmt(r.a)}</td>
                    <td className={r.better === 'b' ? 'ag-cmp-win' : ''}>{fmt(r.b)}</td>
                    <td className={r.diff > 0 ? 'ag-cmp-pos' : r.diff < 0 ? 'ag-cmp-neg' : ''}>{r.diff === 0 ? '=' : fmtDiff(r.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="mk-muted">{T('note')}</small>
        </section>
      )}
    </div>
  );
}
