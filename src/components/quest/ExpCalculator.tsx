// EXP Calculator: what one quest gives with the active bonuses, where the character ends up after delivering it, and how far
// the character must level BEFORE delivering to reach a chosen level. A simulation never changes the real character.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { questInfo, visibleQuests } from '../../lib/quest/availability';
import { questReward } from '../../lib/quest/bonus';
import { expToPercent, pctToState, statePct, type ExpState } from '../../lib/quest/exp';
import { questGroup } from '../../lib/quest/groups';
import { groupQuests } from '../../lib/quest/mapGroups';
import { deliver, planGoal } from '../../lib/quest/planner';
import type { Quest } from '../../lib/quest/types';
import { BonusComparison } from './BonusComparison';
import { useQuest } from './QuestContext';
import { fmtExp, fmtPct, fmtPos, parseDecimal } from './format';

const TXT = {
  pick: { pt: 'Quest', en: 'Quest' },
  choose: { pt: 'Escolha uma quest…', en: 'Pick a quest…' },
  noQuests: { pt: 'Ainda não há quests cadastradas.', en: 'There are no quests yet.' },
  sim: { pt: 'Simular a partir de outro level/EXP (não altera seu personagem)', en: 'Simulate from another level/EXP (does not change your character)' },
  simLevel: { pt: 'Level simulado', en: 'Simulated level' },
  simPct: { pt: 'EXP simulada (%)', en: 'Simulated EXP (%)' },
  real: { pt: 'Usando o level e a EXP reais do personagem.', en: 'Using the real level and EXP of the character.' },
  simulating: { pt: 'Simulação', en: 'Simulation' },
  current: { pt: 'Posição atual', en: 'Current position' },
  breakdown: { pt: 'Recompensa', en: 'Reward' },
  baseExp: { pt: 'EXP base da quest', en: 'Quest base EXP' },
  bonusesApplied: { pt: 'Bônus aplicados', en: 'Bonuses applied' },
  noBonus: { pt: 'nenhum', en: 'none' },
  extra: { pt: 'EXP adicional dos bônus', en: 'Extra EXP from bonuses' },
  finalExp: { pt: 'EXP total recebida', en: 'Total EXP received' },
  ofLevel: { pt: 'do level', en: 'of level' },
  capped: { pt: 'A recompensa foi limitada pela regra de limite por quest (configurada pelo administrador).', en: 'The reward was limited by the per-quest limit rule (set by the administrator).' },
  after: { pt: 'Depois de entregar agora', en: 'After delivering now' },
  finalLevel: { pt: 'Level final', en: 'Final level' },
  remaining: { pt: 'Restante no level final', en: 'Left in the final level' },
  levelsGained: { pt: 'Levels ganhos', en: 'Levels gained' },
  noBase: { pt: 'Esta quest ainda não tem EXP base cadastrada, então não dá para calcular.', en: 'This quest has no base EXP registered yet, so it cannot be calculated.' },
  reverse: { pt: 'Quanto evoluir antes de entregar', en: 'How much to level before delivering' },
  goalLevel: { pt: 'Level desejado', en: 'Desired level' },
  goalPct: { pt: 'com EXP (%)', en: 'with EXP (%)' },
  missingTable: { pt: 'Faltam dados na tabela de EXP (level', en: 'The EXP table is missing data (level' },
  missingTail: { pt: ') para concluir este cálculo. Nada foi estimado.', en: ') to finish this calculation. Nothing was estimated.' },
  unreachable: { pt: 'Não é possível chegar a esse objetivo com esta quest:', en: 'This goal cannot be reached with this quest:' },
  enough: { pt: 'Você já tem EXP suficiente: entregar agora leva você ao objetivo.', en: 'You already have enough EXP: delivering now takes you to the goal.' },
  surplus: { pt: 'Sobram', en: 'Left over' },
  surplusTail: { pt: 'de EXP acima do objetivo depois da entrega.', en: 'of EXP above the goal after delivering.' },
  evolve: { pt: 'Evolua até', en: 'Level up to' },
  beforeDeliver: { pt: 'antes de entregar esta quest para alcançar', en: 'before delivering this quest to reach' },
  stillNeed: { pt: 'Você ainda precisa ganhar', en: 'You still need to earn' },
  pp: { pt: 'pontos percentuais de EXP', en: 'percentage points of EXP' },
  exp: { pt: 'de EXP', en: 'of EXP' },
  crossing: { pt: 'Isso passa por mais de um level, por isso o valor é dado em EXP.', en: 'This crosses more than one level, so the amount is given in EXP.' },
  alreadyPast: { pt: 'O personagem já está no objetivo ou além dele.', en: 'The character is already at or past the goal.' },
  statuses: {
    pt: { locked: 'Bloqueada', available: 'Disponível', in_progress: 'Em andamento', ready: 'Pronta', completed: 'Concluída' },
    en: { locked: 'Locked', available: 'Available', in_progress: 'In progress', ready: 'Ready', completed: 'Completed' },
  },
} as const;
type Tk = Exclude<keyof typeof TXT, 'statuses'>;

export function ExpCalculator() {
  const { lang } = useI18n();
  const T = (k: Tk) => TXT[k][lang];
  const { data, active, plan, table, start, calcQuestId, setCalcQuestId, now } = useQuest();
  const [sim, setSim] = useState(false);
  const [simLevel, setSimLevel] = useState('');
  const [simPct, setSimPct] = useState('0');
  const [goalLevel, setGoalLevel] = useState('');
  const [goalPct, setGoalPct] = useState('0');

  const startLevel = sim ? Number(simLevel) || (active?.level ?? 1) : active?.level ?? 1;
  // Default goal: the next level at 0%.
  useEffect(() => { setGoalLevel(String(startLevel + 1)); }, [startLevel, calcQuestId]);

  const list = useMemo(() => {
    if (!data || !active) return [];
    const order = { ready: 0, in_progress: 1, available: 2, locked: 3, completed: 4 } as const;
    return visibleQuests(data.quests)
      .map((quest) => ({ quest, status: questInfo(quest, active, now).status }))
      .sort((a, b) => order[a.status] - order[b.status] || a.quest.name.localeCompare(b.quest.name));
  }, [data, active, now]);

  // the quest picker: by map (highest level first), then the boss hunts, then the solo quests; the quests that give no EXP come last
  const pickGroups = useMemo(() => {
    const exp = (r: (typeof list)[number]) => r.quest.baseExp ?? -1;
    const named = (rows: typeof list, prefix: string) => groupQuests(rows, (r) => r.quest, exp).map((g) => ({ label: `${prefix}${g.map}`, items: g.items }));
    return [
      ...named(list.filter((r) => questGroup(r.quest) === 'leveling'), ''),
      ...named(list.filter((r) => questGroup(r.quest) === 'other'), 'Sem EXP · '),
    ];
  }, [list]);

  if (!data || !active || !plan || !table) return null;
  const quest: Quest | undefined = data.quests.find((x) => x.id === calcQuestId);

  const simPctNum = parseDecimal(simPct);
  const from: ExpState | null = sim
    ? (Number.isFinite(simPctNum) && simPctNum >= 0 && simPctNum < 100 ? pctToState(table, startLevel, simPctNum) : null)
    : start;
  const lvlWord = lang === 'pt' ? 'Level' : 'Level';
  const reward = quest ? questReward(quest, data.bonuses, active.bonuses, plan.settings.combineMode, plan.settings.rounding) : null;
  const need = from ? table.needed(from.level) : null;

  const delivery = quest && from && reward ? deliver(plan, from, quest) : null;
  const goalLvlNum = Number(goalLevel);
  const goalPctNum = parseDecimal(goalPct);
  const goalOk = Number.isInteger(goalLvlNum) && goalLvlNum >= 1 && Number.isFinite(goalPctNum) && goalPctNum >= 0 && goalPctNum < 100;
  const goal = quest && from && reward && goalOk
    ? planGoal(plan, from, [quest], { level: goalLvlNum, pct: goalPctNum }, new Set(Object.keys(active.progress).filter((id) => (active.progress[id].deliveries.length > 0))))
    : null;

  const reverseMessage = () => {
    if (!goal || !from) return null;
    if (goal.status === 'missing_data') return <p className="sk-notice">{T('missingTable')} {goal.missingLevel}{T('missingTail')}</p>;
    if (goal.status === 'unreachable') return <p className="ag-warning" role="alert">{T('unreachable')} {goal.blockedReason}</p>;
    if (goal.needed === 0 && goal.surplus === 0 && goal.preGain === 0 && comparePast(goal, from)) return <p className="mk-muted">{T('alreadyPast')}</p>;
    if (goal.alreadyEnough) {
      return (
        <div className="qt-result ok">
          <p><b>{T('enough')}</b></p>
          {goal.surplus !== null && goal.surplus > 0 && goal.final && <p>{T('surplus')} <b>{fmtExp(goal.surplus, lang)}</b> {T('surplusTail')}</p>}
        </div>
      );
    }
    const pre = goal.preState;
    const prePct = statePct(table, pre);
    const sameLevel = pre.level === from.level;
    const startPct = statePct(table, from);
    return (
      <div className="qt-result">
        <p className="qt-recommend">
          {T('evolve')} <b>{prePct === null ? `${lvlWord} ${pre.level}` : `${fmtPct(prePct, lang)}${sameLevel ? '' : ` (${lvlWord} ${pre.level})`}`}</b> {T('beforeDeliver')} <b>{lvlWord} {goalLvlNum}{goalPctNum > 0 ? ` · ${fmtPct(goalPctNum, lang)}` : ''}</b>.
        </p>
        <p>
          {T('stillNeed')}{' '}
          {sameLevel && prePct !== null && startPct !== null ? <><b>{fmtPct(prePct - startPct, lang).replace('%', '')}</b> {T('pp')} ({fmtExp(goal.preGain, lang)} EXP)</> : <><b>{fmtExp(goal.preGain, lang)}</b> {T('exp')}</>}.
          {!sameLevel && <small className="mk-muted"> {T('crossing')}</small>}
        </p>
        {goal.surplus !== null && goal.surplus > 0 && <p className="mk-muted">{T('surplus')} {fmtExp(goal.surplus, lang)} {T('surplusTail')}</p>}
      </div>
    );
  };

  return (
    <div className="qt-section">
      <section className="sr-card cl-box">
        <label className="mk-field qt-f qt-wide"><span>{T('pick')}</span>
          <select value={calcQuestId ?? ''} onChange={(e) => setCalcQuestId(e.target.value || null)}>
            <option value="">{T('choose')}</option>
            {pickGroups.map((g) => (
              <optgroup key={g.label} label={`${g.label} (${g.items.length})`}>
                {g.items.map(({ quest: x, status }) => <option key={x.id} value={x.id}>{x.name} · {TXT.statuses[lang][status]}{x.baseExp === null ? ' · —' : ''}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {list.length === 0 && <p className="sk-notice">{T('noQuests')}</p>}

        <label className="qt-check qt-sim">
          <input type="checkbox" checked={sim} onChange={(e) => { setSim(e.target.checked); if (e.target.checked) setSimLevel(String(active.level)); }} /> <span>{T('sim')}</span>
        </label>
        {sim && (
          <div className="qt-profile-row">
            <label className="mk-field qt-f"><span>{T('simLevel')}</span><input type="text" inputMode="numeric" value={simLevel} onChange={(e) => setSimLevel(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
            <label className="mk-field qt-f"><span>{T('simPct')}</span><input type="text" inputMode="decimal" value={simPct} onChange={(e) => setSimPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))} /></label>
          </div>
        )}
        <p className="mk-muted">{sim ? <b>{T('simulating')}: </b> : null}{from ? <>{T('current')}: <b>{fmtPos(table, from, lang, lvlWord)}</b></> : T('real')}</p>
      </section>

      {quest && (
        <section className="sr-card cl-box">
          <h3>{quest.name} <small>· {quest.id}</small></h3>
          {!reward ? <p className="sk-notice">{T('noBase')}</p> : (
            <>
              <h4>{T('breakdown')}</h4>
              <table className="ag-table qt-table">
                <tbody>
                  <tr><td>{T('baseExp')}</td><td><b>{fmtExp(reward.base, lang)}</b></td></tr>
                  <tr><td>{T('bonusesApplied')}</td><td>{reward.applied.length === 0 ? T('noBonus') : reward.applied.map((b) => `${b.name} (+${fmtPct(b.percent, lang)})`).join(', ')}</td></tr>
                  <tr><td>{T('extra')}</td><td>+{fmtExp(reward.extra, lang)}</td></tr>
                  <tr className="on"><td>{T('finalExp')}</td><td><b>{fmtExp(reward.total, lang)}</b>{need !== null && <small className="mk-muted"> · {fmtPct(expToPercent(reward.total, need), lang)} {T('ofLevel')} {from?.level}</small>}</td></tr>
                </tbody>
              </table>

              {delivery && (
                <>
                  <h4>{T('after')}</h4>
                  {delivery.capped && <p className="sk-notice">{T('capped')}</p>}
                  {!delivery.complete ? <p className="sk-notice">{T('missingTable')} {delivery.missingLevel}{T('missingTail')}</p> : (
                    <>
                      <p className="qt-big">{fmtPos(table, delivery.state, lang, lvlWord)}</p>
                      <p className="mk-muted">{T('levelsGained')}: {delivery.state.level - (from?.level ?? 0)} · {T('remaining')}: {fmtPct(statePct(table, delivery.state) ?? 0, lang)}</p>
                      <div className="qt-bar"><i style={{ width: `${Math.min(100, statePct(table, delivery.state) ?? 0)}%` }} /></div>
                    </>
                  )}
                </>
              )}

              <h4>{T('reverse')}</h4>
              <div className="qt-profile-row">
                <label className="mk-field qt-f"><span>{T('goalLevel')}</span><input type="text" inputMode="numeric" value={goalLevel} onChange={(e) => setGoalLevel(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
                <label className="mk-field qt-f"><span>{T('goalPct')}</span><input type="text" inputMode="decimal" value={goalPct} onChange={(e) => setGoalPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))} /></label>
              </div>
              {reverseMessage()}
              <BonusComparison quests={[quest]} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

/** True when the goal is behind the starting position (nothing to earn). */
function comparePast(goal: { targetState: ExpState | null }, from: ExpState): boolean {
  const t = goal.targetState;
  return !!t && (t.level < from.level || (t.level === from.level && t.exp <= from.exp));
}
