// Quest Database: the quests the character can do now (default), with filters, progress control and the "My Ready Quests" section.
import { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { questInfo, visibleQuests, type StatusInfo } from '../../lib/quest/availability';
import { questReward } from '../../lib/quest/bonus';
import { expToPercent } from '../../lib/quest/exp';
import type { Quest, QuestCategory, QuestStatus } from '../../lib/quest/types';
import { useQuest } from './QuestContext';
import { fmtExp, fmtPct } from './format';
import { questGroup, type QuestGroup } from '../../lib/quest/groups';
import { currentSoloId, isSolo } from '../../lib/quest/solo';

const TXT = {
  groups: { pt: { leveling: 'Leveling (dão EXP)', other: 'Outras (sem EXP)' }, en: { leveling: 'Leveling (give EXP)', other: 'Other (no EXP)' } },
  ready: { pt: 'Minhas Quests Prontas', en: 'My Ready Quests' },
  readyHint: { pt: 'Quests prontas para entregar. Adicione ao Planejador de Leveling para planejar a entrega.', en: 'Quests ready to deliver. Add them to the Leveling Planner to plan the delivery.' },
  noReady: { pt: 'Nenhuma quest marcada como pronta para entregar.', en: 'No quest marked as ready to deliver.' },
  search: { pt: 'Pesquisar por nome ou ID', en: 'Search by name or ID' },
  category: { pt: 'Categoria', en: 'Category' },
  map: { pt: 'Mapa', en: 'Map' },
  level: { pt: 'Level', en: 'Level' },
  status: { pt: 'Status', en: 'Status' },
  all: { pt: 'Todos', en: 'All' },
  allF: { pt: 'Todas', en: 'All' },
  views: {
    pt: { default: 'Disponíveis agora', in_progress: 'Em andamento', ready: 'Prontas para entregar', completed: 'Histórico (concluídas)', locked: 'Bloqueadas / de nível maior', all: 'Todas' },
    en: { default: 'Available now', in_progress: 'In progress', ready: 'Ready to deliver', completed: 'History (completed)', locked: 'Locked / higher level', all: 'All' },
  },
  statusName: {
    pt: { locked: 'Bloqueada', available: 'Disponível', in_progress: 'Em andamento', ready: 'Pronta para entregar', completed: 'Concluída' },
    en: { locked: 'Locked', available: 'Available', in_progress: 'In progress', ready: 'Ready to deliver', completed: 'Completed' },
  },
  baseExp: { pt: 'EXP base', en: 'Base EXP' },
  finalExp: { pt: 'EXP final', en: 'Final EXP' },
  ofLevel: { pt: 'do level', en: 'of the level' },
  noExp: { pt: 'EXP não cadastrada', en: 'EXP not registered' },
  noTable: { pt: 'sem tabela do level', en: 'no level table' },
  start: { pt: 'Iniciar', en: 'Start' },
  markReady: { pt: 'Marcar como pronta', en: 'Mark as ready' },
  deliver: { pt: 'Entregar (concluir)', en: 'Deliver (complete)' },
  cancel: { pt: 'Cancelar andamento', en: 'Cancel progress' },
  back: { pt: 'Voltar para em andamento', en: 'Back to in progress' },
  undo: { pt: 'Desfazer a última entrega', en: 'Undo the last delivery' },
  calc: { pt: 'Calcular', en: 'Calculate' },
  addPlan: { pt: 'Adicionar ao planejador', en: 'Add to planner' },
  inPlan: { pt: 'No planejador', en: 'In planner' },
  details: { pt: 'Detalhes', en: 'Details' },
  deliveries: { pt: 'Entregas', en: 'Deliveries' },
  next: { pt: 'Nova execução a partir de', en: 'Available again from' },
  reasonMin: { pt: 'level mínimo', en: 'minimum level' },
  reasonMax: { pt: 'level máximo ultrapassado', en: 'maximum level exceeded' },
  reasonPre: { pt: 'pré-requisito pendente', en: 'prerequisite missing' },
  objectives: { pt: 'Objetivos', en: 'Objectives' },
  prereq: { pt: 'Pré-requisitos', en: 'Prerequisites' },
  repeat: { pt: 'Repetição', en: 'Repetition' },
  repeatNames: {
    pt: { once: 'Única', repeatable: 'Repetível', daily: 'Diária (24 h)', interval: 'A cada' },
    en: { once: 'Once', repeatable: 'Repeatable', daily: 'Daily (24 h)', interval: 'Every' },
  },
  hours: { pt: 'horas', en: 'hours' },
  npc: { pt: 'NPC', en: 'NPC' },
  none: { pt: 'Nenhuma quest para esses filtros.', en: 'No quests for these filters.' },
  noQuests: { pt: 'Ainda não há quests cadastradas.', en: 'There are no quests yet.' },
  more: { pt: 'Mostrar mais', en: 'Show more' },
  hiddenNote: { pt: 'Quests de level maior ficam ocultas até você chegar lá (veja em "Bloqueadas / de nível maior").', en: 'Higher-level quests stay hidden until you get there (see "Locked / higher level").' },
  count: { pt: 'quests', en: 'quests' },
} as const;
type Tk = Exclude<keyof typeof TXT, 'views' | 'statusName' | 'repeatNames' | 'groups'>;
type View = keyof (typeof TXT)['views']['pt'];

const PAGE = 60;

export function QuestDatabase() {
  const { lang } = useI18n();
  const T = (k: Tk) => TXT[k][lang];
  const { data, active, plan, table, setQuestState, setCalcQuestId, setTab, plannerIds, togglePlanner, now } = useQuest();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [map, setMap] = useState('all');
  const [lvl, setLvl] = useState('');
  const [group, setGroup] = useState<QuestGroup>('leveling');
  const [view, setView] = useState<View>('default');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const quests = useMemo(() => (data ? visibleQuests(data.quests) : []), [data]);
  const rows = useMemo(() => (active ? quests.map((quest) => ({ quest, info: questInfo(quest, active, now) })) : []), [quests, active, now]);
  const maps = useMemo(() => [...new Set(quests.map((x) => x.map).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [quests]);
  const catOf = (id: string): QuestCategory | undefined => data?.categories.find((c) => c.id === id);

  if (!data || !active || !plan) return null;
  const rewardOf = (quest: Quest) => questReward(quest, data.bonuses, active.bonuses, plan.settings.combineMode, plan.settings.rounding);
  const need = table?.needed(active.level) ?? null;
  const pctOfLevel = (exp: number) => (need === null ? null : expToPercent(exp, need));

  const readyRows = rows.filter((r) => r.info.status === 'ready');
  const lvNum = Number(lvl);
  const matchesView = (s: QuestStatus) => view === 'all' || (view === 'default' ? s === 'available' || s === 'in_progress' || s === 'ready' : s === view);
  // everything the filters allow, except the group tab (so the tab numbers match the list they open)
  const soloNow = currentSoloId(quests, active.level);
  const passes = ({ quest, info }: (typeof rows)[number]) => {
    if (!matchesView(info.status)) return false;
    // available list: only the solo quest of the current level (older ones stay visible if already started)
    if (view === 'default' && isSolo(quest) && quest.id !== soloNow && info.status === 'available') return false;
    if (cat !== 'all' && quest.categoryId !== cat) return false;
    if (map !== 'all' && quest.map !== map) return false;
    if (lvl.trim() !== '' && Number.isFinite(lvNum) && ((quest.minLevel !== null && lvNum < quest.minLevel) || (quest.maxLevel !== null && lvNum > quest.maxLevel))) return false;
    const text = q.trim().toLowerCase();
    return !text || quest.name.toLowerCase().includes(text) || quest.id.toLowerCase().includes(text);
  };
  const inFilters = rows.filter(passes);
  // the quests that give the most EXP come first
  const expOf = (quest: Quest) => rewardOf(quest)?.total ?? -1;
  const filtered = inFilters.filter((r) => questGroup(r.quest) === group).sort((a, b) => expOf(b.quest) - expOf(a.quest) || a.quest.name.localeCompare(b.quest.name));

  const reasonText = (info: StatusInfo, quest: Quest) => info.reasons.map((r) => (r === 'level_min' ? `${T('reasonMin')} ${quest.minLevel}` : r === 'level_max' ? T('reasonMax') : T('reasonPre'))).join(' · ');
  const catChip = (id: string) => <span className="qt-chip" style={catOf(id)?.color ? { borderColor: catOf(id)!.color, color: catOf(id)!.color } : undefined}>{catOf(id)?.name ?? id}</span>;
  const expCells = (quest: Quest) => {
    const r = rewardOf(quest);
    if (!r) return <span className="mk-muted">{T('noExp')}</span>;
    const p = pctOfLevel(r.total);
    return (
      <span className="qt-exp">
        <b>{fmtExp(r.total, lang)}</b>
        {r.extra > 0 && <small> ({fmtExp(r.base, lang)} + {fmtExp(r.extra, lang)})</small>}
        <small className="mk-muted"> · {p === null ? T('noTable') : `${fmtPct(p, lang)} ${T('ofLevel')} ${active.level}`}</small>
      </span>
    );
  };
  const planBtn = (quest: Quest) => (
    <button type="button" className={`mk-btn${plannerIds.includes(quest.id) ? ' primary' : ''}`} onClick={() => togglePlanner(quest.id)}>
      {plannerIds.includes(quest.id) ? `✔ ${T('inPlan')}` : `➕ ${T('addPlan')}`}
    </button>
  );
  const actions = (quest: Quest, info: StatusInfo) => (
    <div className="qt-actions">
      {info.status === 'available' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'start')}>{T('start')}</button>}
      {info.status === 'available' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'ready')}>{T('markReady')}</button>}
      {info.status === 'in_progress' && <button type="button" className="mk-btn primary" onClick={() => setQuestState(quest.id, 'ready')}>{T('markReady')}</button>}
      {info.status === 'in_progress' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'reset')}>{T('cancel')}</button>}
      {info.status === 'ready' && <button type="button" className="mk-btn primary" onClick={() => setQuestState(quest.id, 'deliver')}>{T('deliver')}</button>}
      {info.status === 'ready' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'start')}>{T('back')}</button>}
      {info.status === 'completed' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'undo')}>{T('undo')}</button>}
      {info.status !== 'locked' && info.status !== 'completed' && <button type="button" className="mk-btn" onClick={() => { setCalcQuestId(quest.id); setTab('calculator'); }}>🧮 {T('calc')}</button>}
      {info.status !== 'locked' && info.status !== 'completed' && planBtn(quest)}
    </div>
  );

  return (
    <div className="qt-section">
      <section className="sr-card cl-box">
        <h3>✅ {T('ready')} <small>· {readyRows.length}</small></h3>
        <p className="mk-muted">{T('readyHint')}</p>
        {readyRows.length === 0 ? <p className="mk-muted">{T('noReady')}</p> : (
          <div className="qt-scroll">
            <table className="ag-table qt-table">
              <thead><tr><th>{T('ready').split(' ')[0] === 'My' ? 'Quest' : 'Quest'}</th><th>{T('category')}</th><th>{T('baseExp')}</th><th>{T('finalExp')}</th><th>%</th><th /></tr></thead>
              <tbody>
                {readyRows.map(({ quest }) => {
                  const r = rewardOf(quest);
                  const p = r ? pctOfLevel(r.total) : null;
                  return (
                    <tr key={quest.id}>
                      <td><b>{quest.name}</b> <small className="mk-muted">{quest.id}</small></td>
                      <td>{catChip(quest.categoryId)}</td>
                      <td>{r ? fmtExp(r.base, lang) : '—'}</td>
                      <td>{r ? fmtExp(r.total, lang) : '—'}</td>
                      <td>{p === null ? '—' : fmtPct(p, lang)}</td>
                      <td>{planBtn(quest)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card cl-box">
        <div className="mk-subtabs" role="group" aria-label="Grupo">
          {(Object.keys(TXT.groups[lang]) as QuestGroup[]).map((g) => (
            <button key={g} type="button" className={`mk-subtab${group === g ? ' active' : ''}`} aria-pressed={group === g} onClick={() => { setGroup(g); setLimit(PAGE); }}>
              {TXT.groups[lang][g]} · {inFilters.filter((r) => questGroup(r.quest) === g).length}
            </button>
          ))}
        </div>
        <div className="qt-filters">
          <input className="qt-search" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder={T('search')} aria-label={T('search')} />
          <label className="mk-field qt-f"><span>{T('status')}</span>
            <select value={view} onChange={(e) => { setView(e.target.value as View); setLimit(PAGE); }}>
              {(Object.keys(TXT.views[lang]) as View[]).map((v) => <option key={v} value={v}>{TXT.views[lang][v]}</option>)}
            </select>
          </label>
          <label className="mk-field qt-f"><span>{T('category')}</span>
            <select value={cat} onChange={(e) => { setCat(e.target.value); setLimit(PAGE); }}>
              <option value="all">{T('allF')}</option>
              {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="mk-field qt-f"><span>{T('map')}</span>
            <select value={map} onChange={(e) => { setMap(e.target.value); setLimit(PAGE); }}>
              <option value="all">{T('all')}</option>
              {maps.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="mk-field qt-f qt-f-sm"><span>{T('level')}</span>
            <input type="text" inputMode="numeric" value={lvl} placeholder="—" onChange={(e) => { setLvl(e.target.value.replace(/\D/g, '').slice(0, 3)); setLimit(PAGE); }} />
          </label>
        </div>
        {view === 'default' && <p className="mk-muted qt-note">{T('hiddenNote')}</p>}
        <p className="mk-muted">{filtered.length} {T('count')}</p>

        {quests.length === 0 ? <p className="sk-notice">{T('noQuests')}</p> : filtered.length === 0 ? <p className="sk-notice">{T('none')}</p> : (
          <ul className="qt-list">
            {filtered.slice(0, limit).map(({ quest, info }) => (
              <li key={quest.id} className={`qt-quest st-${info.status}`}>
                <div className="qt-quest-head">
                  <div className="qt-quest-title">
                    <b>{quest.name}</b> <small className="mk-muted">{quest.id}</small>
                    <div>{catChip(quest.categoryId)} <span className={`qt-pill st-${info.status}`}>{TXT.statusName[lang][info.status]}</span>
                      <small className="mk-muted"> · {T('level')} {quest.minLevel ?? '—'}{quest.maxLevel !== null ? `–${quest.maxLevel}` : '+'}{quest.map ? ` · ${quest.map}` : ''}{quest.npc ? ` · ${T('npc')} ${quest.npc}` : ''}</small>
                    </div>
                  </div>
                  <div className="qt-quest-exp">{expCells(quest)}</div>
                </div>
                {info.status === 'locked' && <small className="qt-lock">🔒 {reasonText(info, quest)}</small>}
                {info.status === 'completed' && info.nextAvailableAt !== null && <small className="mk-muted">⏳ {T('next')} {new Date(info.nextAvailableAt).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</small>}
                {actions(quest, info)}
                <button type="button" className="qt-more" aria-expanded={open === quest.id} onClick={() => setOpen(open === quest.id ? null : quest.id)}>{open === quest.id ? '▾' : '▸'} {T('details')}</button>
                {open === quest.id && (
                  <div className="qt-detail">
                    {quest.description && <p>{quest.description}</p>}
                    {quest.objectives.length > 0 && <><b>{T('objectives')}</b><ul>{quest.objectives.map((o, i) => <li key={i}>{o.name}{o.qty !== null ? ` × ${o.qty}` : ''} <small className="mk-muted">({o.kind})</small></li>)}</ul></>}
                    {quest.prerequisites.length > 0 && <p><b>{T('prereq')}:</b> {quest.prerequisites.map((id) => data.quests.find((x) => x.id === id)?.name ?? id).join(', ')}</p>}
                    <p><b>{T('repeat')}:</b> {TXT.repeatNames[lang][quest.repeatType]}{quest.repeatType === 'interval' && quest.repeatIntervalHours ? ` ${quest.repeatIntervalHours} ${T('hours')}` : ''}</p>
                    {(active.progress[quest.id]?.deliveries.length ?? 0) > 0 && (
                      <p><b>{T('deliveries')}:</b> {active.progress[quest.id].deliveries.map((d) => new Date(d).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')).join(' · ')}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {filtered.length > limit && <button type="button" className="mk-btn" onClick={() => setLimit(limit + PAGE)}>{T('more')} ({filtered.length - limit})</button>}
      </section>
    </div>
  );
}
