import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import {
  MOCK_CATEGORIES, MOCK_GUIDES, type GuideCategory, type GuideVideo,
  fetchGuideCategories, fetchGuides, youtubeEmbedUrl, youtubeThumbnail, youtubeWatchUrl,
} from '../lib/market/guides';

function VideoLightbox({ video, onClose }: { video: GuideVideo; onClose: () => void }) {
  const { t } = useI18n();
  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="guide-lightbox" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <div className="guide-lightbox-frame">
          <iframe
            src={youtubeEmbedUrl(video.videoId)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {video.title && <h3 className="guide-lightbox-title">{video.title}</h3>}
        <a className="mk-linkbtn" href={youtubeWatchUrl(video.videoId)} target="_blank" rel="noopener noreferrer">
          ▶ {t('guides.openyoutube')}
        </a>
      </div>
    </div>,
    document.body,
  );
}

export function Guides() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<GuideCategory[]>(BACKEND_ENABLED ? [] : MOCK_CATEGORIES);
  const [videos, setVideos] = useState<GuideVideo[]>(BACKEND_ENABLED ? [] : MOCK_GUIDES);
  const [loading, setLoading] = useState(BACKEND_ENABLED);
  const [playing, setPlaying] = useState<GuideVideo | null>(null);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    Promise.all([fetchGuideCategories(), fetchGuides()])
      .then(([c, v]) => { if (!cancelled) { setCategories(c); setVideos(v); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mk guides">
      <div className="guides-head">
        <h1 className="mk-h1">🎬 {t('guides.title')}</h1>
        <p className="mk-muted">{t('guides.subtitle')}</p>
      </div>

      {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
      {!loading && categories.length === 0 && <p className="mk-muted">{t('guides.empty')}</p>}

      {categories.map((cat) => {
        const items = videos.filter((v) => v.categoryId === cat.id);
        if (items.length === 0) return null;
        return (
          <section key={cat.id} className="guides-section">
            <h2 className="guides-cat-title">{cat.name}</h2>
            <div className="guides-grid">
              {items.map((v) => (
                <button key={v.id} className="guide-card" onClick={() => setPlaying(v)}>
                  <span className="guide-cover">
                    <img src={youtubeThumbnail(v.videoId)} alt={v.title} loading="lazy" />
                    <span className="guide-play">▶</span>
                  </span>
                  {v.title && <span className="guide-card-title">{v.title}</span>}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {playing && <VideoLightbox video={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
