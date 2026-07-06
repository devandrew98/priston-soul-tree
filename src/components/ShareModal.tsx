import { useState } from 'react';
import { useStore } from '../store';
import { useI18n } from '../lib/i18n';
import { buildShareUrl } from '../lib/share';
import { shareBuild, updateShared, openByCode, rememberOpened, getCloudMeta, type CloudMeta } from '../lib/cloud';

export function ShareModal({ onClose }: { onClose: () => void }) {
  const { activeBuild, importBuild } = useStore();
  const { t } = useI18n();
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
      setMsg(t('st.sm.codegen'));
    });

  const update = () =>
    run(async () => {
      await updateShared(activeBuild.id, activeBuild.name, activeBuild.slots, publicEdit);
      setMeta((m) => (m ? { ...m, publicEdit } : m));
      setMsg(t('st.sm.updated'));
    });

  const open = () =>
    run(async () => {
      const data = await openByCode(openCode);
      const newId = importBuild(data.name + ' (' + data.code + ')', data.slots);
      rememberOpened(newId, data.code, data.publicEdit);
      onClose();
    });

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => setMsg(t('st.copied', { label })), () => setMsg(''));
  };

  const codeLink = meta ? `${location.origin}${location.pathname}#c=${meta.code}` : '';

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(460px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('st.sm.title')}</h3>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {err && <p className="warn">{t(err)}</p>}
          {msg && <p className="muted" style={{ color: 'var(--gold-bright)' }}>{msg}</p>}

          <div className="total-sub">{t('st.sm.bycode')}</div>
          <label className="row" style={{ gap: 8, margin: '6px 0' }}>
            <input type="checkbox" checked={publicEdit} disabled={!!meta && !isCreator} onChange={(e) => setPublicEdit(e.target.checked)} />
            {t('st.sm.publicedit')}
          </label>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            {publicEdit ? t('st.sm.public.on') : t('st.sm.public.off')}
          </p>

          {meta ? (
            <>
              <div className="code-box">{meta.code}</div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => copy(meta.code, t('st.sm.lbl.code'))}>{t('st.sm.copycode')}</button>
                <button className="btn sm" onClick={() => copy(codeLink, t('st.sm.lbl.link'))}>{t('st.sm.copylink')}</button>
                {(isCreator || meta.publicEdit) && (
                  <button className="btn sm primary" disabled={busy} onClick={update}>{t('st.sm.update')}</button>
                )}
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                {t('st.sm.snapshotnote')}
              </p>
            </>
          ) : (
            <button className="btn primary" disabled={busy} style={{ width: '100%', marginTop: 6 }} onClick={generate}>
              {busy ? t('st.sm.generating') : t('st.sm.gencode')}
            </button>
          )}

          <hr className="sep" />

          <div className="total-sub">{t('st.sm.openbycode')}</div>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <input
              className="input"
              placeholder={t('st.sm.openph')}
              value={openCode}
              maxLength={8}
              style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 2 }}
              onChange={(e) => setOpenCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && openCode) open(); }}
            />
            <button className="btn primary" disabled={busy || !openCode} onClick={open}>{t('st.sm.open')}</button>
          </div>
          <p className="muted" style={{ fontSize: 12 }}>{t('st.sm.opennote')}</p>

          <hr className="sep" />
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            {t('st.sm.offlinenote')}{' '}
            <button className="btn sm" onClick={() => copy(buildShareUrl(activeBuild), t('st.sm.lbl.link'))}>{t('st.sm.copyoffline')}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
