// pristonzone.com/leveling: a private-link guide with check-off items. Everybody with the link reads it and ticks their own
// progress (kept in their browser); only the administrator sees the editor, which works inside this same page.
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../market/store';
import { Loading } from '../Loading';
import {
  BLOCK_KINDS, LIMITS, PAGE_SLUG, PERSONAL_FAKE, defaultPage, getPageRepo, inlinePieces, isCheckable, loadMarks, newId, pageBlocks, progressOf, sanitizePage,
  saveMarks, stepNumbers, type Block, type BlockKind, type PersonalPage as Page, type Section,
} from '../../lib/personal/page';

const KIND_NAMES: Record<BlockKind, string> = { text: 'Texto', check: 'Item com marcador', step: 'Passo numerado', tip: 'Dica' };

/** Plain text with the **bold** parts, no HTML involved. */
function Inline({ text }: { text: string }) {
  return <>{inlinePieces(text).map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}</>;
}

/** Moves item `i` of a list by `d` places (returns the same list at the edges). */
const move = <T,>(list: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

export function PersonalPage() {
  const { isAdmin: realAdmin } = useAuth();
  const isAdmin = realAdmin || PERSONAL_FAKE;
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [marks, setMarks] = useState<Record<string, boolean>>(() => loadMarks(PAGE_SLUG));
  const [draft, setDraft] = useState<Page | null>(null); // not null = editing
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Rota de leveling — PristonZONE';
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPageRepo().load(PAGE_SLUG)
      .then((p) => { if (!cancelled) setPage(p ?? defaultPage()); })
      .catch(() => { if (!cancelled) { setLoadError(true); setPage(defaultPage()); } });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => setMarks((m) => { const next = { ...m }; if (next[id]) delete next[id]; else next[id] = true; saveMarks(PAGE_SLUG, next); return next; });
  const resetMarks = () => { setMarks({}); saveMarks(PAGE_SLUG, {}); setConfirmReset(false); };

  const shown = draft ?? page;
  const total = useMemo(() => (page ? progressOf(pageBlocks(page), marks) : { done: 0, total: 0 }), [page, marks]);

  // ---------- editing ----------
  const startEdit = () => { if (page) { setDraft(JSON.parse(JSON.stringify(page)) as Page); setMsg(null); } };
  const cancelEdit = () => { setDraft(null); setConfirmDel(null); };
  const save = () => {
    if (!draft) return;
    setSaving(true); setMsg(null);
    const clean = sanitizePage(draft);
    getPageRepo().save(PAGE_SLUG, clean)
      .then(() => { setPage(clean); setDraft(null); setMsg({ kind: 'ok', text: 'Salvo. Os seus amigos já veem a nova versão ao abrir ou recarregar a página.' }); })
      .catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Não foi possível salvar.' }))
      .finally(() => setSaving(false));
  };
  const patchDraft = (fn: (d: Page) => Page) => setDraft((d) => (d ? fn(d) : d));
  const patchSection = (sid: string, fn: (s: Section) => Section) => patchDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sid ? fn(s) : s)) }));
  const patchBlock = (sid: string, bid: string, patch: Partial<Block>) => patchSection(sid, (s) => ({ ...s, blocks: s.blocks.map((x) => (x.id === bid ? { ...x, ...patch } : x)) }));
  const addBlock = (sid: string, kind: BlockKind) => patchSection(sid, (s) => (s.blocks.length >= LIMITS.blocks ? s : { ...s, blocks: [...s.blocks, { id: newId(), kind, text: '', level: 0 }] }));
  const addSection = () => patchDraft((d) => (d.sections.length >= LIMITS.sections ? d : { ...d, sections: [...d.sections, { id: newId(), title: 'Nova seção', blocks: [] }] }));

  if (!shown) return <div className="pp"><Loading /></div>;

  // ---------- editor ----------
  if (draft) {
    return (
      <div className="pp pp-editing">
        <div className="pp-bar" role="toolbar">
          <b>✏ Editando</b>
          <span className="mk-muted">Use **negrito** ou *negrito* no texto.</span>
          <span className="pp-bar-spacer" />
          <button type="button" className="mk-btn" onClick={cancelEdit} disabled={saving}>Cancelar</button>
          <button type="button" className="mk-btn primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : '💾 Salvar'}</button>
        </div>
        {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}

        <section className="sr-card pp-edit-head">
          <label className="mk-field"><span>Título da página</span>
            <input value={draft.title} maxLength={LIMITS.title} onChange={(e) => patchDraft((d) => ({ ...d, title: e.target.value }))} />
          </label>
          <label className="mk-field"><span>Texto de abertura</span>
            <textarea rows={2} value={draft.intro} maxLength={LIMITS.intro} onChange={(e) => patchDraft((d) => ({ ...d, intro: e.target.value }))} />
          </label>
        </section>

        {draft.sections.map((s, si) => (
          <section key={s.id} className="sr-card pp-edit-section">
            <div className="pp-edit-sechead">
              <input className="pp-edit-title" value={s.title} maxLength={LIMITS.sectionTitle} aria-label="Título da seção" onChange={(e) => patchSection(s.id, (x) => ({ ...x, title: e.target.value }))} />
              <button type="button" className="mk-btn sm" aria-label="Subir seção" disabled={si === 0} onClick={() => patchDraft((d) => ({ ...d, sections: move(d.sections, si, -1) }))}>↑</button>
              <button type="button" className="mk-btn sm" aria-label="Descer seção" disabled={si === draft.sections.length - 1} onClick={() => patchDraft((d) => ({ ...d, sections: move(d.sections, si, 1) }))}>↓</button>
              {confirmDel === s.id ? (
                <>
                  <button type="button" className="mk-btn sm danger" onClick={() => { patchDraft((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) })); setConfirmDel(null); }}>Excluir a seção toda?</button>
                  <button type="button" className="mk-btn sm" onClick={() => setConfirmDel(null)}>Não</button>
                </>
              ) : <button type="button" className="mk-btn sm danger" aria-label="Excluir seção" onClick={() => setConfirmDel(s.id)}>🗑</button>}
            </div>

            {s.blocks.map((blk, bi) => (
              <div key={blk.id} className={`pp-edit-block ${blk.level === 1 ? 'sub' : ''}`}>
                <div className="pp-edit-blockbar">
                  <select value={blk.kind} aria-label="Tipo do bloco" onChange={(e) => patchBlock(s.id, blk.id, { kind: e.target.value as BlockKind })}>
                    {BLOCK_KINDS.map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
                  </select>
                  <button type="button" className={`mk-btn sm ${blk.level === 1 ? 'active' : ''}`} title="Recuar (sub-item)" onClick={() => patchBlock(s.id, blk.id, { level: blk.level === 1 ? 0 : 1 })}>↳ Recuar</button>
                  <span className="pp-bar-spacer" />
                  <button type="button" className="mk-btn sm" aria-label="Subir" disabled={bi === 0} onClick={() => patchSection(s.id, (x) => ({ ...x, blocks: move(x.blocks, bi, -1) }))}>↑</button>
                  <button type="button" className="mk-btn sm" aria-label="Descer" disabled={bi === s.blocks.length - 1} onClick={() => patchSection(s.id, (x) => ({ ...x, blocks: move(x.blocks, bi, 1) }))}>↓</button>
                  <button type="button" className="mk-btn sm danger" aria-label="Excluir bloco" onClick={() => patchSection(s.id, (x) => ({ ...x, blocks: x.blocks.filter((y) => y.id !== blk.id) }))}>🗑</button>
                </div>
                <textarea rows={2} value={blk.text} maxLength={LIMITS.text} aria-label="Texto do bloco" onChange={(e) => patchBlock(s.id, blk.id, { text: e.target.value })} />
              </div>
            ))}

            <div className="pp-edit-add">
              <span className="mk-muted">Adicionar:</span>
              {BLOCK_KINDS.map((k) => <button key={k} type="button" className="mk-btn sm" onClick={() => addBlock(s.id, k)}>+ {KIND_NAMES[k]}</button>)}
            </div>
          </section>
        ))}

        <button type="button" className="mk-btn" onClick={addSection}>➕ Nova seção</button>
      </div>
    );
  }

  // ---------- reading ----------
  return (
    <div className="pp">
      <header className="pp-head">
        <h1 className="mk-h1">📜 {shown.title || 'Sem título'}</h1>
        {shown.intro && <p className="pp-intro"><Inline text={shown.intro} /></p>}
        {total.total > 0 && (
          <div className="pp-progress" aria-label={`${total.done} de ${total.total} feitos`}>
            <div className="pp-progress-bar"><div style={{ width: `${(total.done / total.total) * 100}%` }} /></div>
            <span><b>{total.done}</b> / {total.total} feitos</span>
            {total.done > 0 && (confirmReset ? (
              <>
                <button type="button" className="mk-btn sm danger" onClick={resetMarks}>Limpar tudo?</button>
                <button type="button" className="mk-btn sm" onClick={() => setConfirmReset(false)}>Não</button>
              </>
            ) : <button type="button" className="mk-btn sm" onClick={() => setConfirmReset(true)}>Limpar marcações</button>)}
          </div>
        )}
      </header>
      {loadError && <p className="sk-notice">Não consegui buscar a versão mais recente agora; mostrando o texto original.</p>}
      {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}

      {shown.sections.map((s) => {
        const prog = progressOf(s.blocks, marks);
        const nums = stepNumbers(s.blocks);
        return (
          <section key={s.id} className={`sr-card pp-section ${prog.total > 0 && prog.done === prog.total ? 'done' : ''}`}>
            <h2>{s.title}{prog.total > 0 && <small>{prog.done}/{prog.total}</small>}</h2>
            {s.blocks.map((blk, i) => {
              const cls = `pp-block pp-${blk.kind} ${blk.level === 1 ? 'sub' : ''}`;
              if (!isCheckable(blk)) return <p key={blk.id} className={cls}><Inline text={blk.text} /></p>;
              const on = !!marks[blk.id];
              return (
                <label key={blk.id} className={`${cls} pp-check ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(blk.id)} />
                  <span>{nums[i] !== null && <b className="pp-num">{nums[i]}.</b>}<Inline text={blk.text} /></span>
                </label>
              );
            })}
          </section>
        );
      })}

      <footer className="pp-foot">
        {/* Only the administrator sees the editor (and the database refuses anybody else's save). */}
        {isAdmin && <button type="button" className="mk-btn" onClick={startEdit}>✏ Editar esta página</button>}
      </footer>
    </div>
  );
}
