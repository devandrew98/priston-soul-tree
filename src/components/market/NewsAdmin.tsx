// Admin CRUD for Home news / events. Admin-only via RLS.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { type NewsInput, type NewsItem, type NewsKind, createNews, deleteNews, fetchAllNews, updateNews } from '../../lib/market/news';

const KINDS: NewsKind[] = ['news', 'event', 'maintenance'];
const empty: NewsInput = { title: '', body: '', kind: 'news', pinned: false, published: true, sort: 0 };

export function NewsAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<NewsInput>(empty);
  const [busy, setBusy] = useState(false);

  const reload = () => fetchAllNews().then(setRows).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try { await createNews({ ...draft, title: draft.title.trim(), body: draft.body.trim() }); setDraft(empty); reload(); }
    finally { setBusy(false); }
  };

  return (
    <div className="mk-news-admin">
      <div className="mk-news-form">
        <h3 className="mk-h3">➕ {t('mk.admin.news.add')}</h3>
        <input placeholder={t('mk.admin.news.titleph')} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <textarea rows={2} placeholder={t('mk.admin.news.bodyph')} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <div className="mk-news-form-row">
          <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as NewsKind })}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`home.news.kind.${k}`)}</option>)}
          </select>
          <label className="mk-news-chk"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} /> 📌 {t('mk.admin.news.pin')}</label>
          <label className="mk-news-chk"><input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} /> {t('mk.admin.news.published')}</label>
          <button className="mk-btn primary" onClick={add} disabled={busy || !draft.title.trim()}>{busy ? '⏳' : `✓ ${t('mk.admin.news.publish')}`}</button>
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
  const [d, setD] = useState<NewsInput>({ title: item.title, body: item.body, kind: item.kind, pinned: item.pinned, published: item.published, sort: item.sort });
  const [busy, setBusy] = useState(false);
  const dirty = d.title !== item.title || d.body !== item.body || d.kind !== item.kind || d.pinned !== item.pinned || d.published !== item.published || d.sort !== item.sort;
  const save = async () => { setBusy(true); try { await updateNews(item.id, d); onChange(); } finally { setBusy(false); } };
  const remove = async () => { await deleteNews(item.id).catch(() => {}); onChange(); };

  return (
    <div className={`mk-news-item ${d.published ? '' : 'unpub'}`}>
      <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
      <textarea rows={2} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
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
