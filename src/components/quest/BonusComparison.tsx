// Bonus simulation: the same quests with growing sets of bonuses, so the player sees what each one adds.
import { useI18n } from '../../lib/i18n';
import { compareBonusSets } from '../../lib/quest/bonus';
import type { Quest } from '../../lib/quest/types';
import { useQuest } from './QuestContext';
import { fmtExp, fmtPct } from './format';

const TXT = {
  title: { pt: 'Simulação de bônus', en: 'Bonus simulation' },
  set: { pt: 'Combinação', en: 'Combination' },
  none: { pt: 'Sem bônus', en: 'No bonuses' },
  total: { pt: 'EXP total', en: 'Total EXP' },
  vsNone: { pt: 'Diferença sem bônus', en: 'Difference vs. none' },
  vsPrev: { pt: 'Diferença da anterior', en: 'Difference vs. previous' },
  summary: { pt: 'Com os bônus selecionados, você receberá', en: 'With the selected bonuses you will receive' },
  extra: { pt: 'de EXP adicional ao entregar', en: 'of additional EXP when delivering' },
  noBonus: { pt: 'Ative algum bônus no painel acima para comparar.', en: 'Turn on a bonus in the panel above to compare.' },
  noQuests: { pt: 'Escolha ao menos uma quest com EXP cadastrada.', en: 'Pick at least one quest with registered EXP.' },
  quests: { pt: 'estas quests', en: 'these quests' },
  quest: { pt: 'esta quest', en: 'this quest' },
} as const;

export function BonusComparison({ quests }: { quests: Quest[] }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const { data, active, settings } = useQuest();
  if (!data || !active) return null;
  const usable = quests.filter((q) => q.baseExp !== null);
  if (usable.length === 0) return <p className="mk-muted">{T('noQuests')}</p>;
  const rows = compareBonusSets(usable, data.bonuses, active.bonuses, settings.combineMode, settings.rounding);
  if (rows.length <= 1) return <p className="mk-muted">{T('noBonus')}</p>;
  const all = rows[rows.length - 1];
  return (
    <div className="qt-compare">
      <h4>{T('title')}</h4>
      <div className="qt-scroll">
        <table className="ag-table qt-table">
          <thead><tr><th>{T('set')}</th><th>{T('total')}</th><th>{T('vsNone')}</th><th>{T('vsPrev')}</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === rows.length - 1 ? 'on' : ''}>
                <td>{i === 0 ? T('none') : r.names.join(' + ')}</td>
                <td><b>{fmtExp(r.total, lang)}</b></td>
                <td>{i === 0 ? '—' : `+${fmtExp(r.extraVsNone, lang)} (+${fmtPct(r.extraVsNonePct, lang)})`}</td>
                <td>{i === 0 ? '—' : `+${fmtExp(r.extraVsPrev, lang)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="qt-recommend">{T('summary')} <b>{fmtExp(all.extraVsNone, lang)}</b> {T('extra')} {usable.length === 1 ? T('quest') : T('quests')}.</p>
    </div>
  );
}
