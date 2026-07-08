// Admin CRUD for streamers (inside the Marketplace admin panel). Admin-only via RLS.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  type Platform, type Streamer, type StreamerInput,
  createStreamer, deleteStreamer, fetchStreamers, updateStreamer, uploadStreamerCover,
} from '../../lib/market/streamers';
import { useAuth } from './store';

const PLATFORMS: Platform[] = ['twitch', 'youtube'];
const emptyDraft: StreamerInput = { name: '', platform: 'twitch', handle: '', url: '', sort: 0 };

export function StreamersAdmin() {
  const { t } = useI18n();
  const { userId } = useAuth();
  const [rows, setRows] = useState<Streamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // add form
  const [draft, setDraft] = useState<StreamerInput>(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => { fetchStreamers().then(setRows).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const onFile = (f: File | undefined, setP: (s: string) => void, setF: (f: File | null) => void) => {
    if (!f || !f.type.startsWith('image/')) return;
    setF(f);
    const r = new FileReader();
    r.onload = () => setP(String(r.result));
    r.readAsDataURL(f);
  };

  const add = async () => {
    if (!userId || !draft.name.trim() || !draft.handle.trim()) return;
    setBusy(true); setErr('');
    try {
      const cover = file ? await uploadStreamerCover(userId, file) : '';
      await createStreamer({ ...draft, name: draft.name.trim(), handle: draft.handle.trim() }, cover);
      setDraft(emptyDraft); setFile(null); setPreview('');
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="strm-admin">
      {/* add new */}
      <div className="strm-admin-add">
        <h3 className="mk-h3">➕ {t('mk.admin.strm.add')}</h3>
        <div className="strm-admin-form">
          <div className="strm-admin-cover" onClick={() => fileRef.current?.click()}>
            {preview ? <img src={preview} alt="" /> : <span>🖼️<br />{t('mk.admin.strm.cover')}</span>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0], setPreview, setFile)} />
          </div>
          <div className="strm-admin-fields">
            <input placeholder={t('mk.admin.strm.name')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <div className="strm-admin-row2">
              <select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as Platform })}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p === 'twitch' ? '🟣 Twitch' : '🔴 YouTube'}</option>)}
              </select>
              <input placeholder={draft.platform === 'twitch' ? t('mk.admin.strm.handle.tw') : t('mk.admin.strm.handle.yt')} value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} />
              <input className="strm-admin-sort" type="number" title={t('mk.admin.strm.order')} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
            </div>
            <input placeholder={t('mk.admin.strm.url')} value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            <button className="mk-btn primary" onClick={add} disabled={busy || !draft.name.trim() || !draft.handle.trim()}>
              {busy ? `⏳ ${t('mk.loading')}` : `✓ ${t('mk.admin.strm.create')}`}
            </button>
            {err && <p className="mk-auth-err">✕ {err}</p>}
          </div>
        </div>
      </div>

      {/* existing */}
      <div className="strm-admin-list">
        {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
        {!loading && rows.length === 0 && <p className="mk-muted">{t('mk.admin.strm.empty')}</p>}
        {rows.map((s) => <StreamerRow key={s.id} s={s} userId={userId} onChange={load} onFilePick={onFile} />)}
      </div>
    </div>
  );
}

function StreamerRow({ s, userId, onChange, onFilePick }: {
  s: Streamer; userId: string | null; onChange: () => void;
  onFilePick: (f: File | undefined, setP: (s: string) => void, setF: (f: File | null) => void) => void;
}) {
  const { t } = useI18n();
  const [d, setD] = useState<StreamerInput>({ name: s.name, platform: s.platform, handle: s.handle, url: s.url, sort: s.sort });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = d.name !== s.name || d.platform !== s.platform || d.handle !== s.handle || d.url !== s.url || d.sort !== s.sort || !!file;

  const save = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const coverUrl = file ? await uploadStreamerCover(userId, file) : undefined;
      await updateStreamer(s.id, { ...d, coverUrl });
      setFile(null); setPreview('');
      onChange();
    } catch { /* surfaced via reload */ } finally { setBusy(false); }
  };
  const toggleLive = async () => { await updateStreamer(s.id, { live: !s.live }).catch(() => {}); onChange(); };
  const remove = async () => { await deleteStreamer(s.id).catch(() => {}); onChange(); };

  return (
    <div className={`strm-admin-item ${s.live ? 'live' : ''}`}>
      <div className="strm-admin-thumb" onClick={() => fileRef.current?.click()} title={t('mk.admin.strm.changecover')}>
        {preview || s.coverUrl ? <img src={preview || s.coverUrl} alt="" /> : <span>🖼️</span>}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFilePick(e.target.files?.[0], setPreview, setFile)} />
      </div>
      <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <select value={d.platform} onChange={(e) => setD({ ...d, platform: e.target.value as Platform })}>
        <option value="twitch">🟣 Twitch</option>
        <option value="youtube">🔴 YouTube</option>
      </select>
      <input value={d.handle} onChange={(e) => setD({ ...d, handle: e.target.value })} />
      <input className="strm-admin-sort" type="number" value={d.sort} onChange={(e) => setD({ ...d, sort: Number(e.target.value) || 0 })} />
      <button className={`mk-btn sm ${s.live ? 'active' : ''}`} onClick={toggleLive} title={t('mk.admin.strm.livehint')}>
        {s.live ? `● ${t('strm.live')}` : t('mk.admin.strm.offline')}
      </button>
      <button className="mk-btn sm primary" onClick={save} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
      <button className="mk-btn sm danger" onClick={remove}>{t('mk.delete')}</button>
    </div>
  );
}
