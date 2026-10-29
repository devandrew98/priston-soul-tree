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
import { groupByMap } from '../../lib/quest/mapGroups';

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
  readyShort: { pt: '✓ Pronta', en: '✓ Ready' },
  deliverShort: { pt: 'Entregar', en: 'Deliver' },
  readyCount: { pt: 'prontas', en: 'ready' },
  expand: { pt: 'Mostrar o mapa', en: 'Show map' },
  collapse: { pt: 'Minimizar o mapa', en: 'Collapse map' },
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
  // maps the player collapsed (true) or expanded (false) by hand; a map whose quests are all marked ready collapses by itself
  const [collapsedBy, setCollapsedBy] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('pz-quest-collapsed') ?? '{}'); } catch { return {}; } });
  const toggleMap = (m: string, now: boolean) => setCollapsedBy((c) => { const n = { ...c, [m]: !now }; try { localStorage.setItem('pz-quest-collapsed', JSON.stringify(n)); } catch { /* private mode */ } return n; });

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
  // by map (highest-level map first), and inside each map the quest that gives the most EXP first
  const grouped = groupByMap(inFilters.filter((r) => questGroup(r.quest) === group), (r) => r.quest.map, (r) => expOf(r.quest), (r) => r.quest.minLevel, (r) => r.quest.name);
  const filtered = grouped.flatMap((g) => g.items);
  const allMarked = (items: typeof filtered) => items.length > 0 && items.every((r) => r.info.status === 'ready' || r.info.status === 'completed');
  const isCollapsed = (g: (typeof grouped)[number]) => collapsedBy[g.map] ?? allMarked(g.items);
  const out: ({ head: (typeof grouped)[number]; col: boolean } | { row: (typeof filtered)[number] })[] = [];
  let shown = 0, totalRows = 0;
  for (const g of grouped) {
    const col = isCollapsed(g);
    out.push({ head: g, col });
    if (col) continue;
    totalRows += g.items.length;
    for (const r of g.items) if (shown < limit) { out.push({ row: r }); shown++; }
  }

  const reasonText = (info: StatusInfo, quest: Quest) => info.reasons.map((r) => (r === 'level_min' ? `${T('reasonMin')} ${quest.minLevel}` : r === 'level_max' ? T('reasonMax') : T('reasonPre'))).join(' · ');
  const catChip = (id: string) => <span className="qt-chip" style={catOf(id)?.color ? { borderColor: catOf(id)!.color, color: catOf(id)!.color } : undefined}>{catOf(id)?.name ?? id}</span>;
  const planBtn = (quest: Quest) => (
    <button type="button" className={`mk-btn${plannerIds.includes(quest.id) ? ' primary' : ''}`} onClick={() => togglePlanner(quest.id)}>
      {plannerIds.includes(quest.id) ? `✔ ${T('inPlan')}` : `➕ ${T('addPlan')}`}
    </button>
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
            {out.map((o) => {
              if ('head' in o) {
                const g = o.head;
                const marked = g.items.filter((r) => r.info.status === 'ready' || r.info.status === 'completed').length;
                return (
                  <li key={`map:${g.map}`} className="qt-map-head">
                    <button type="button" aria-expanded={!o.col} title={o.col ? T('expand') : T('collapse')} onClick={() => toggleMap(g.map, o.col)}>
                      <span className="qt-chev">{o.col ? '▸' : '▾'}</span> {g.map} <small>· {g.items.length}{marked > 0 ? ` · ✓ ${marked}` : ''}</small>
                    </button>
                  </li>
                );
              }
              const { quest, info } = o.row;
              const r = rewardOf(quest);
              const p = r ? pctOfLevel(r.total) : null;
              const isOpen = open === quest.id;
              const lvlText = `${T('level')} ${quest.minLevel ?? '—'}${quest.maxLevel !== null ? `–${quest.maxLevel}` : '+'}`;
              return (
                <li key={quest.id} className={`qt-row st-${info.status}`}>
                  <div className="qt-row-main">
                    <span className={`qt-dot st-${info.status}`} title={TXT.statusName[lang][info.status]} />
                    <div className="qt-row-name">
                      <b>{quest.name}</b>
                      <small className="mk-muted">{lvlText}{quest.npc ? ` · ${quest.npc}` : ''}{info.status !== 'available' ? ` · ${TXT.statusName[lang][info.status]}` : ''}</small>
                    </div>
                    <div className="qt-row-exp">{r ? <b>{fmtExp(r.total, lang)}</b> : <span className="mk-muted">{T('noExp')}</span>}</div>
                    <div className="qt-row-act">
                      {(info.status === 'available' || info.status === 'in_progress') && <button type="button" className="mk-btn primary" onClick={() => setQuestState(quest.id, 'ready')}>{T('readyShort')}</button>}
                      {info.status === 'ready' && <button type="button" className="mk-btn primary" onClick={() => setQuestState(quest.id, 'deliver')}>{T('deliverShort')}</button>}
                      <button type="button" className="qt-more-btn" aria-expanded={isOpen} aria-label={T('details')} title={T('details')} onClick={() => setOpen(isOpen ? null : quest.id)}>{isOpen ? '▴' : '⋯'}</button>
                    </div>
                  </div>
                  {info.status === 'locked' && <small className="qt-lock">🔒 {reasonText(info, quest)}</small>}
                  {isOpen && (
                    <div className="qt-detail">
                      <p>
                        {r && r.extra > 0 && <span>{fmtExp(r.base, lang)} + {fmtExp(r.extra, lang)} · </span>}
                        {r && (p === null ? T('noTable') : `${fmtPct(p, lang)} ${T('ofLevel')} ${active.level}`)}
                        {catOf(quest.categoryId) ? ` · ${catOf(quest.categoryId)!.name}` : ''}
                        <small className="mk-muted"> · {quest.id}</small>
                      </p>
                      {info.status === 'completed' && info.nextAvailableAt !== null && <small className="mk-muted">⏳ {T('next')} {new Date(info.nextAvailableAt).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</small>}
                      <div className="qt-actions">
                        {info.status === 'available' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'start')}>{T('start')}</button>}
                        {info.status === 'in_progress' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'reset')}>{T('cancel')}</button>}
                        {info.status === 'ready' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'start')}>{T('back')}</button>}
                        {info.status === 'completed' && <button type="button" className="mk-btn" onClick={() => setQuestState(quest.id, 'undo')}>{T('undo')}</button>}
                        {info.status !== 'locked' && info.status !== 'completed' && <button type="button" className="mk-btn" onClick={() => { setCalcQuestId(quest.id); setTab('calculator'); }}>🧮 {T('calc')}</button>}
                        {info.status !== 'locked' && info.status !== 'completed' && planBtn(quest)}
                      </div>
                      {quest.description && <p>{quest.description}</p>}
                      {quest.objectives.length > 0 && <><b>{T('objectives')}</b><ul>{quest.objectives.map((ob, i) => <li key={i}>{ob.name}{ob.qty !== null ? ` × ${ob.qty}` : ''} <small className="mk-muted">({ob.kind})</small></li>)}</ul></>}
                      {quest.prerequisites.length > 0 && <p><b>{T('prereq')}:</b> {quest.prerequisites.map((id) => data.quests.find((x) => x.id === id)?.name ?? id).join(', ')}</p>}
                      <p><b>{T('repeat')}:</b> {TXT.repeatNames[lang][quest.repeatType]}{quest.repeatType === 'interval' && quest.repeatIntervalHours ? ` ${quest.repeatIntervalHours} ${T('hours')}` : ''}</p>
                      {(active.progress[quest.id]?.deliveries.length ?? 0) > 0 && (
                        <p><b>{T('deliveries')}:</b> {active.progress[quest.id].deliveries.map((d) => new Date(d).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')).join(' · ')}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {totalRows > limit && <button type="button" className="mk-btn" onClick={() => setLimit(limit + PAGE)}>{T('more')} ({totalRows - limit})</button>}
      </section>
    </div>
  );
}
