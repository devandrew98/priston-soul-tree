// Aging cost calculator: pick an item, pick the aging range, see the sheltoms and gold it takes.
import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { AGE_CHANCES, effectiveSuccess } from '../../lib/aging/chances';
import {
  CATEGORIES, ITEMS, MAX_AGE, RARITIES, SHELTOMS, WEAPON_GROUPS, agingCost, hasRarity, priceFor, type Category, type Mats, type Rarity, type WeaponGroup,
} from '../../lib/aging/cost';

const TXT = {
  title: { pt: 'Calculadora de Aging', en: 'Aging Calculator' },
  intro: { pt: 'Escolha o item e o aging que deseja. Veja quantos sheltoms e quanto gold você vai gastar no jogo.', en: 'Pick the item and the aging you want. See how many sheltoms and how much gold it will cost you in game.' },
  category: { pt: 'Tipo', en: 'Type' },
  eventLabel: { pt: 'Evento de Age', en: 'Aging event' },
  eventPct: { pt: '% de desconto no gold', en: '% gold discount' },
  eventNote: { pt: 'O desconto vale só para o gold; os sheltoms continuam iguais.', en: 'The discount applies to gold only; sheltoms stay the same.' },
  withoutEvent: { pt: 'Sem o evento', en: 'Without the event' },
  rarity: { pt: 'Raridade', en: 'Rarity' },
  weaponType: { pt: 'Categoria da arma', en: 'Weapon category' },
  allWeapons: { pt: 'Todas', en: 'All' },
  item: { pt: 'Item', en: 'Item' },
  from: { pt: 'Aging atual', en: 'Current aging' },
  to: { pt: 'Aging desejado', en: 'Desired aging' },
  none: { pt: 'Nenhum item encontrado.', en: 'No items found.' },
  level: { pt: 'Nível', en: 'Level' },
  price: { pt: 'Preço do item', en: 'Item price' },
  formula: { pt: 'Gold de cada age (+N) = 12% do preço do item na raridade × 5 × N até o +10, e × 2,5 × N do +11 em diante (arredondado para baixo por nível). Vale para todos os tipos e raridades. Confirmado no jogo em +1, +9, +14, +21 e +22.', en: 'Gold of each aging (+N) = 12% of the item price in its rarity × 5 × N up to +10, and × 2.5 × N from +11 on (rounded down per level). Same for every type and rarity. Confirmed in game at +1, +9, +14, +21 and +22.' },
  chancesTitle: { pt: 'Chances do próximo age:', en: 'Chances of the next aging:' },
  age: { pt: 'Age', en: 'Aging' },
  sheltoms: { pt: 'Sheltoms', en: 'Sheltoms' },
  gold: { pt: 'Gold', en: 'Gold' },
  tries: { pt: 'Tentativas', en: 'Attempts' },
  success: { pt: 'Sucesso', en: 'Success' },
  failsLabel: { pt: 'Falhas seguidas', en: 'Failures in a row' },
  double: { pt: 'Aging duplo (+2) se der sucesso', en: 'Double aging (+2) on success' },
  fail: { pt: 'Falha', en: 'Failure' },
  brk: { pt: 'Quebra se falhar', en: 'Break on failure' },
  warnLabel: { pt: 'Atenção:', en: 'Warning:' },
  warnBefore: { pt: ' Neste nível de Aging, existe o risco de quebra do item.', en: ' At this Aging level there is a risk of the item breaking.' },
  warnUse: { pt: 'Utilize o ', en: 'Use ' },
  warnAfter: { pt: ' para evitar que o item seja destruído em caso de falha.', en: ' to prevent the item from being destroyed on failure.' },
  total: { pt: 'Total a gastar', en: 'Total to spend' },
  totalSheltoms: { pt: 'Sheltoms no total', en: 'Total sheltoms' },
  totalGold: { pt: 'Gold no total', en: 'Total gold' },
  pick: { pt: 'Escolha o aging desejado maior que o atual.', en: 'Choose a desired aging higher than the current one.' },
} as const;

const CAT_NAMES: Record<Category, { pt: string; en: string }> = {
  weapon: { pt: 'Armas', en: 'Weapons' },
  armor: { pt: 'Armaduras', en: 'Armors' },
  robe: { pt: 'Robes', en: 'Robes' },
  shield: { pt: 'Escudos', en: 'Shields' },
  orb: { pt: 'Orbs', en: 'Orbs' },
};
/** Age typed by the user: empty or invalid counts as 0, never above +22. */
const parseAge = (text: string) => Math.min(MAX_AGE, Number.parseInt(text, 10) || 0);
/** Keeps only digits (max +22) so the field can be emptied with backspace and retyped. */
const cleanAge = (v: string) => {
  const digits = v.replace(/\D/g, '').slice(0, 2);
  return digits !== '' && Number(digits) > MAX_AGE ? String(MAX_AGE) : digits;
};

const cleanPct = (v: string) => {
  const digits = v.replace(/\D/g, '').slice(0, 3);
  return digits !== '' && Number(digits) > 100 ? '100' : digits;
};

const GROUP_NAMES: Record<WeaponGroup, { pt: string; en: string }> = {
  axes: { pt: 'Axes', en: 'Axes' },
  swords: { pt: 'Espadas', en: 'Swords' },
  bow: { pt: 'Bow', en: 'Bow' },
  dagger: { pt: 'Dagger', en: 'Dagger' },
  hammer: { pt: 'Hammer', en: 'Hammer' },
  javelin: { pt: 'Javelin', en: 'Javelin' },
  mace: { pt: 'Mace', en: 'Mace' },
  phantom: { pt: 'Phantom', en: 'Phantom' },
  scythe: { pt: 'Scythe', en: 'Scythe' },
  wand: { pt: 'Wand/Staff', en: 'Wand/Staff' },
  talon: { pt: 'Talon', en: 'Talon' },
};
const RARITY_NAMES: Record<Rarity, { pt: string; en: string }> = {
  uncommon: { pt: 'Incomum', en: 'Uncommon' },
  rare: { pt: 'Raro', en: 'Rare' },
  epic: { pt: 'Épico', en: 'Epic' },
  legendary: { pt: 'Lendário', en: 'Legendary' },
};

const sheltomImg = (name: string) => `/aging/sheltoms/${name.toLowerCase()}.png`;

function MatList({ mats }: { mats: Mats }) {
  return (
    <ul className="ag-mats">
      {SHELTOMS.filter((s) => mats[s]).map((s) => (
        <li key={s} title={s}><img src={sheltomImg(s)} alt={s} width={32} height={32} loading="lazy" /><b>{mats[s]}×</b> <span>{s}</span></li>
      ))}
    </ul>
  );
}

export function AgingCalculator() {
  const { lang } = useI18n();
  const T = <K extends keyof typeof TXT>(k: K) => TXT[k][lang];
  const fmt = (n: number) => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

  const [category, setCategory] = useState<Category>('weapon');
  const [group, setGroup] = useState<WeaponGroup | 'all'>('all');
  const [rarity, setRarity] = useState<Rarity>('legendary');
  const [itemId, setItemId] = useState<number | null>(null);
  const [fromText, setFromText] = useState('0');
  const [toText, setToText] = useState('1');
  const from = parseAge(fromText);
  const to = parseAge(toText);
  const [eventOn, setEventOn] = useState(false);
  const [eventText, setEventText] = useState('50');
  const eventPct = eventOn ? Math.min(100, Number.parseInt(eventText, 10) || 0) : 0;

  const list = useMemo(() => {
    return ITEMS.filter((i) => i.category === category && (category !== 'weapon' || group === 'all' || i.weaponGroup === group) && hasRarity(i, rarity))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  }, [category, group, rarity]);
  const item = list.find((i) => i.id === itemId) ?? list[0] ?? null;
  const itemPrice = item ? priceFor(item, rarity) : 0;
  const nextAge = Math.min(MAX_AGE, from + 1);
  const nextChance = AGE_CHANCES[nextAge - 1];
  const [failsText, setFailsText] = useState('0');
  const fails = Math.min(99, Number.parseInt(failsText, 10) || 0);
  const success = effectiveSuccess(nextChance.success, fails);
  /** A new item means a new calculation: aging back to +0 -> +1 and no failures in a row. */
  /** Changing the current aging suggests the next one as the desired aging (the player can still edit it). */
  const changeFrom = (text: string) => {
    setFromText(text);
    if (text !== '') setToText(String(Math.min(MAX_AGE, parseAge(text) + 1)));
  };
  const resetCalc = () => { setFromText('0'); setToText('1'); setFailsText('0'); };
  const cost = item ? agingCost(itemPrice, from, to, {}, eventPct, item.level) : null;

  return (
    <div className="ag">
      <h1 className="mk-h1">⚒ {T('title')}</h1>
      <p className="ag-intro">{T('intro')}</p>

      <section className="sr-card ag-setup">
        <label className="mk-field ag-field"><span>{T('category')}</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value as Category); setItemId(null); resetCalc(); }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_NAMES[c][lang]}</option>)}
          </select>
        </label>
        <label className="mk-field ag-field"><span>{T('rarity')}</span>
          <select value={rarity} onChange={(e) => { setRarity(e.target.value as Rarity); setItemId(null); resetCalc(); }}>
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_NAMES[r][lang]}</option>)}
          </select>
        </label>
        {category === 'weapon' && (
          <label className="mk-field ag-field"><span>{T('weaponType')}</span>
            <select value={group} onChange={(e) => { setGroup(e.target.value as WeaponGroup | 'all'); setItemId(null); resetCalc(); }}>
              <option value="all">{T('allWeapons')}</option>
              {WEAPON_GROUPS.map((g) => <option key={g} value={g}>{GROUP_NAMES[g][lang]}</option>)}
            </select>
          </label>
        )}
        <label className="mk-field ag-field"><span>{T('item')} ({list.length})</span>
          <select value={item?.id ?? ''} onChange={(e) => { setItemId(Number(e.target.value)); resetCalc(); }} disabled={!list.length}>
            {list.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.level})</option>)}
          </select>
        </label>
      </section>

      <section className="sr-card ag-ages">
        <div className="ag-age">
          <span>{T('from')}</span>
          <div className="ag-stepper">
            <button type="button" aria-label="-1" disabled={from <= 0} onClick={() => changeFrom(String(Math.max(0, from - 1)))}>−</button>
            <input type="text" inputMode="numeric" autoComplete="off" aria-label={T('from')} value={fromText} placeholder="0"
              onFocus={(e) => e.target.select()} onChange={(e) => changeFrom(cleanAge(e.target.value))} onBlur={() => setFromText(String(from))} />
            <button type="button" aria-label="+1" disabled={from >= MAX_AGE} onClick={() => changeFrom(String(Math.min(MAX_AGE, from + 1)))}>+</button>
          </div>
        </div>
        <span className="ag-age-arrow" aria-hidden="true">→</span>
        <div className="ag-age">
          <span>{T('to')}</span>
          <div className="ag-stepper">
            <button type="button" aria-label="-1" disabled={to <= 0} onClick={() => setToText(String(Math.max(0, to - 1)))}>−</button>
            <input type="text" inputMode="numeric" autoComplete="off" aria-label={T('to')} value={toText} placeholder="22"
              onFocus={(e) => e.target.select()} onChange={(e) => setToText(cleanAge(e.target.value))} onBlur={() => setToText(String(to))} />
            <button type="button" aria-label="+1" disabled={to >= MAX_AGE} onClick={() => setToText(String(Math.min(MAX_AGE, to + 1)))}>+</button>
          </div>
        </div>
      </section>

      <section className="sr-card ag-event">
        <label className="ag-check">
          <input type="checkbox" checked={eventOn} onChange={(e) => setEventOn(e.target.checked)} /> <b>{T('eventLabel')}</b>
        </label>
        {eventOn && (
          <>
            <label className="ag-event-pct">
              <input type="text" inputMode="numeric" autoComplete="off" value={eventText} placeholder="50"
                onFocus={(e) => e.target.select()} onChange={(e) => setEventText(cleanPct(e.target.value))} onBlur={() => setEventText(String(Math.min(100, Number.parseInt(eventText, 10) || 0)))} />
              <span>{T('eventPct')}</span>
            </label>
            <small>{T('eventNote')}</small>
          </>
        )}
      </section>

      {!item && <p className="sk-notice">{T('none')}</p>}

      {item && (
        <section className="sr-card ag-item">
          <img src={`/aging/items/${item.id}.png`} alt={item.name} className="ag-item-img" />
          <div>
            <h3 className={`ag-name ag-rar-${rarity}`}>{item.name}</h3>
            <p>{RARITY_NAMES[rarity][lang]} · {T('level')} {item.level}</p>
            <p>{T('price')}: <b>{fmt(itemPrice)}</b></p>
          </div>
          {from < to && (
            <div className="ag-item-chances">
              <div className="ag-chances-head">
                <h4>{T('chancesTitle')} +{nextAge}</h4>
                <div className="ag-age ag-fails">
                  <span>{T('failsLabel')}</span>
                  <div className="ag-stepper">
                    <button type="button" aria-label="-1" disabled={fails <= 0} onClick={() => setFailsText(String(Math.max(0, fails - 1)))}>−</button>
                    <input type="text" inputMode="numeric" autoComplete="off" aria-label={T('failsLabel')} value={failsText} placeholder="0"
                      onFocus={(e) => e.target.select()} onChange={(e) => setFailsText(e.target.value.replace(/\D/g, '').slice(0, 2))} onBlur={() => setFailsText(String(fails))} />
                    <button type="button" aria-label="+1" disabled={fails >= 99} onClick={() => setFailsText(String(Math.min(99, fails + 1)))}>+</button>
                  </div>
                </div>
              </div>
              <div className="ag-next">
                <div className="ag-next-box ag-ok"><b>{success}%</b><span>{T('success')}{fails > 0 && ` (+${success - nextChance.success})`}</span></div>
                <div className="ag-next-box"><b>{nextChance.double}%</b><span>{T('double')}</span></div>
                <div className="ag-next-box"><b>{100 - success}%</b><span>{T('fail')}</span></div>
                <div className={`ag-next-box ${nextChance.breakPct > 0 ? 'ag-risk' : ''}`}><b>{nextChance.breakPct}%</b><span>{T('brk')}</span></div>
              </div>
              {to >= 9 && (
                <p className="ag-warning" role="alert"><b>{T('warnLabel')}</b>{T('warnBefore')}<br />{T('warnUse')}<b>Cooper Ore</b>{T('warnAfter')}</p>
              )}
            </div>
          )}
        </section>
      )}

      {item && cost && (cost.rows.length === 0 ? <p className="sk-notice">{T('pick')}</p> : (
        <>
          <section className="sr-card ag-total">
            <h3>{T('total')} (+{from} → +{to})</h3>
            <p>{T('totalGold')}: <b className="ag-gold">{fmt(cost.gold)}</b>{eventPct > 0 && <small className="ag-was"> ({T('withoutEvent')}: <s>{fmt(cost.fullGold)}</s>, −{eventPct}%)</small>}</p>
            <h4>{T('totalSheltoms')}</h4>
            <MatList mats={cost.mats} />
          </section>
        </>
      ))}
    </div>
  );
}
