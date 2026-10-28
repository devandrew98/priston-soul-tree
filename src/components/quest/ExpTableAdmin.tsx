// EXP Table Manager (administrators): the official EXP per level, how the values are written (per level or accumulated),
// integrity checks, bulk import/export and a view of the progression. Every calculator reads this table.
import { useMemo, useState } from 'react';
import { makeExpTable, validateExpRows } from '../../lib/quest/exp';
import { buildExpImport, expToCsv, expToJson, parseExpFile, type ExpImportPreview } from '../../lib/quest/importExport';
import { getQuestRepo } from '../../lib/quest/repo';
import { EXP_TABLE_MODES, type ExpLevel, type ExpTableMode } from '../../lib/quest/types';
import { Loading } from '../Loading';
import { AdminLog, downloadText, errText, readFileText, useAdminData } from './adminShared';

const MODE_LABEL: Record<ExpTableMode, string> = {
  per_level: 'EXP necessária para sair do level (do level L para L+1)',
  cumulative_start: 'EXP acumulada ao CHEGAR no level (total quando o level começa)',
  cumulative_end: 'EXP acumulada ao COMPLETAR o level (total quando o level termina)',
};
const nf = (n: number) => n.toLocaleString('pt-BR');
const PAGE = 120;

export function ExpTableAdmin() {
  const { data, state, reload } = useAdminData();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [logKey, setLogKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lv, setLv] = useState('');
  const [val, setVal] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<ExpImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => [...(data?.expLevels ?? [])].sort((a, b) => a.level - b.level), [data]);
  const mode = data?.settings.expTableMode ?? 'per_level';
  const table = useMemo(() => makeExpTable(rows, mode), [rows, mode]);
  const issues = useMemo(() => validateExpRows(rows, mode), [rows, mode]);
  const maxNeeded = useMemo(() => Math.max(1, ...rows.map((r) => table.needed(r.level) ?? 0)), [rows, table]);

  if (state === 'loading') return <Loading />;
  if (state === 'unavailable') return <p className="sk-notice">O Quest Tracker ainda não foi ativado no banco de dados (rode o SQL 30_quest_tracker.sql).</p>;
  if (state === 'error' || !data) return <p className="ag-warning" role="alert">Não foi possível carregar os dados.</p>;

  const run = async (what: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await what(); setMsg({ kind: 'ok', text: ok }); reload(); setLogKey((k) => k + 1); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); } finally { setBusy(false); }
  };
  const saveRow = (r: ExpLevel) => run(() => getQuestRepo().saveExpLevels([r]), `Level ${r.level} salvo.`);
  const lvNum = Number(lv), valNum = Number(val.replace(/\D/g, ''));
  const addOk = Number.isInteger(lvNum) && lvNum >= 1 && val.replace(/\D/g, '') !== '' && Number.isSafeInteger(valNum);

  const doPreview = () => {
    setImportError(''); setPreview(null);
    const p = parseExpFile(text);
    if (p.error) { setImportError(p.error); return; }
    setPreview(buildExpImport(p.records, rows, mode));
  };

  return (
    <div className="qa">
      {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}

      <section className="sr-card cl-box">
        <h3>Formato da tabela de EXP</h3>
        <p className="mk-muted">Defina como os valores da tabela oficial estão escritos. O sistema converte internamente para "EXP necessária por level", e todas as calculadoras usam esta tabela. Trocar o formato muda como os valores já cadastrados são lidos: faça isso só ao carregar a tabela oficial.</p>
        <div className="qa-bar">
          <select value={mode} disabled={busy} aria-label="Formato" onChange={(e) => void run(() => getQuestRepo().saveSettings({ ...data.settings, expTableMode: e.target.value as ExpTableMode }), 'Formato salvo.')}>
            {EXP_TABLE_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        </div>
      </section>

      <section className="sr-card cl-box">
        <h3>Tabela por level <small>· {rows.length} level(s){rows.length > 0 ? ` · ${rows[0].level} a ${rows[rows.length - 1].level}` : ''}</small></h3>
        {issues.length > 0 && (
          <div className="qa-errors" role="alert">
            <b>Problemas na tabela ({issues.length}):</b>
            <ul>{issues.slice(0, 12).map((i, n) => <li key={n}>{i.level !== undefined ? `Level ${i.level}: ` : ''}{i.message}</li>)}</ul>
            {issues.length > 12 && <small>… e mais {issues.length - 12}</small>}
          </div>
        )}
        <div className="qa-bar">
          <input value={lv} onChange={(e) => setLv(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder={rows.length ? `Level (ex.: ${rows[rows.length - 1].level + 1})` : 'Level'} aria-label="Level" style={{ maxWidth: 160 }} />
          <input value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d.]/g, '').slice(0, 20))} placeholder="Valor de EXP (inteiro)" aria-label="Valor de EXP" />
          <button type="button" className="mk-btn primary" disabled={busy || !addOk} onClick={() => void run(async () => { await getQuestRepo().saveExpLevels([{ level: lvNum, value: valNum, active: true }]); setLv(''); setVal(''); }, 'Level salvo.')}>➕ Adicionar / atualizar level</button>
        </div>
        {rows.length === 0 ? <p className="sk-notice">A tabela está vazia. Importe a tabela oficial abaixo (os calculadores só mostram resultados quando os levels existem).</p> : (
          <div className="qt-scroll">
            <table className="ag-table qt-table">
              <thead><tr><th>Level</th><th>Valor cadastrado</th><th>EXP necessária (convertida)</th><th>Progressão</th><th>Ativo</th><th /></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((r) => {
                  const need = table.needed(r.level);
                  return (
                    <tr key={r.level} style={r.active ? undefined : { opacity: 0.55 }}>
                      <td><b>{r.level}</b></td>
                      <td><input defaultValue={r.value} key={r.value} inputMode="numeric" onBlur={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); if (Number.isSafeInteger(n) && n !== r.value) void saveRow({ ...r, value: n }); }} /></td>
                      <td>{need === null ? <span className="mk-muted">—</span> : nf(need)}</td>
                      <td style={{ minWidth: 120 }}><i className="qa-hbar" style={{ width: `${need === null ? 0 : Math.max(2, (need / maxNeeded) * 100)}%` }} /></td>
                      <td><input type="checkbox" checked={r.active} onChange={(e) => void saveRow({ ...r, active: e.target.checked })} /></td>
                      <td><button type="button" className="mk-btn cl-danger" disabled={busy} onClick={() => void run(() => getQuestRepo().deleteExpLevel(r.level), `Level ${r.level} removido.`)}>Remover</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && <button type="button" className="mk-btn" onClick={() => setLimit(limit + PAGE)}>Mostrar mais ({rows.length - limit})</button>}
      </section>

      <section className="sr-card cl-box">
        <h3>Importar / exportar a tabela</h3>
        <p className="mk-muted">CSV com cabeçalho <code>level,value</code> (opcional: <code>active</code>) ou JSON <code>[{'{'}"level":1,"value":100{'}'}]</code>. Separadores de milhar (1.000.000) são aceitos. A prévia mostra o que muda e os problemas que a tabela teria.</p>
        <div className="qa-bar">
          <input type="file" accept=".csv,.json,.txt" aria-label="Arquivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFileText(f).then((t) => { setText(t); setPreview(null); setImportError(''); }).catch((x) => setImportError(errText(x))); }} />
          <button type="button" className="mk-btn" onClick={() => downloadText('exp-table.json', expToJson(rows), 'application/json')}>⬇ Exportar JSON</button>
          <button type="button" className="mk-btn" onClick={() => downloadText('exp-table.csv', expToCsv(rows), 'text/csv')}>⬇ Exportar CSV</button>
        </div>
        <textarea className="cl-note" rows={6} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder="Cole aqui a tabela (CSV ou JSON)" aria-label="Conteúdo para importar" />
        <div className="qt-actions"><button type="button" className="mk-btn primary" disabled={!text.trim()} onClick={doPreview}>Validar e ver prévia</button></div>
        {importError && <p className="ag-warning" role="alert">{importError}</p>}
        {preview && (
          <div className="qa-preview">
            <p><b>{preview.counts.new}</b> novo(s) · <b>{preview.counts.update}</b> atualização(ões) · {preview.counts.same} sem mudança · <b className="qa-errors">{preview.counts.error}</b> com erro (não serão importados)</p>
            {preview.tableIssues.length > 0 && <div className="qa-warnings">⚠ Com este arquivo a tabela ficaria com {preview.tableIssues.length} problema(s): {preview.tableIssues.slice(0, 5).map((i) => `${i.level !== undefined ? `level ${i.level}: ` : ''}${i.message}`).join(' · ')}</div>}
            <div className="qt-scroll" style={{ maxHeight: 260 }}>
              <table className="ag-table qt-table">
                <thead><tr><th>Linha</th><th>Level</th><th>Resultado</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 300).map((r) => (
                    <tr key={r.line}><td>{r.line}</td><td>{r.level ?? '—'}</td><td className={r.action}>{{ new: 'novo', update: 'atualiza', same: 'igual', skip: 'ignorado', error: 'erro' }[r.action]}</td><td><small>{r.errors.join(' · ')}</small></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="mk-btn primary" disabled={busy || preview.toSave.length === 0} onClick={() => void run(async () => { await getQuestRepo().saveExpLevels(preview.toSave); setPreview(null); setText(''); }, `${preview.toSave.length} level(s) importado(s).`)}>Confirmar importação de {preview.toSave.length} level(s)</button>
          </div>
        )}
      </section>

      <AdminLog entities={['exp_levels', 'quest_settings']} refreshKey={logKey} />
    </div>
  );
}
