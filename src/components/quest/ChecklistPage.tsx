// pristonzone.com/checklist#p=...: the quests of a leveling plan, in the order of delivery, to be ticked off while doing them.
// The plan comes inside the link; the ticks stay in this browser. Nothing here changes any character or any data.
import { useEffect, useMemo, useState } from 'react';
import { codeFromHash, decodePlan, loadTicks, saveTicks } from '../../lib/quest/checklist';
import { displayMap } from '../../lib/quest/mapGroups';
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

export function ChecklistPage() {
  useNoIndex();
  const code = useMemo(() => codeFromHash(window.location.hash), []);
  const plan = useMemo(() => (code ? decodePlan(code) : null), [code]);
  const [quests, setQuests] = useState<Map<string, Quest> | null>(null);
  const [error, setError] = useState('');
  const [ticks, setTicks] = useState<Record<string, boolean>>(() => (code ? loadTicks(code) : {}));

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    getQuestRepo().loadData(false)
      .then((d) => { if (!cancelled) setQuests(new Map(d.quests.map((q) => [q.id, q]))); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [plan]);

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

  const toggle = (id: string) => {
    const next = { ...ticks };
    if (next[id]) delete next[id]; else next[id] = true;
    setTicks(next);
    saveTicks(code, next);
  };
  const done = plan.q.filter((id) => ticks[id]).length;
  const total = plan.q.length;

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

      {plan.p && <p className="ck-pre">{plan.p}</p>}

      <ol className="ck-list">
        {plan.q.map((id, i) => {
          const q = quests.get(id);
          const on = !!ticks[id];
          return (
            <li key={id} className={on ? 'on' : ''}>
              <label>
                <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                <span className="ck-n">{i + 1}.</span>
                <span className="ck-name">
                  <b>{q ? q.name : id}</b>
                  <small>{q ? [q.map ? displayMap(q.map) : '', q.npc].filter(Boolean).join(' · ') : 'esta quest não existe mais'}</small>
                </span>
                {q && q.baseExp !== null && <span className="ck-exp">{fmtExp(q.baseExp, 'pt')}</span>}
              </label>
            </li>
          );
        })}
      </ol>

      <p className="ck-note">Suas marcações ficam salvas só neste navegador. O EXP mostrado é o base, sem bônus.</p>
      <p className="ck-foot"><a href="/quests">PristonZONE · Quest Tracker</a></p>
    </main>
  );
}
