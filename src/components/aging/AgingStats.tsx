// Item stats (optional part of the aging system): the player types the stats of his item and sees them after the desired aging.
// Item type, item level and the aging range come from the cost calculator above.
import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { STAT_KEYS, applyAging, type StatKey, type StatType, type Stats } from '../../lib/aging/bonuses';

const TXT = {
  base: { pt: 'Sem aging (+0)', en: 'No aging (+0)' },
  defPerfect: { pt: 'Defesa do item perfeito', en: 'Defense of the perfect item' },
  defPerfectHint: { pt: 'A maior defesa que esse item pode ter (o item perfeito).', en: 'The highest defense this item can have (the perfect item).' },
  perfectLow: { pt: 'A defesa do item perfeito não pode ser menor que a defesa do seu item.', en: 'The defense of the perfect item cannot be lower than the defense of your item.' },
  yourStats: { pt: 'Status do seu item (sem aging, +0)', en: 'Your item stats (no aging, +0)' },
  result: { pt: 'Status depois do aging', en: 'Stats after aging' },
  stat: { pt: 'Status', en: 'Stat' },
  gain: { pt: 'Ganho', en: 'Gain' },
  badLevel: { pt: 'Nível de item inválido.', en: 'Invalid item level.' },
  nothing: { pt: 'O aging desejado precisa ser igual ou maior que o atual.', en: 'The desired aging must be equal to or higher than the current one.' },
  fillStats: { pt: 'Preencha todos os campos do item para ver o resultado.', en: 'Fill in all the item fields to see the result.' },
  stats: {
    pt: { min: 'Ataque mínimo', max: 'Ataque máximo', rating: 'Attack Rating', crit: 'Crítico (%)', def: 'Defesa', absorb: 'Absorção', block: 'Bloqueio (%)' },
    en: { min: 'Min attack', max: 'Max attack', rating: 'Attack Rating', crit: 'Critical (%)', def: 'Defense', absorb: 'Absorb', block: 'Block (%)' },
  },
} as const;

/** Decimal typed by the player: accepts comma or dot, empty or invalid is 0. */
const parseNum = (t: string) => { const n = Number(t.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : 0; };
const cleanNum = (v: string) => v.replace(/[^\d.,]/g, '').slice(0, 12);

export function AgingStats({ type, itemLevel, from, to }: { type: StatType; itemLevel: number; from: number; to: number }) {
  const { lang } = useI18n();
  const T = <K extends 'yourStats' | 'result' | 'stat' | 'gain' | 'badLevel' | 'nothing' | 'fillStats' | 'base' | 'defPerfect' | 'defPerfectHint' | 'perfectLow'>(k: K) => TXT[k][lang];
  const statName = (k: StatKey) => TXT.stats[lang][k];
  const fmt = (n: number) => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 2 });

  const [values, setValues] = useState<Record<string, string>>({});
  const hasDef = STAT_KEYS[type].includes('def');

  const stats: Stats = Object.fromEntries(STAT_KEYS[type].map((k) => [k, parseNum(values[k] ?? '')]));
  if (hasDef) stats.defPerfect = parseNum(values.defPerfect ?? '');
  // Every field is required: the stats of the item and, for the ones with defense, the defense of the perfect item.
  const requiredKeys = [...STAT_KEYS[type], ...(hasDef ? ['defPerfect'] : [])];
  const complete = requiredKeys.every((k) => (values[k] ?? '').trim() !== '');
  const perfectLow = hasDef && complete && (stats.defPerfect ?? 0) < (stats.def ?? 0);
  // The stats typed are the item without aging (+0); the table shows it without aging, at the current and at the desired aging.
  const atTarget = applyAging(type, itemLevel, stats, 0, to);
  const atCurrent = applyAging(type, itemLevel, stats, 0, from);
  const rows = atTarget.ok && atCurrent.ok
    ? atTarget.rows.map((r, i) => ({ key: r.key, base: r.before, now: atCurrent.rows[i].after, after: r.after }))
    : [];

  return (
    <div>
      <section className="sr-card ag-stats-form">
        <h3>{T('yourStats')}</h3>
        <div className="ag-stats-grid">
          {STAT_KEYS[type].map((k) => (
            <label key={k} className="mk-field ag-field"><span>{statName(k)} *</span>
              <input type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={values[k] ?? ''} onFocus={(e) => e.target.select()}
                onChange={(e) => setValues({ ...values, [k]: cleanNum(e.target.value) })} />
            </label>
          ))}
        </div>
        {hasDef && (
          <label className="mk-field ag-field ag-perfect"><span>{T('defPerfect')} *</span>
            <input type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={values.defPerfect ?? ''} onFocus={(e) => e.target.select()}
              onChange={(e) => setValues({ ...values, defPerfect: cleanNum(e.target.value) })} />
            <small>{T('defPerfectHint')}</small>
          </label>
        )}
      </section>

      <section className="sr-card ag-stats-result">
        <h3>{T('result')} (+{from} → +{to})</h3>
        {!atTarget.ok ? <p className="ag-warning" role="alert">{T('badLevel')}</p>
          : to < from ? <p className="sk-notice">{T('nothing')}</p>
          : !complete ? <p className="sk-notice">{T('fillStats')}</p>
          : perfectLow ? <p className="ag-warning" role="alert">{T('perfectLow')}</p>
          : (
            <table className="ag-table ag-stats-table">
              <thead>
                <tr>
                  <th>{T('stat')}</th>
                  {from > 0 && <th>{T('base')}</th>}
                  <th>+{from}</th>
                  <th className="ag-th-target">+{to}</th>
                  <th>{T('gain')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>{statName(r.key)}</td>
                    {from > 0 && <td>{fmt(r.base)}</td>}
                    <td>{fmt(r.now)}</td>
                    <td className="ag-gold-sm">{fmt(r.after)}</td>
                    <td className="ag-ok">+{fmt(Math.round((r.after - r.now) * 100) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
    </div>
  );
}
