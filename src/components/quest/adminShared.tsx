// Shared pieces of the Quest administration screens (administrators only; the database enforces it, not the screen).
import { useCallback, useEffect, useState } from 'react';
import { getQuestRepo, QuestUnavailableError, type LogEntry } from '../../lib/quest/repo';
import type { QuestData } from '../../lib/quest/types';

export const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The official data including inactive and archived records (what only an administrator can read). */
export function useAdminData() {
  const [data, setData] = useState<QuestData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const reload = useCallback(() => {
    getQuestRepo().loadData(true)
      .then((d) => { setData(d); setState('ready'); })
      .catch((e) => setState(e instanceof QuestUnavailableError ? 'unavailable' : 'error'));
  }, []);
  useEffect(reload, [reload]);
  return { data, state, reload };
}

/** Offers a text as a file download. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a chosen file as text. */
export const readFileText = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result ?? ''));
  r.onerror = () => reject(new Error('não foi possível ler o arquivo'));
  r.readAsText(file);
});

const ACTIONS: Record<string, string> = { insert: 'criou', update: 'alterou', delete: 'removeu' };
const ENTITIES: Record<string, string> = { quests: 'quest', quest_categories: 'categoria', exp_levels: 'level da tabela de EXP', exp_bonuses: 'bônus', quest_settings: 'configurações' };

/** The administrative change history (who changed what), newest first. */
export function AdminLog({ entities, refreshKey }: { entities: string[]; refreshKey: number }) {
  const [rows, setRows] = useState<LogEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getQuestRepo().listLog(200).then((r) => { if (!cancelled) setRows(r.filter((x) => entities.includes(x.entity)).slice(0, 60)); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [refreshKey, entities.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <details className="sr-card cl-box">
      <summary>Histórico de alterações</summary>
      {rows === null ? <p className="mk-muted">Carregando…</p> : rows.length === 0 ? <p className="mk-muted">Nenhuma alteração registrada.</p> : (
        <ul className="qa-log">
          {rows.map((r) => (
            <li key={r.id}>{new Date(r.at).toLocaleString('pt-BR')} · {ACTIONS[r.action] ?? r.action} {ENTITIES[r.entity] ?? r.entity} <b>{r.entityId}</b>{r.summary ? <small className="mk-muted"> — {r.summary}</small> : null}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
