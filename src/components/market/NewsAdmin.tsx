// Admin CRUD for Home news / events. Admin-only via RLS. Title and body are
// entered separately in PT and EN so each visitor reads their language.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type NewsInput, type NewsItem, type NewsKind, createNews, deleteNews, fetchAllNews, updateNews } from '../../lib/market/news';

const KINDS: NewsKind[] = ['news', 'event', 'maintenance'];
const empty: NewsInput = { titlePt: '', titleEn: '', bodyPt: '', bodyEn: '', kind: 'news', pinned: false, published: true, sort: 0 };

export function NewsAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<NewsInput>(empty);
  const [busy, setBusy] = useState(false);

  const reload = () => fetchAllNews().then(setRows).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!draft.titlePt.trim() || !draft.titleEn.trim()) return;
    setBusy(true);
    try {
      await createNews({ ...draft, titlePt: draft.titlePt.trim(), titleEn: draft.titleEn.trim(), bodyPt: draft.bodyPt.trim(), bodyEn: draft.bodyEn.trim() });
      setDraft(empty); reload();
    } finally { setBusy(false); }
  };

  return (
    <div className="mk-news-admin">
      <div className="mk-news-form">
        <h3 className="mk-h3">➕ {t('mk.admin.news.add')}</h3>
        <div className="mk-news-lang-grid">
          <label className="mk-news-langfield">
            <span>🇧🇷 {t('mk.admin.news.titleph')}</span>
            <input value={draft.titlePt} onChange={(e) => setDraft({ ...draft, titlePt: e.target.value })} />
          </label>
          <label className="mk-news-langfield">
            <span>🇬🇧 {t('mk.admin.news.titleph')}</span>
            <input value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} />
          </label>
          <label className="mk-news-langfield">
            <span>🇧🇷 {t('mk.admin.news.bodyph')}</span>
            <textarea rows={2} value={draft.bodyPt} onChange={(e) => setDraft({ ...draft, bodyPt: e.target.value })} />
          </label>
          <label className="mk-news-langfield">
            <span>🇬🇧 {t('mk.admin.news.bodyph')}</span>
            <textarea rows={2} value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} />
          </label>
        </div>
        <div className="mk-news-form-row">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as NewsKind })}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`home.news.kind.${k}`)}</option>)}
          </select>
          <label className="mk-news-chk"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /> 📌 {t('mk.admin.news.pin')}</label>
          <label className="mk-news-chk"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> {t('mk.admin.news.published')}</label>
          <button className="mk-btn primary" onClick={add} disabled={busy || !draft.titlePt.trim() || !draft.titleEn.trim()}>{busy ? '⏳' : `✓ ${t('mk.admin.news.publish')}`}</button>
        </div>
      </div>

      <div className="mk-news-list">
        {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
        {!loading && rows.length === 0 && <p className="mk-muted">{t('mk.admin.news.empty')}</p>}
        {rows.map((n) => <NewsRow key={n.id} item={n} onChange={reload} />)}
      </div>
    </div>
  );
}

function NewsRow({ item, onChange }: { item: NewsItem; onChange: () => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<NewsInput>({
    titlePt: item.title.pt, titleEn: item.title.en, bodyPt: item.body.pt, bodyEn: item.body.en,
    kind: item.kind, pinned: item.pinned, published: item.published, sort: item.sort,
  });
  const [busy, setBusy] = useState(false);
  const dirty = d.titlePt !== item.title.pt || d.titleEn !== item.title.en || d.bodyPt !== item.body.pt || d.bodyEn !== item.body.en
    || d.kind !== item.kind || d.pinned !== item.pinned || d.published !== item.published || d.sort !== item.sort;
  const save = async () => { setBusy(true); try { await updateNews(item.id, d); onChange(); } finally { setBusy(false); } };
  const remove = async () => { await deleteNews(item.id).catch(() => {}); onChange(); };

  return (
    <div className={`mk-news-item ${d.published ? '' : 'unpub'}`}>
      <div className="mk-news-lang-grid">
        <label className="mk-news-langfield">
          <span>🇧🇷 {t('mk.admin.news.titleph')}</span>
          <input value={d.titlePt} onChange={(e) => setD({ ...d, titlePt: e.target.value })} />
        </label>
        <label className="mk-news-langfield">
          <span>🇬🇧 {t('mk.admin.news.titleph')}</span>
          <input value={d.titleEn} onChange={(e) => setD({ ...d, titleEn: e.target.value })} />
        </label>
        <label className="mk-news-langfield">
          <span>🇧🇷 {t('mk.admin.news.bodyph')}</span>
          <textarea rows={2} value={d.bodyPt} onChange={(e) => setD({ ...d, bodyPt: e.target.value })} />
        </label>
        <label className="mk-news-langfield">
          <span>🇬🇧 {t('mk.admin.news.bodyph')}</span>
          <textarea rows={2} value={d.bodyEn} onChange={(e) => setD({ ...d, bodyEn: e.target.value })} />
        </label>
      </div>
      <div className="mk-news-item-row">
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as NewsKind })}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`home.news.kind.${k}`)}</option>)}
        </select>
        <label className="mk-news-chk"><input type="checkbox" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} /> 📌</label>
        <label className="mk-news-chk"><input type="checkbox" checked={d.published} onChange={(e) => setD({ ...d, published: e.target.checked })} /> {t('mk.admin.news.published')}</label>
        <input className="mk-news-sort" type="number" value={d.sort} onChange={(e) => setD({ ...d, sort: Number(e.target.value) || 0 })} title={t('mk.admin.strm.order')} />
        <span className="mk-news-acts">
          <button className="mk-btn sm primary" onClick={save} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
          <button className="mk-btn sm danger" onClick={remove}>{t('mk.delete')}</button>
        </span>
      </div>
    </div>
  );
}
