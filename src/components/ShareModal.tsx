import { useState } from 'react';
import { useStore } from '../store';
import { buildShareUrl } from '../lib/share';
import { shareBuild, updateShared, openByCode, rememberOpened, getCloudMeta, type CloudMeta } from '../lib/cloud';

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { activeBuild, importBuild } = useStore();
  const [meta, setMeta] = useState<CloudMeta | null>(() => getCloudMeta(activeBuild.id));
  const [publicEdit, setPublicEdit] = useState<boolean>(meta?.publicEdit ?? false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  const [openCode, setOpenCode] = useState('');
  const isCreator = !!meta && meta.editToken !== '';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(''); setMsg('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const generate = () =>
    run(async () => {
      const m = await shareBuild(activeBuild.id, activeBuild.name, activeBuild.slots, publicEdit);
      setMeta(m);
      setMsg('Código gerado!');
    });

  const update = () =>
    run(async () => {
      await updateShared(activeBuild.id, activeBuild.name, activeBuild.slots, publicEdit);
      setMeta((m) => (m ? { ...m, publicEdit } : m));
      setMsg('Build atualizada neste código.');
    });

  const open = () =>
    run(async () => {
      const data = await openByCode(openCode);
      const newId = importBuild(data.name + ' (' + data.code + ')', data.slots);
      rememberOpened(newId, data.code, data.publicEdit);
      onClose();
    });

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => setMsg(label + ' copiado!'), () => setMsg(''));
  };

  const codeLink = meta ? `${location.origin}${location.pathname}#c=${meta.code}` : '';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(460px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Compartilhar build</h3>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {err && <p className="warn">{err}</p>}
          {msg && <p className="muted" style={{ color: 'var(--gold-bright)' }}>{msg}</p>}

          <div className="total-sub">Compartilhar por código</div>
          <label className="row" style={{ gap: 8, margin: '6px 0' }}>
            <input type="checkbox" checked={publicEdit} disabled={!!meta && !isCreator} onChange={(e) => setPublicEdit(e.target.checked)} />
            Permitir que outras pessoas editem (build pública para edição)
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            {publicEdit
              ? 'Qualquer pessoa com o código poderá ver e salvar alterações.'
              : 'Qualquer pessoa com o código pode ver a build, mas só você (neste navegador) pode editá-la.'}
          </p>

          {meta ? (
            <>
              <div className="code-box">{meta.code}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => copy(meta.code, 'Código')}>Copiar código</button>
                <button className="btn sm" onClick={() => copy(codeLink, 'Link')}>Copiar link</button>
                {(isCreator || meta.publicEdit) && (
                  <button className="btn sm primary" disabled={busy} onClick={update}>↻ Atualizar build neste código</button>
                )}
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                O código guarda um retrato da build. Editou a árvore? Clique em <b>Atualizar</b> para salvar de novo.
              </p>
            </>
          ) : (
            <button className="btn primary" disabled={busy} style={{ width: '100%', marginTop: 6 }} onClick={generate}>
              {busy ? 'Gerando...' : 'Gerar código'}
            </button>
          )}

          <hr className="sep" />

          <div className="total-sub">Abrir por código</div>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <input
              className="input"
              placeholder="Ex.: 7KQ3MD"
              value={openCode}
              maxLength={8}
              style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 2 }}
              onChange={(e) => setOpenCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && openCode) open(); }}
            />
            <button className="btn primary" disabled={busy || !openCode} onClick={open}>Abrir</button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>Abre a build numa nova entrada da sua lista, sem apagar a atual.</p>

          <hr className="sep" />
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Sem internet/servidor? Você ainda pode usar o <b>link</b> que carrega a build inteira na URL:{' '}
            <button className="btn sm" onClick={() => copy(buildShareUrl(activeBuild), 'Link')}>Copiar link offline</button>
          </p>
        </div>
      </div>
    </div>
  );
}
