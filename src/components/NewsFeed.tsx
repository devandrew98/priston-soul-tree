// Public news / events feed shown on the Home page.
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { MOCK_NEWS, type NewsItem, type NewsKind, fetchPublishedNews } from '../lib/market/news';

const KIND_ICON: Record<NewsKind, string> = { news: '📰', event: '🎉', maintenance: '🛠️' };

export function NewsFeed() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<NewsItem[]>(BACKEND_ENABLED ? [] : MOCK_NEWS);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchPublishedNews().then((n) => { if (!cancelled) setItems(n); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0) return null;

  const fmt = (ms: number) => new Date(ms).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short' });

  return (
    <section className="home-news">
      <h2 className="home-news-title">📢 {t('home.news.title')}</h2>
      <div className="home-news-list">
        {items.map((n) => (
          <article key={n.id} className={`home-news-card ${n.kind} ${n.pinned ? 'pinned' : ''}`}>
            <div className="home-news-head">
              <span className="home-news-kind">{KIND_ICON[n.kind]} {t(`home.news.kind.${n.kind}`)}</span>
              {n.pinned && <span className="home-news-pin" title={t('home.news.pinned')}>📌</span>}
              <span className="home-news-date">{fmt(n.createdAt)}</span>
            </div>
            <h3 className="home-news-h">{n.title[lang]}</h3>
            {n.body[lang] && <p className="home-news-body">{n.body[lang]}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
