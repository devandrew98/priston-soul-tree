// Leveling Planner: pick several quests, choose the goal (a level and a percentage of it) and see how much EXP is still needed
// before delivering, the best delivery order and the progress after each quest. A simulation never changes the real character.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { availableList, unlockedBetween } from '../../lib/quest/availability';
import { questReward } from '../../lib/quest/bonus';
import { expBetween, expToPercent, statePct, type ExpState } from '../../lib/quest/exp';
import { encodePlan, tokenFor } from '../../lib/quest/checklist';
import { groupQuests } from '../../lib/quest/mapGroups';
import { deliveredIds, planGoal, type PlanResult } from '../../lib/quest/planner';
import type { Quest, SavedPlan } from '../../lib/quest/types';
import { BonusComparison } from './BonusComparison';
import { useQuest } from './QuestContext';
import { fmtExp, fmtPct, fmtPos, parseDecimal } from './format';

const TXT = {
  goal: { pt: 'Objetivo', en: 'Goal' },
  goalLevel: { pt: 'Level desejado', en: 'Desired level' },
  goalPct: { pt: 'com EXP (%)', en: 'with EXP (%)' },
  presets: { pt: 'Atalhos', en: 'Shortcuts' },
  starting: { pt: 'Ponto de partida', en: 'Starting point' },
  pickQuests: { pt: 'Quests no planejamento', en: 'Quests in the plan' },
  empty: { pt: 'Nenhuma quest selecionada. Escolha abaixo (prontas primeiro) ou use "Adicionar ao planejador" no Banco de Quests.', en: 'No quest selected. Pick below (ready ones first) or use "Add to planner" in the Quest Database.' },
  remove: { pt: 'Remover', en: 'Remove' },
  clearAll: { pt: 'Limpar seleção', en: 'Clear selection' },
  readyQuests: { pt: 'Prontas para entregar', en: 'Ready to deliver' },
  availableQuests: { pt: 'Disponíveis', en: 'Available' },
  addAllReady: { pt: 'Adicionar todas as prontas', en: 'Add all ready' },
  noExp: { pt: 'sem EXP cadastrada', en: 'no EXP registered' },
  result: { pt: 'Resultado', en: 'Result' },
  totalBase: { pt: 'EXP base das quests', en: 'Quests base EXP' },
  totalExtra: { pt: 'EXP adicional dos bônus', en: 'Extra EXP from bonuses' },
  totalFinal: { pt: 'EXP total das quests', en: 'Quests total EXP' },
  needed: { pt: 'EXP do ponto de partida até o objetivo', en: 'EXP from the starting point to the goal' },
  preGain: { pt: 'EXP ainda a ganhar upando (antes de entregar)', en: 'EXP still to earn by levelling (before delivering)' },
  finalPos: { pt: 'Posição final estimada', en: 'Estimated final position' },
  levelLeft: { pt: 'EXP restante no level final', en: 'EXP left in the final level' },
  recommend: { pt: 'Ganhe mais', en: 'Earn' },
  recommendTail: { pt: 'de EXP antes de entregar suas quests para atingir', en: 'more EXP before delivering your quests to reach' },
  enough: { pt: 'As quests selecionadas já bastam: entregue agora para atingir', en: 'The selected quests are enough: deliver now to reach' },
  surplus: { pt: 'Sobram', en: 'Left over' },
  surplusTail: { pt: 'de EXP acima do objetivo.', en: 'of EXP above the goal.' },
  noQuestsPlan: { pt: 'Sem quests, todo o caminho até o objetivo é de upar:', en: 'Without quests the whole way to the goal is levelling:' },
  missing: { pt: 'Faltam dados na tabela de EXP (level', en: 'The EXP table is missing data (level' },
  missingTail: { pt: ') para concluir o cálculo. Nada foi estimado.', en: ') to finish the calculation. Nothing was estimated.' },
  unreachable: { pt: 'Não é possível chegar a esse objetivo com as quests selecionadas:', en: 'This goal cannot be reached with the selected quests:' },
  skipped: { pt: 'Ficaram de fora dos cálculos (sem EXP base cadastrada):', en: 'Left out of the calculations (no base EXP registered):' },
  order: { pt: 'Ordem de entrega', en: 'Delivery order' },
  allEqual: { pt: 'Todas as sequências válidas produzem a mesma EXP final (testadas', en: 'Every valid sequence gives the same final EXP (tested' },
  seq: { pt: 'sequências', en: 'sequences' },
  better: { pt: 'A ordem abaixo é melhor: termina com', en: 'The order below is better: it ends with' },
  betterTail: { pt: 'de EXP a mais que a pior sequência testada', en: 'more EXP than the worst sequence tested' },
  heuristic: { pt: 'Muitas quests: foi usada uma ordem razoável (pré-requisitos e level), sem testar todas as combinações.', en: 'Many quests: one reasonable order was used (prerequisites and level), without trying every combination.' },
  step: { pt: 'Evolução após cada entrega', en: 'Progress after each delivery' },
  afterLeveling: { pt: 'Depois de upar', en: 'After levelling' },
  toPhone: { pt: '📱 Levar para o celular', en: '📱 Take it to your phone' },
  phoneHint: { pt: 'Abra o link no celular (ou mande para si mesmo) para ir marcando as quests conforme faz. Suas marcações ficam salvas no aparelho. Também dá para mandar o link para o grupo.', en: 'Open the link on your phone (or send it to yourself) to tick the quests off as you do them. Your ticks stay on that device. You can also send the link to your group.' },
  openNow: { pt: 'Abrir agora', en: 'Open now' },
  share: { pt: 'Compartilhar', en: 'Share' },
  ofLevel: { pt: 'do level', en: 'of the level' },
  openChecklist: { pt: '🔗 Abrir checklist', en: '🔗 Open checklist' },
  copyChecklist: { pt: '📋 Copiar link do checklist', en: '📋 Copy checklist link' },
  copied: { pt: 'Link copiado!', en: 'Link copied!' },
  checklistHint: { pt: 'Uma página à parte, com link, para ir marcando as quests conforme faz. Pode mandar o link para o grupo.', en: 'A separate page, with a link, to tick the quests off as you do them. You can send the link to your group.' },
  capped: { pt: 'limitada pela regra de limite por quest', en: 'limited by the per-quest limit rule' },
  unlocks: { pt: 'Quests que serão desbloqueadas ao subir de level', en: 'Quests unlocked by levelling up' },
  unlocksNote: { pt: 'Não contam como prontas para entrega nem como concluídas.', en: 'They do not count as ready to deliver nor as completed.' },
  needsPre: { pt: 'precisa de pré-requisito', en: 'needs a prerequisite' },
  savePlan: { pt: 'Salvar planejamento', en: 'Save plan' },
  planName: { pt: 'Nome do planejamento', en: 'Plan name' },
  saved: { pt: 'Planejamentos salvos', en: 'Saved plans' },
  noSaved: { pt: 'Nenhum planejamento salvo.', en: 'No saved plans.' },
  load: { pt: 'Carregar', en: 'Load' },
  recalc: { pt: 'Recalcular e salvar', en: 'Recalculate and save' },
  del: { pt: 'Excluir', en: 'Delete' },
  outdated: { pt: 'Os dados oficiais mudaram desde o último cálculo: os resultados precisam ser atualizados.', en: 'The official data changed since the last calculation: the results must be updated.' },
  missingQuests: { pt: 'quest(s) deste planejamento não existem mais', en: 'quest(s) of this plan no longer exist' },
  quests: { pt: 'quests', en: 'quests' },
  to: { pt: 'até', en: 'to' },
  preRequired: { pt: 'Quests com pré-requisito dentro da seleção são entregues depois dele.', en: 'Quests with a prerequisite inside the selection are delivered after it.' },
} as const;
type Tk = keyof typeof TXT;

export function LevelingPlanner() {
  const { lang } = useI18n();
  const T = (k: Tk) => TXT[k][lang];
  const { data, active, plan, table, start, plannerIds, setPlannerIds, togglePlanner, update, settings, now } = useQuest();
  const [goalLevel, setGoalLevel] = useState('');
  const [goalPct, setGoalPct] = useState('0');
  const [planName, setPlanName] = useState('');
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState(false);
  const lvlWord = 'Level';

  const startLevel = active?.level ?? 1;
  useEffect(() => { setGoalLevel((g) => (g === '' ? String(startLevel + 1) : g)); }, [startLevel]);

  const questsById = useMemo(() => new Map((data?.quests ?? []).map((q) => [q.id, q])), [data]);
  const selected = useMemo(() => plannerIds.map((id) => questsById.get(id)).filter((q): q is Quest => !!q), [plannerIds, questsById]);
  const pickable = useMemo(() => (data && active ? availableList(data.quests, active, now) : []), [data, active, now]);

  const from: ExpState | null = !table || !active ? null : start;
  const goalLvlNum = Number(goalLevel);
  const goalPctNum = parseDecimal(goalPct);
  const goalOk = Number.isInteger(goalLvlNum) && goalLvlNum >= 1 && Number.isFinite(goalPctNum) && goalPctNum >= 0 && goalPctNum < 100;

  const result: PlanResult | null = useMemo(() => {
    if (!plan || !active || !from || !goalOk) return null;
    return planGoal(plan, from, selected, { level: goalLvlNum, pct: goalPctNum }, deliveredIds(active.progress));
  }, [plan, active, from, goalOk, selected, goalLvlNum, goalPctNum]);

  if (!data || !active || !plan || !table) return null;
  const needNow = table.needed(active.level);
  const rewardOf = (q: Quest) => questReward(q, data.bonuses, active.bonuses, settings.combineMode, settings.rounding);
  // only quests that give EXP (they are the ones that matter for leveling)
  const givesExp = pickable.filter((p) => (p.quest.baseExp ?? 0) > 0);
  const readyList = givesExp.filter((p) => p.info.status === 'ready');
  const otherList = givesExp.filter((p) => p.info.status !== 'ready');
  // by map (highest-level map first) and, inside each map, the most EXP first
  const byMap = (list: typeof givesExp) => groupQuests(list, (p) => p.quest, (p) => rewardOf(p.quest)?.total ?? -1);
  const pickGroups = (list: typeof givesExp) => byMap(list).map((g) => (
    <div key={g.map} className="qt-pick-map"><h5>{g.map} <small>· {g.items.length}</small></h5>{g.items.map(pickRow)}</div>
  ));

  const pickRow = ({ quest }: { quest: Quest }) => {
    const r = rewardOf(quest);
    return (
      <label key={quest.id} className="qt-pick">
        <input type="checkbox" checked={plannerIds.includes(quest.id)} onChange={() => togglePlanner(quest.id)} />
        <span>{quest.name}</span>
        <small className="mk-muted">{r ? fmtExp(r.total, lang) : T('noExp')}</small>
      </label>
    );
  };

  // the plan as a link to the checklist page: the quests in the order of delivery
  const checklistLink = () => {
    const ids = result && result.steps.length ? result.steps.map((x) => x.quest.id) : selected.map((x) => x.id);
    const allIds = data.quests.map((x) => x.id);
    const pre = result && result.preGain > 0 ? { pl: result.preState.level, pp: Math.round((statePct(table, result.preState) ?? 0) * 100) / 100 } : {};
    return `/checklist#p=${encodePlan({ v: 2, n: planName.trim() || `${lvlWord} ${goalLvlNum}`, lv: goalLvlNum, pct: goalPctNum, q: ids.map((id) => tokenFor(id, allIds)), ...pre })}`;
  };

  const resultView = () => {
    if (!result) return null;
    if (result.status === 'missing_data') return <p className="sk-notice">{T('missing')} {result.missingLevel}{T('missingTail')}</p>;
    if (result.status === 'unreachable') return <p className="ag-warning" role="alert">{T('unreachable')} {result.blockedReason}</p>;
    const goalText = `${lvlWord} ${goalLvlNum}${goalPctNum > 0 ? ` · ${fmtPct(goalPctNum, lang)}` : ''}`;
    const best = result.final;
    const orderDiff = best && result.worstFinal && table ? expBetween(table, result.worstFinal, best) : null;
    return (
      <div className="qt-result">
        {selected.length === 0 ? (
          <p className="qt-recommend">{T('noQuestsPlan')} <b>{fmtExp(result.preGain, lang)}</b> EXP.</p>
        ) : result.alreadyEnough ? (
          <p className="qt-recommend ok">{T('enough')} <b>{goalText}</b>.</p>
        ) : (
          <p className="qt-recommend">{T('recommend')} <b>{fmtExp(result.preGain, lang)}</b> {T('recommendTail')} <b>{goalText}</b>.</p>
        )}
        {result.surplus !== null && result.surplus > 0 && selected.length > 0 && <p className="mk-muted">{T('surplus')} {fmtExp(result.surplus, lang)} {T('surplusTail')}</p>}

        <div className="qt-cards">
          <div><small>{T('totalBase')}</small><b>{fmtExp(result.totalBase, lang)}</b></div>
          <div><small>{T('totalExtra')}</small><b>+{fmtExp(result.totalExtra, lang)}</b></div>
          <div><small>{T('totalFinal')}</small><b>{fmtExp(result.totalFinal, lang)}</b></div>
          <div><small>{T('needed')}</small><b>{result.needed === null ? '—' : fmtExp(result.needed, lang)}</b></div>
          <div><small>{T('preGain')}</small><b>{fmtExp(result.preGain, lang)}</b></div>
          <div><small>{T('finalPos')}</small><b>{best ? fmtPos(table, best, lang, lvlWord) : '—'}</b></div>
        </div>

        {result.skipped.length > 0 && <p className="sk-notice">{T('skipped')} {result.skipped.map((q) => q.name).join(', ')}</p>}

        {selected.length > 0 && (
          <>
            <h4>{T('order')}</h4>
            {!result.orders.exhaustive ? <p className="mk-muted">{T('heuristic')}</p>
              : result.orders.allEqual ? <p className="mk-muted">{T('allEqual')} {result.orders.tested} {T('seq')}).</p>
              : orderDiff !== null && orderDiff > 0 ? <p className="mk-muted">{T('better')} <b>{fmtExp(orderDiff, lang)}</b> {T('betterTail')} ({result.orders.valid} {T('seq')}).</p> : null}
            <p className="mk-muted">{T('preRequired')}</p>
            <h4>{T('step')}</h4>
            <ol className="qt-steps">
              {result.preGain > 0 && (
                <li><span>{T('afterLeveling')}</span><b>{fmtPos(table, result.preState, lang, lvlWord)}</b>
                  <div className="qt-bar"><i style={{ width: `${Math.min(100, statePct(table, result.preState) ?? 0)}%` }} /></div></li>
              )}
              {result.steps.map((s) => (
                <li key={s.quest.id}>
                  <span>{s.quest.name} <small className="mk-muted">+{fmtExp(s.gain, lang)}{s.capped ? ` (${T('capped')})` : ''}</small></span>
                  <b>{fmtPos(table, s.after, lang, lvlWord)}</b>
                  <div className="qt-bar"><i style={{ width: `${Math.min(100, statePct(table, s.after) ?? 0)}%` }} /></div>
                </li>
              ))}
            </ol>
            <div className="qt-phone">
              <button type="button" className="mk-btn primary" aria-expanded={phone} onClick={() => setPhone(!phone)}>{T('toPhone')}</button>
              {phone && (
                <div className="qt-phone-box">
                  <p className="mk-muted">{T('phoneHint')}</p>
                  <input readOnly value={window.location.origin + checklistLink()} onFocus={(e) => e.target.select()} aria-label={T('toPhone')} />
                  <div className="qt-actions">
                    <button type="button" className="mk-btn" onClick={() => { void navigator.clipboard?.writeText(window.location.origin + checklistLink()); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? T('copied') : T('copyChecklist')}</button>
                    {typeof navigator.share === 'function' && <button type="button" className="mk-btn" onClick={() => { void navigator.share({ title: 'Checklist de leveling', url: window.location.origin + checklistLink() }).catch(() => {}); }}>{T('share')}</button>}
                    <a className="mk-btn" href={checklistLink()} target="_blank" rel="noopener">{T('openNow')}</a>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {best && best.level > from!.level && (() => {
          const up = unlockedBetween(data.quests, active, from!.level, best.level);
          return up.length === 0 ? null : (
            <>
              <h4>{T('unlocks')}</h4>
              <p className="mk-muted">{T('unlocksNote')}</p>
              <ul className="qt-unlocks">{up.map((u) => <li key={u.quest.id}>{lvlWord} {u.level}: <b>{u.quest.name}</b>{u.needsPrerequisite ? <small className="mk-muted"> · {T('needsPre')}</small> : ''}</li>)}</ul>
            </>
          );
        })()}
        <BonusComparison quests={selected} />
      </div>
    );
  };

  const savePlan = () => {
    if (!result || result.status === 'missing_data' || selected.length === 0) return;
    const p: SavedPlan = {
      id: crypto.randomUUID(), name: planName.trim() || `${lvlWord} ${goalLvlNum}`, questIds: selected.map((q) => q.id), target: { level: goalLvlNum, pct: goalPctNum },
      dataVersion: settings.dataVersion, createdAt: Date.now(),
      summary: result.final ? { finalLevel: result.final.level, finalPct: statePct(table, result.final) ?? 0, preGainExp: result.preGain } : null,
    };
    update((c) => ({ plans: [...c.plans, p].slice(-50) }));
    setPlanName('');
  };
  const loadPlan = (p: SavedPlan) => { setPlannerIds(p.questIds.filter((id) => questsById.has(id))); setGoalLevel(String(p.target.level)); setGoalPct(String(p.target.pct)); };
  const recalcPlan = (p: SavedPlan) => {
    const qs = p.questIds.map((id) => questsById.get(id)).filter((q): q is Quest => !!q);
    const base = start;
    const r = base ? planGoal(plan, base, qs, p.target, deliveredIds(active.progress)) : null;
    update((c) => ({ plans: c.plans.map((x) => (x.id === p.id ? { ...x, questIds: qs.map((q) => q.id), dataVersion: settings.dataVersion, summary: r?.final ? { finalLevel: r.final.level, finalPct: statePct(table, r.final) ?? 0, preGainExp: r.preGain } : null } : x)) }));
  };

  return (
    <div className="qt-section">
      <section className="sr-card cl-box">
        <h3>{T('goal')}</h3>
        <div className="qt-profile-row">
          <label className="mk-field qt-f"><span>{T('goalLevel')}</span><input type="text" inputMode="numeric" value={goalLevel} onChange={(e) => setGoalLevel(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
          <label className="mk-field qt-f"><span>{T('goalPct')}</span><input type="text" inputMode="decimal" value={goalPct} onChange={(e) => setGoalPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 10))} /></label>
          <div className="qt-presets" role="group" aria-label={T('presets')}>
            <button type="button" className="mk-btn" onClick={() => setGoalLevel(String((Number(goalLevel) || startLevel) + 1))}>{lvlWord} +1</button>
          </div>
        </div>
        <p className="mk-muted">{T('starting')}: <b>{from ? fmtPos(table, from, lang, lvlWord) : '—'}</b> {T('to')} <b>{lvlWord} {goalLevel || '—'}{goalPctNum > 0 ? ` · ${fmtPct(goalPctNum, lang)}` : ''}</b></p>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('pickQuests')} <small>· {selected.length}</small></h3>
        {selected.length === 0 ? <p className="mk-muted">{T('empty')}</p> : (
          <ul className="qt-selected">
            {selected.map((q) => { const r = rewardOf(q); return (
              <li key={q.id}><b>{q.name}</b> <small className="mk-muted">{r ? `${r.extra > 0 ? `${fmtExp(r.base, lang)} + ${fmtExp(r.extra, lang)} = ` : ''}${fmtExp(r.total, lang)}${needNow ? ` · ${fmtPct(expToPercent(r.total, needNow), lang)} ${T('ofLevel')} ${active.level}` : ''}` : T('noExp')}</small>
                <button type="button" className="mk-btn" onClick={() => togglePlanner(q.id)} aria-label={T('remove')}>✕</button></li>
            ); })}
          </ul>
        )}
        {selected.length > 0 && <button type="button" className="mk-btn" onClick={() => setPlannerIds([])}>{T('clearAll')}</button>}
        <div className="qt-picklist">
          <div>
            <h4>{T('readyQuests')} <small>· {readyList.length}</small> {readyList.length > 0 && <button type="button" className="mk-btn" onClick={() => setPlannerIds([...new Set([...plannerIds, ...readyList.map((r) => r.quest.id)])])}>{T('addAllReady')}</button>}</h4>
            {pickGroups(readyList)}
          </div>
          <div>
            <h4>{T('availableQuests')} <small>· {otherList.length}</small></h4>
            <div className="qt-picklist-scroll">{pickGroups(otherList)}</div>
          </div>
        </div>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('result')}</h3>
        {resultView()}
        {result && result.status === 'ok' && selected.length > 0 && (
          <div className="cl-form">
            <input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder={T('planName')} maxLength={60} aria-label={T('planName')} />
            <button type="button" className="mk-btn primary" onClick={savePlan}>💾 {T('savePlan')}</button>
          </div>
        )}
      </section>

      <section className="sr-card cl-box">
        <h3>{T('saved')}</h3>
        {active.plans.length === 0 ? <p className="mk-muted">{T('noSaved')}</p> : (
          <ul className="qt-plans">
            {active.plans.map((p) => {
              const stale = p.dataVersion !== settings.dataVersion;
              const missingCount = p.questIds.filter((id) => !questsById.has(id)).length;
              return (
                <li key={p.id} className={stale ? 'stale' : ''}>
                  <div><b>{p.name}</b> <small className="mk-muted">· {p.questIds.length} {T('quests')} · {lvlWord} {p.target.level}{p.target.pct > 0 ? ` ${fmtPct(p.target.pct, lang)}` : ''}{p.summary ? ` · ${fmtPos(table, { level: p.summary.finalLevel, exp: 0 }, lang, lvlWord).split(' · ')[0]} ${fmtPct(p.summary.finalPct, lang)}` : ''}</small></div>
                  {stale && <p className="qt-stale">⚠ {T('outdated')}</p>}
                  {missingCount > 0 && <p className="qt-stale">⚠ {missingCount} {T('missingQuests')}</p>}
                  <div className="qt-actions">
                    <button type="button" className="mk-btn" onClick={() => loadPlan(p)}>{T('load')}</button>
                    <button type="button" className={`mk-btn${stale ? ' primary' : ''}`} onClick={() => recalcPlan(p)}>{T('recalc')}</button>
                    <button type="button" className="mk-btn cl-danger" onClick={() => update((c) => ({ plans: c.plans.filter((x) => x.id !== p.id) }))}>{T('del')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
