// Admin: point the Overlay Timer Boss download at a GitHub Release asset URL
// (unlimited bandwidth, doesn't touch Supabase Storage/egress).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type AppDownload, OVERLAY_KEY, downloadUrl, fetchAppDownload, setAppDownload } from '../../lib/market/downloads';

const fmtSize = (bytes: number | null): string => bytes == null ? '—' : `${(bytes / 1048576).toFixed(1)} MB`;

export function DownloadAdmin() {
  const { t, lang } = useI18n();
  const [current, setCurrent] = useState<AppDownload | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [version, setVersion] = useState('');
  const [sizeMb, setSizeMb] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = () => fetchAppDownload(OVERLAY_KEY).then((d) => {
    setCurrent(d);
    if (d) {
      setUrl(d.path); setFilename(d.filename); setVersion(d.version ?? '');
      setSizeMb(d.size != null ? String(Math.round((d.size / 1048576) * 10) / 10) : '');
      setNotes(d.notes ?? '');
    }
  }).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!url.trim()) return;
    setError(''); setOk(''); setBusy(true);
    try {
      const size = sizeMb.trim() ? Math.round(parseFloat(sizeMb) * 1048576) : null;
      await setAppDownload(OVERLAY_KEY, {
        url: url.trim(),
        filename: filename.trim() || url.trim().split('/').pop() || 'download.exe',
        version, size, notes,
      });
      setOk(t('mk.admin.dl.done'));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        <h3 className="mk-h3">🔗 {t('mk.admin.dl.replace')}</h3>
        <p className="mk-muted mk-dl-steps">{t('mk.admin.dl.steps')}</p>
        <div className="mk-dl-form col">
          <input className="mk-dl-input" value={url} onChange={(e) => { setUrl(e.target.value); setError(''); setOk(''); }} placeholder={t('mk.admin.dl.urlph')} />
          <div className="mk-dl-row">
            <input className="mk-dl-input" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder={t('mk.admin.dl.filenameph')} />
            <input className="mk-dl-input mk-dl-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder={t('mk.admin.dl.versionph')} />
            <input className="mk-dl-input mk-dl-version" value={sizeMb} onChange={(e) => setSizeMb(e.target.value)} placeholder={t('mk.admin.dl.sizeph')} inputMode="decimal" />
          </div>
          <textarea className="mk-dl-input mk-dl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('mk.admin.dl.notesph')} rows={3} />
          <button className="mk-btn primary" onClick={save} disabled={!url.trim() || busy}>{busy ? '⏳' : '✓'} {t('mk.admin.dl.send')}</button>
        </div>
        {error && <p className="mk-auth-err">✕ {error}</p>}
        {ok && <p className="mk-dl-ok">✅ {ok}</p>}
      </div>
    </div>
  );
}
