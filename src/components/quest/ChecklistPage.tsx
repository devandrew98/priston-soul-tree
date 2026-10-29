// pristonzone.com/checklist#p=...: the quests of a leveling plan, to be ticked off while doing them.
// By default they are split by map (the highest-level map first, then the boss hunts, then the solo quests) with the most EXP first,
// like the quest list; the order of delivery planned by the planner is one tap away. The plan comes inside the link and the ticks
// stay in this browser. Nothing here changes any character or any data.
import { useEffect, useMemo, useState } from 'react';
import { codeFromHash, decodePlan, loadTicks, resolveToken, saveTicks } from '../../lib/quest/checklist';
import { displayMap, groupQuests } from '../../lib/quest/mapGroups';
import { getQuestRepo } from '../../lib/quest/repo';
import type { Quest } from '../../lib/quest/types';
import { Loading } from '../Loading';
import { fmtExp } from './format';

/** Header tags: a private working page, not for search engines. */
function useNoIndex() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Checklist de leveling — PristonZONE';
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    return () => { document.title = prev; m.remove(); };
  }, []);
}

interface Row { token: string; quest?: Quest }

export function ChecklistPage() {
  useNoIndex();
  const code = useMemo(() => codeFromHash(window.location.hash), []);
  const plan = useMemo(() => (code ? decodePlan(code) : null), [code]);
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [error, setError] = useState('');
  const [ticks, setTicks] = useState<Record<string, boolean>>(() => (code ? loadTicks(code) : {}));
  const [view, setView] = useState<'map' | 'order'>('map');
  const [collapsedBy, setCollapsedBy] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    getQuestRepo().loadData(false)
      .then((d) => { if (!cancelled) setQuests(d.quests); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [plan]);

  const rows: Row[] = useMemo(() => (plan && quests ? plan.q.map((token) => ({ token, quest: resolveToken(token, quests) })) : []), [plan, quests]);
  const groups = useMemo(() => {
    const found = rows.filter((r): r is Row & { quest: Quest } => !!r.quest);
    const g = groupQuests(found, (r) => r.quest, (r) => r.quest.baseExp ?? -1);
    const missing = rows.filter((r) => !r.quest);
    return missing.length ? [...g, { map: 'Quests que não existem mais', items: missing as (Row & { quest: Quest })[] }] : g;
  }, [rows]);

  if (!plan || !code) {
    return (
      <main className="ck">
        <h1>Checklist de leveling</h1>
        <p className="ck-note">Este link não tem um plano válido. Gere um novo no Quest Tracker, em Planejador de Leveling, com o botão “Abrir checklist”.</p>
        <a className="mk-btn" href="/quests">Ir para o Quest Tracker</a>
      </main>
    );
  }
  if (error) return <main className="ck"><h1>Checklist de leveling</h1><p className="ck-note">Não foi possível carregar as quests: {error}</p></main>;
  if (!quests) return <main className="ck"><Loading /></main>;

  const toggle = (token: string) => {
    const next = { ...ticks };
    if (next[token]) delete next[token]; else next[token] = true;
    setTicks(next);
    saveTicks(code, next);
  };
  const done = plan.q.filter((t) => ticks[t]).length;
  const total = plan.q.length;
  const isCollapsed = (map: string, items: Row[]) => collapsedBy[map] ?? (items.length > 0 && items.every((r) => ticks[r.token]));

  const item = (r: Row, n?: number) => (
    <li key={r.token} className={ticks[r.token] ? 'on' : ''}>
      <label>
        <input type="checkbox" checked={!!ticks[r.token]} onChange={() => toggle(r.token)} />
        {n !== undefined && <span className="ck-n">{n}.</span>}
        <span className="ck-name">
          <b>{r.quest ? r.quest.name : r.token}</b>
          {view === 'order' || !r.quest ? <small>{r.quest ? [r.quest.map ? displayMap(r.quest.map) : '', r.quest.npc].filter(Boolean).join(' · ') : 'esta quest não existe mais'}</small> : r.quest.npc ? <small>{r.quest.npc}</small> : null}
        </span>
        {r.quest && r.quest.baseExp !== null && <span className="ck-exp">{fmtExp(r.quest.baseExp, 'pt')}</span>}
      </label>
    </li>
  );

  return (
    <main className="ck">
      <header>
        <h1>{plan.n || 'Checklist de leveling'}</h1>
        <p className="ck-goal">Objetivo: Level {plan.lv}{plan.pct > 0 ? ` · ${String(plan.pct).replace('.', ',')}%` : ''}</p>
        <div className="ck-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <p className="ck-count">{done} de {total} feitas{done === total && total > 0 ? ' ✓' : ''}</p>
      </header>

      {plan.pl !== undefined && <p className="ck-pre">Depois de upar: Level {plan.pl}{plan.pp ? ` · ${String(plan.pp).replace('.', ',')}%` : ''}</p>}

      <div className="ck-view" role="group" aria-label="Como mostrar">
        <button type="button" className={view === 'map' ? 'on' : ''} aria-pressed={view === 'map'} onClick={() => setView('map')}>Por mapa</button>
        <button type="button" className={view === 'order' ? 'on' : ''} aria-pressed={view === 'order'} onClick={() => setView('order')}>Ordem de entrega</button>
      </div>

      {view === 'order' ? (
        <ol className="ck-list">{rows.map((r, i) => item(r, i + 1))}</ol>
      ) : (
        groups.map((g) => {
          const col = isCollapsed(g.map, g.items);
          const dn = g.items.filter((r) => ticks[r.token]).length;
          return (
            <section key={g.map} className="ck-group">
              <button type="button" className="ck-map" aria-expanded={!col} onClick={() => setCollapsedBy((c) => ({ ...c, [g.map]: !col }))}>
                <span className="qt-chev">{col ? '▸' : '▾'}</span> {g.map} <small>· {dn}/{g.items.length}</small>
              </button>
              {!col && <ul className="ck-list">{g.items.map((r) => item(r))}</ul>}
            </section>
          );
        })
      )}

      <p className="ck-note">Suas marcações ficam salvas só neste navegador. O EXP mostrado é o base, sem bônus.</p>
      <p className="ck-foot"><a href="/quests">PristonZONE · Quest Tracker</a></p>
    </main>
  );
}
