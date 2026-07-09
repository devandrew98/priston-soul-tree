// Admin CRUD for video guides: categories (fully admin-defined) + videos
// (pasted YouTube links, auto-extracted id/thumbnail). Admin-only via RLS.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  type GuideCategory, type GuideVideo,
  createGuide, createGuideCategory, deleteGuide, deleteGuideCategory,
  extractYoutubeId, fetchGuideCategories, fetchGuides, updateGuide, updateGuideCategory, youtubeThumbnail,
} from '../../lib/market/guides';

export function GuidesAdmin() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<GuideCategory[]>([]);
  const [videos, setVideos] = useState<GuideVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => Promise.all([fetchGuideCategories(), fetchGuides()])
    .then(([c, v]) => { setCategories(c); setVideos(v); })
    .catch(() => {})
    .finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setBusy(true);
    try {
      const sort = categories.length ? Math.max(...categories.map((c) => c.sort)) + 1 : 0;
      await createGuideCategory(newCatName.trim(), sort);
      setNewCatName('');
      reload();
    } finally { setBusy(false); }
  };

  return (
    <div className="mk-guides-admin">
      <div className="mk-news-form">
        <h3 className="mk-h3">➕ {t('mk.admin.guides.addcat')}</h3>
        <div className="mk-news-form-row">
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t('mk.admin.guides.catname')} onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
          <button className="mk-btn primary" onClick={addCategory} disabled={busy || !newCatName.trim()}>{busy ? '⏳' : `✓ ${t('mk.admin.guides.create')}`}</button>
        </div>
      </div>

      {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
      {!loading && categories.length === 0 && <p className="mk-muted">{t('guides.empty')}</p>}

      {categories.map((cat) => (
        <CategoryBlock key={cat.id} cat={cat} videos={videos.filter((v) => v.categoryId === cat.id)} onChange={reload} />
      ))}
    </div>
  );
}

function CategoryBlock({ cat, videos, onChange }: { cat: GuideCategory; videos: GuideVideo[]; onChange: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(cat.name);
  const [sort, setSort] = useState(cat.sort);
  const [busy, setBusy] = useState(false);
  const dirty = name !== cat.name || sort !== cat.sort;

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const videoId = extractYoutubeId(url);
  const [addBusy, setAddBusy] = useState(false);

  const saveCat = async () => { setBusy(true); try { await updateGuideCategory(cat.id, { name, sort }); onChange(); } finally { setBusy(false); } };
  const removeCat = async () => { await deleteGuideCategory(cat.id).catch(() => {}); onChange(); };
  const addVideo = async () => {
    if (!videoId) return;
    setAddBusy(true);
    try {
      const s = videos.length ? Math.max(...videos.map((v) => v.sort)) + 1 : 0;
      await createGuide({ categoryId: cat.id, title: title.trim(), youtubeUrl: url.trim(), videoId, sort: s });
      setUrl(''); setTitle('');
      onChange();
    } finally { setAddBusy(false); }
  };

  return (
    <div className="mk-guides-cat">
      <div className="mk-guides-cat-head">
        <input className="mk-guides-catname" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="mk-tier-num" type="number" value={sort} onChange={(e) => setSort(Number(e.target.value) || 0)} title={t('mk.admin.strm.order')} />
        <button className="mk-btn sm primary" onClick={saveCat} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
        <button className="mk-btn sm danger" onClick={removeCat}>{t('mk.delete')}</button>
      </div>

      <div className="mk-guides-addvideo">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('mk.admin.guides.urlph')} />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('mk.admin.guides.titleph')} />
        {url && !videoId && <span className="mk-auth-err">✕ {t('mk.admin.guides.invalidurl')}</span>}
        <button className="mk-btn sm primary" onClick={addVideo} disabled={!videoId || addBusy}>{addBusy ? '⏳' : `➕ ${t('mk.admin.guides.addvideo')}`}</button>
      </div>

      <div className="mk-guides-videos">
        {videos.map((v) => <VideoRow key={v.id} video={v} onChange={onChange} />)}
        {videos.length === 0 && <p className="mk-muted mk-guides-empty">{t('mk.admin.guides.novideos')}</p>}
      </div>
    </div>
  );
}

function VideoRow({ video, onChange }: { video: GuideVideo; onChange: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(video.title);
  const [sort, setSort] = useState(video.sort);
  const [busy, setBusy] = useState(false);
  const dirty = title !== video.title || sort !== video.sort;
  const save = async () => { setBusy(true); try { await updateGuide(video.id, { title, sort }); onChange(); } finally { setBusy(false); } };
  const remove = async () => { await deleteGuide(video.id).catch(() => {}); onChange(); };

  return (
    <div className="mk-guides-videorow">
      <img className="mk-guides-thumb" src={youtubeThumbnail(video.videoId)} alt="" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('mk.admin.guides.titleph')} />
      <input className="mk-tier-num" type="number" value={sort} onChange={(e) => setSort(Number(e.target.value) || 0)} title={t('mk.admin.strm.order')} />
      <button className="mk-btn sm primary" onClick={save} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
      <button className="mk-btn sm danger" onClick={remove}>{t('mk.delete')}</button>
    </div>
  );
}
