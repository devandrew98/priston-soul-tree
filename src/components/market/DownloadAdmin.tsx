// Admin: upload/replace the Overlay Timer Boss installer (goes to Storage).
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type AppDownload, OVERLAY_KEY, downloadUrl, fetchAppDownload, uploadAppDownload } from '../../lib/market/downloads';

const fmtSize = (bytes: number | null): string => bytes == null ? '—' : `${(bytes / 1048576).toFixed(1)} MB`;

export function DownloadAdmin() {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState<AppDownload | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => fetchAppDownload(OVERLAY_KEY).then(setCurrent).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return;
    setError(''); setOk(''); setBusy(true);
    try {
      await uploadAppDownload(OVERLAY_KEY, file, version);
      setFile(null); setVersion('');
      if (fileRef.current) fileRef.current.value = '';
      setOk(t('mk.admin.dl.done'));
      load();
    } catch (e) {
      const m = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));
      setError(/exceeded the maximum allowed size|payload too large|413|size/i.test(m) ? t('mk.admin.dl.toobig') : m);
    } finally { setBusy(false); }
  };

  const fmtDate = (ms: number) => new Date(ms).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

  return (
    <div className="mk-dl-admin">
      <p className="mk-muted">{t('mk.admin.dl.hint')}</p>

      <div className="mk-dl-current">
        <h3 className="mk-h3">{t('mk.admin.dl.current')}</h3>
        {loading ? <p className="mk-muted">⏳ {t('mk.loading')}</p> : current ? (
          <div className="mk-dl-info">
            <span>📦 <b>{current.filename}</b></span>
            <span className="mk-muted">{fmtSize(current.size)}{current.version ? ` · v${current.version}` : ''} · {t('mk.admin.dl.updated')} {fmtDate(current.updatedAt)}</span>
            <a className="mk-btn sm" href={downloadUrl(current.path)} download={current.filename} target="_blank" rel="noopener noreferrer">⬇ {t('mk.admin.dl.testdl')}</a>
          </div>
        ) : <p className="mk-muted">{t('mk.admin.dl.none')}</p>}
      </div>

      <div className="mk-dl-upload">
        <h3 className="mk-h3">⬆ {t('mk.admin.dl.replace')}</h3>
        <div className="mk-dl-form">
          <input ref={fileRef} type="file" accept=".exe,application/octet-stream,application/x-msdownload" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); setOk(''); }} />
          {file && <span className="mk-muted mk-dl-picked">{file.name} · {fmtSize(file.size)}</span>}
          <input className="mk-dl-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder={t('mk.admin.dl.versionph')} />
          <button className="mk-btn primary" onClick={upload} disabled={!file || busy}>{busy ? `⏳ ${t('mk.admin.dl.uploading')}` : `✓ ${t('mk.admin.dl.send')}`}</button>
        </div>
        {busy && <p className="mk-muted mk-dl-warn">{t('mk.admin.dl.wait')}</p>}
        {error && <p className="mk-auth-err">✕ {error}</p>}
        {ok && <p className="mk-dl-ok">✅ {ok}</p>}
      </div>
    </div>
  );
}
