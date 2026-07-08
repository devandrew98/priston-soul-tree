import { useI18n } from '../lib/i18n';
import { channelUrl, type Streamer } from '../lib/market/streamers';
import { useStreamers } from './market/useStreamers';

const PLAT: Record<Streamer['platform'], { icon: string; label: string }> = {
  twitch: { icon: '🟣', label: 'Twitch' },
  youtube: { icon: '🔴', label: 'YouTube' },
};

function Card({ s, t }: { s: Streamer; t: (k: string) => string }) {
  const plat = PLAT[s.platform];
  return (
    <a className={`strm-card ${s.live ? 'live' : 'off'}`} href={channelUrl(s)} target="_blank" rel="noopener noreferrer">
      <div className="strm-cover">
        {s.coverUrl ? <img src={s.coverUrl} alt={s.name} /> : <div className="strm-cover-fallback">{plat.icon}</div>}
        {s.live && <span className="strm-live-badge">● {t('strm.live')}</span>}
        <span className={`strm-plat ${s.platform}`}>{plat.icon} {plat.label}</span>
      </div>
      <div className="strm-info">
        <b className="strm-name">{s.name}</b>
        {s.live && s.title && <span className="strm-cast">{s.title}</span>}
        {s.live && s.platform === 'twitch' && s.viewers > 0 && (
          <span className="strm-viewers">👁 {s.viewers.toLocaleString('pt-BR')} {t('strm.viewers')}</span>
        )}
        {!s.live && <span className="strm-off-label">{t('strm.offlinelabel')}</span>}
      </div>
    </a>
  );
}

export function Streamers() {
  const { t } = useI18n();
  const { online, offline, loading, streamers } = useStreamers();

  return (
    <div className="mk strm">
      <div className="strm-head">
        <h1 className="mk-h1">📺 {t('strm.title')}</h1>
        <p className="mk-muted">{t('strm.subtitle')}</p>
      </div>

      {loading && streamers.length === 0 && <p className="mk-muted">⏳ {t('mk.loading')}</p>}

      <section className="strm-section">
        <h2 className="strm-sec-title live">
          <span className="strm-dot" /> {t('strm.online')} <span className="strm-count">{online.length}</span>
        </h2>
        {online.length > 0 ? (
          <div className="strm-grid">{online.map((s) => <Card key={s.id} s={s} t={t} />)}</div>
        ) : (
          !loading && <p className="mk-muted">{t('strm.none')}</p>
        )}
      </section>

      {offline.length > 0 && (
        <section className="strm-section">
          <h2 className="strm-sec-title">{t('strm.offline')} <span className="strm-count">{offline.length}</span></h2>
          <div className="strm-grid">{offline.map((s) => <Card key={s.id} s={s} t={t} />)}</div>
        </section>
      )}
    </div>
  );
}
