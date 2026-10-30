// Quest Manager (administrators): add, edit, duplicate, turn on/off and archive quests; manage categories; import and export
// in bulk with a preview. The database refuses every change that does not come from an administrator.
import { useMemo, useState } from 'react';
import {
  buildQuestImport, parseQuestFile, questsToCsv, questsToJson, validateQuest, type QuestImportPreview,
} from '../../lib/quest/importExport';
import { getQuestRepo } from '../../lib/quest/repo';
import { OBJECTIVE_KINDS, REPEAT_TYPES, type Quest, type QuestCategory, type RepeatType } from '../../lib/quest/types';
import { Loading } from '../Loading';
import { AdminLog, downloadText, errText, readFileText, useAdminData } from './adminShared';

const REPEAT_LABEL: Record<RepeatType, string> = { once: 'Única', repeatable: 'Repetível (sem espera)', daily: 'Diária (24 h)', interval: 'Com intervalo (horas)' };
const KIND_LABEL = { monster: 'Monstro', boss: 'Boss', item: 'Item', other: 'Outro' } as const;
const PAGE = 100;

const emptyQuest = (categoryId: string): Quest => ({
  id: '', name: '', categoryId, minLevel: null, maxLevel: null, map: '', npc: '', description: '', objectives: [], baseExp: null,
  prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false,
});
const numOrNull = (v: string): number | null => { const t = v.replace(/\D/g, ''); return t === '' ? null : Number(t); };

export function QuestManagerAdmin() {
  const { data, state, reload } = useAdminData();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [logKey, setLogKey] = useState(0);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [map, setMap] = useState('all');
  const [lvl, setLvl] = useState('');
  const [flag, setFlag] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [draft, setDraft] = useState<Quest | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [prereqText, setPrereqText] = useState('');
  const [importText, setImportText] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState<QuestImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [busy, setBusy] = useState(false);

  const maps = useMemo(() => [...new Set((data?.quests ?? []).map((x) => x.map).filter(Boolean))].sort(), [data]);
  const filtered = useMemo(() => {
    if (!data) return [];
    const text = q.trim().toLowerCase();
    const lv = Number(lvl);
    return data.quests.filter((x) => {
      if (flag === 'active' && !(x.active && !x.archived)) return false;
      if (flag === 'inactive' && (x.active || x.archived)) return false;
      if (flag === 'archived' && !x.archived) return false;
      if (cat !== 'all' && x.categoryId !== cat) return false;
      if (map !== 'all' && x.map !== map) return false;
      if (lvl !== '' && Number.isFinite(lv) && ((x.minLevel !== null && lv < x.minLevel) || (x.maxLevel !== null && lv > x.maxLevel))) return false;
      return !text || x.name.toLowerCase().includes(text) || x.id.toLowerCase().includes(text);
    });
  }, [data, q, cat, map, lvl, flag]);

  if (state === 'loading') return <Loading />;
  if (state === 'unavailable') return <p className="sk-notice">O Quest Tracker ainda não foi ativado no banco de dados (rode o SQL 30_quest_tracker.sql).</p>;
  if (state === 'error' || !data) return <p className="ag-warning" role="alert">Não foi possível carregar os dados.</p>;

  const catName = (id: string) => data.categories.find((c) => c.id === id)?.name ?? id;
  const knownIds = new Set(data.quests.map((x) => x.id));
  const run = async (what: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await what(); setMsg({ kind: 'ok', text: ok }); reload(); setLogKey((k) => k + 1); } catch (e) { setMsg({ kind: 'error', text: errText(e) }); } finally { setBusy(false); }
  };

  const openNew = () => { setDraft(emptyQuest(data.categories[0]?.id ?? 'normal')); setIsNew(true); setPrereqText(''); setMsg(null); };
  const openEdit = (x: Quest) => { setDraft({ ...x, objectives: x.objectives.map((o) => ({ ...o })) }); setIsNew(false); setPrereqText(x.prerequisites.join(', ')); setMsg(null); };
  const duplicate = (x: Quest) => {
    let id = `${x.id}-copia`, n = 2;
    while (knownIds.has(id)) id = `${x.id}-copia${n++}`;
    setDraft({ ...x, id, name: `${x.name} (cópia)`, archived: false, objectives: x.objectives.map((o) => ({ ...o })) });
    setIsNew(true); setPrereqText(x.prerequisites.join(', ')); setMsg(null);
  };

  const draftQuest: Quest | null = draft ? { ...draft, prerequisites: prereqText.split(/[,;|\s]+/).map((s) => s.trim()).filter(Boolean) } : null;
  const check = draftQuest ? validateQuest(draftQuest, data.categories, knownIds) : { errors: [], warnings: [] };
  const idTaken = !!draftQuest && isNew && knownIds.has(draftQuest.id);
  const errors = idTaken ? [...check.errors, 'já existe uma quest com esse ID'] : check.errors;

  const saveDraft = () => {
    if (!draftQuest || errors.length) return;
    void run(async () => { await getQuestRepo().saveQuests([{ ...draftQuest, repeatIntervalHours: draftQuest.repeatType === 'interval' ? draftQuest.repeatIntervalHours : null }]); setDraft(null); }, 'Quest salva.');
  };

  const doPreview = () => {
    setImportError(''); setPreview(null);
    const parsed = parseQuestFile(importText);
    if (parsed.error) { setImportError(parsed.error); return; }
    setPreview(buildQuestImport(parsed.records, data.quests, data.categories, updateExisting));
  };
  const confirmImport = () => {
    if (!preview || preview.toSave.length === 0) return;
    void run(async () => { await getQuestRepo().saveQuests(preview.toSave); setPreview(null); setImportText(''); }, `${preview.toSave.length} quest(s) importada(s).`);
  };

  const field = (label: string, node: React.ReactNode, wide = false) => <label className={`mk-field${wide ? ' wide' : ''}`}><span>{label}</span>{node}</label>;

  return (
    <div className="qa">
      {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}

      <section className="sr-card cl-box">
        <h3>Quests <small>· {data.quests.length}</small></h3>
        <p className="mk-muted">Cadastre aqui as quests oficiais. Quests removidas são apenas arquivadas, para não quebrar o histórico dos personagens. Nenhuma quest é criada automaticamente.</p>
        <div className="qa-bar">
          <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Pesquisar por ID ou nome" aria-label="Pesquisar" />
          <select value={cat} onChange={(e) => { setCat(e.target.value); setLimit(PAGE); }} aria-label="Categoria"><option value="all">Todas as categorias</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={map} onChange={(e) => { setMap(e.target.value); setLimit(PAGE); }} aria-label="Mapa"><option value="all">Todos os mapas</option>{maps.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          <input value={lvl} onChange={(e) => { setLvl(e.target.value.replace(/\D/g, '').slice(0, 3)); setLimit(PAGE); }} placeholder="Level" aria-label="Level" style={{ maxWidth: 90 }} />
          <select value={flag} onChange={(e) => { setFlag(e.target.value as typeof flag); setLimit(PAGE); }} aria-label="Status">
            <option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Desativadas</option><option value="archived">Arquivadas</option>
          </select>
          <button type="button" className="mk-btn primary" onClick={openNew}>➕ Nova quest</button>
        </div>

        {draft && draftQuest && (
          <div className="qa-form">
            {field('ID único *', <input value={draft.id} disabled={!isNew} onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })} maxLength={60} />)}
            {field('Nome oficial *', <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />)}
            {field('Categoria *', <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
            {field('Level mínimo', <input inputMode="numeric" value={draft.minLevel ?? ''} onChange={(e) => setDraft({ ...draft, minLevel: numOrNull(e.target.value) })} />)}
            {field('Level máximo', <input inputMode="numeric" value={draft.maxLevel ?? ''} onChange={(e) => setDraft({ ...draft, maxLevel: numOrNull(e.target.value) })} />)}
            {field('Mapa', <input value={draft.map} onChange={(e) => setDraft({ ...draft, map: e.target.value })} maxLength={120} />)}
            {field('NPC responsável', <input value={draft.npc} onChange={(e) => setDraft({ ...draft, npc: e.target.value })} maxLength={120} />)}
            {field('EXP base (valor absoluto)', <input inputMode="numeric" value={draft.baseExp ?? ''} onChange={(e) => setDraft({ ...draft, baseExp: numOrNull(e.target.value) })} />)}
            {field('EXP de Grind durante a quest (opcional, medida em jogo)', <input inputMode="numeric" value={draft.grindExp ?? ''} onChange={(e) => setDraft({ ...draft, grindExp: numOrNull(e.target.value) })} />)}
            {field('Tipo de repetição', <select value={draft.repeatType} onChange={(e) => setDraft({ ...draft, repeatType: e.target.value as RepeatType })}>{REPEAT_TYPES.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}</select>)}
            {draft.repeatType === 'interval' && field('Intervalo (horas)', <input inputMode="numeric" value={draft.repeatIntervalHours ?? ''} onChange={(e) => setDraft({ ...draft, repeatIntervalHours: numOrNull(e.target.value) })} />)}
            {field('Pré-requisitos (IDs de quests, separados por vírgula)', <input value={prereqText} onChange={(e) => setPrereqText(e.target.value)} />, true)}
            {field('Descrição', <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={4000} />, true)}
            <div className="wide">
              <b>Objetivos / monstros e itens necessários</b>
              <div className="qa-objs">
                {draft.objectives.map((o, i) => (
                  <div key={i} className="qa-obj">
                    <select value={o.kind} onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, j) => (j === i ? { ...x, kind: e.target.value as typeof o.kind } : x)) })}>{OBJECTIVE_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                    <input value={o.name} placeholder="Nome" onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <input inputMode="numeric" value={o.qty ?? ''} placeholder="Qtd." onChange={(e) => setDraft({ ...draft, objectives: draft.objectives.map((x, j) => (j === i ? { ...x, qty: numOrNull(e.target.value) } : x)) })} />
                    <button type="button" className="mk-btn" onClick={() => setDraft({ ...draft, objectives: draft.objectives.filter((_, j) => j !== i) })} aria-label="Remover objetivo">✕</button>
                  </div>
                ))}
                <button type="button" className="mk-btn" onClick={() => setDraft({ ...draft, objectives: [...draft.objectives, { kind: 'monster', name: '', qty: null }] })}>➕ Objetivo</button>
              </div>
            </div>
            <label className="qt-check wide"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> <span>Ativa (visível para os jogadores)</span></label>
            {errors.length > 0 && <div className="qa-errors wide">{errors.map((e) => <div key={e}>✗ {e}</div>)}</div>}
            {check.warnings.length > 0 && <div className="qa-warnings wide">{check.warnings.map((e) => <div key={e}>⚠ {e}</div>)}</div>}
            <div className="wide qt-actions">
              <button type="button" className="mk-btn primary" disabled={busy || errors.length > 0} onClick={saveDraft}>💾 {isNew ? 'Criar quest' : 'Salvar alterações'}</button>
              <button type="button" className="mk-btn" onClick={() => setDraft(null)}>Cancelar</button>
            </div>
          </div>
        )}

        <p className="mk-muted">{filtered.length} quest(s)</p>
        {data.quests.length === 0 ? <p className="sk-notice">Nenhuma quest cadastrada. Use "Nova quest" ou a importação abaixo quando tiver a lista oficial.</p> : (
          <div className="qt-scroll">
            <table className="ag-table qt-table">
              <thead><tr><th>ID</th><th>Nome</th><th>Categoria</th><th>Level</th><th>Mapa</th><th>EXP base</th><th /></tr></thead>
              <tbody>
                {filtered.slice(0, limit).map((x) => (
                  <tr key={x.id}>
                    <td>{x.id}</td>
                    <td><b>{x.name}</b> {!x.active && <span className="qa-badge off">desativada</span>} {x.archived && <span className="qa-badge arch">arquivada</span>}</td>
                    <td>{catName(x.categoryId)}</td>
                    <td>{x.minLevel ?? '—'}{x.maxLevel !== null ? `–${x.maxLevel}` : '+'}</td>
                    <td>{x.map || '—'}</td>
                    <td>{x.baseExp === null ? <span className="mk-muted">não cadastrada</span> : x.baseExp.toLocaleString('pt-BR')}</td>
                    <td><div className="qt-actions">
                      <button type="button" className="mk-btn" onClick={() => openEdit(x)}>Editar</button>
                      <button type="button" className="mk-btn" onClick={() => duplicate(x)}>Duplicar</button>
                      <button type="button" className="mk-btn" disabled={busy} onClick={() => void run(() => getQuestRepo().saveQuests([{ ...x, active: !x.active }]), x.active ? 'Quest desativada.' : 'Quest ativada.')}>{x.active ? 'Desativar' : 'Ativar'}</button>
                      <button type="button" className="mk-btn" disabled={busy} onClick={() => void run(() => getQuestRepo().saveQuests([{ ...x, archived: !x.archived }]), x.archived ? 'Quest restaurada.' : 'Quest arquivada.')}>{x.archived ? 'Restaurar' : 'Arquivar'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > limit && <button type="button" className="mk-btn" onClick={() => setLimit(limit + PAGE)}>Mostrar mais ({filtered.length - limit})</button>}
      </section>

      <section className="sr-card cl-box">
        <h3>Importar / exportar quests</h3>
        <p className="mk-muted">CSV ou JSON. Colunas: id, name, category, minLevel, maxLevel, map, npc, description, objectives, baseExp, prerequisites, repeatType, repeatIntervalHours, active (nomes em português também funcionam). Objetivos: <code>monster:Nome x10|boss:Nome|item:Nome x5</code>. Pré-requisitos separados por <code>|</code>. Uma coluna que não está no arquivo nunca apaga o valor de uma quest existente.</p>
        <div className="qa-bar">
          <input type="file" accept=".csv,.json,.txt" aria-label="Arquivo" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFileText(f).then((t) => { setImportText(t); setPreview(null); setImportError(''); }).catch((x) => setImportError(errText(x))); }} />
          <button type="button" className="mk-btn" onClick={() => downloadText('quests.json', questsToJson(data.quests), 'application/json')}>⬇ Exportar JSON</button>
          <button type="button" className="mk-btn" onClick={() => downloadText('quests.csv', questsToCsv(data.quests, data.categories), 'text/csv')}>⬇ Exportar CSV</button>
        </div>
        <textarea className="cl-note" rows={6} value={importText} onChange={(e) => { setImportText(e.target.value); setPreview(null); }} placeholder="Cole aqui o CSV ou o JSON (ou escolha um arquivo acima)" aria-label="Conteúdo para importar" />
        <label className="qt-check"><input type="checkbox" checked={updateExisting} onChange={(e) => { setUpdateExisting(e.target.checked); setPreview(null); }} /> <span>Atualizar quests que já existem (por padrão elas são ignoradas)</span></label>
        <div className="qt-actions">
          <button type="button" className="mk-btn primary" disabled={!importText.trim()} onClick={doPreview}>Validar e ver prévia</button>
        </div>
        {importError && <p className="ag-warning" role="alert">{importError}</p>}
        {preview && (
          <div className="qa-preview">
            <p><b>{preview.counts.new}</b> nova(s) · <b>{preview.counts.update}</b> atualização(ões) · {preview.counts.same} sem mudança · {preview.counts.skip} ignorada(s) (já existem) · <b className="qa-errors">{preview.counts.error}</b> com erro (não serão importadas)</p>
            <div className="qt-scroll" style={{ maxHeight: 320 }}>
              <table className="ag-table qt-table">
                <thead><tr><th>Linha</th><th>ID</th><th>Resultado</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 300).map((r) => (
                    <tr key={r.line}>
                      <td>{r.line}</td><td>{r.id || '—'}</td>
                      <td className={r.action}>{{ new: 'nova', update: 'atualiza', same: 'igual', skip: 'ignorada', error: 'erro' }[r.action]}</td>
                      <td><small>{[...r.errors.map((e) => `✗ ${e}`), ...r.changes.map((c) => `alterou: ${c}`), ...r.warnings.map((w) => `⚠ ${w}`)].join(' · ')}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="mk-btn primary" disabled={busy || preview.toSave.length === 0} onClick={confirmImport}>Confirmar importação de {preview.toSave.length} quest(s)</button>
          </div>
        )}
      </section>

      <CategoriesPanel categories={data.categories} quests={data.quests} onChanged={() => { reload(); setLogKey((k) => k + 1); }} />
      <AdminLog entities={['quests', 'quest_categories']} refreshKey={logKey} />
    </div>
  );
}

function CategoriesPanel({ categories, quests, onChanged }: { categories: QuestCategory[]; quests: Quest[]; onChanged: () => void }) {
  const [msg, setMsg] = useState('');
  const [nc, setNc] = useState({ id: '', name: '', color: '#6fa8dc' });
  const save = async (c: QuestCategory) => { setMsg(''); try { await getQuestRepo().saveCategory(c); onChanged(); } catch (e) { setMsg(errText(e)); } };
  const del = async (c: QuestCategory) => {
    setMsg('');
    try { await getQuestRepo().deleteCategory(c.id); onChanged(); } catch (e) { setMsg(errText(e)); }
  };
  const idOk = /^[a-z0-9_-]{2,40}$/.test(nc.id) && !categories.some((c) => c.id === nc.id);
  return (
    <details className="sr-card cl-box">
      <summary>Categorias de quests</summary>
      <p className="mk-muted">As 5 categorias iniciais não podem ser excluídas (só renomeadas ou desativadas). Uma categoria com quests não pode ser excluída.</p>
      <div className="qt-scroll">
        <table className="ag-table qt-table">
          <thead><tr><th>ID</th><th>Nome</th><th>Ordem</th><th>Cor</th><th>Ativa</th><th>Quests</th><th /></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td><input defaultValue={c.name} maxLength={60} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && void save({ ...c, name: e.target.value.trim() })} /></td>
                <td><input defaultValue={c.sort} inputMode="numeric" style={{ width: 70 }} onBlur={(e) => Number(e.target.value) !== c.sort && void save({ ...c, sort: Number(e.target.value) || 0 })} /></td>
                <td><input type="color" defaultValue={c.color || '#888888'} onBlur={(e) => e.target.value !== c.color && void save({ ...c, color: e.target.value })} /></td>
                <td><input type="checkbox" checked={c.active} onChange={(e) => void save({ ...c, active: e.target.checked })} /></td>
                <td>{quests.filter((x) => x.categoryId === c.id).length}</td>
                <td><button type="button" className="mk-btn cl-danger" disabled={c.builtin} onClick={() => void del(c)}>Excluir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="qa-bar">
        <input value={nc.id} onChange={(e) => setNc({ ...nc, id: e.target.value.toLowerCase() })} placeholder="id (a-z, 0-9, - _)" aria-label="ID da categoria" />
        <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Nome da nova categoria" aria-label="Nome da categoria" />
        <input type="color" value={nc.color} onChange={(e) => setNc({ ...nc, color: e.target.value })} style={{ maxWidth: 60 }} aria-label="Cor" />
        <button type="button" className="mk-btn primary" disabled={!idOk || !nc.name.trim()} onClick={() => void save({ id: nc.id, name: nc.name.trim(), sort: categories.length + 1, color: nc.color, active: true, builtin: false }).then(() => setNc({ id: '', name: '', color: '#6fa8dc' }))}>➕ Adicionar categoria</button>
      </div>
      {msg && <p className="ag-warning" role="alert">{msg}</p>}
    </details>
  );
}
