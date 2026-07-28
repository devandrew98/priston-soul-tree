import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { OVERLAY_KEY, downloadUrl, fetchAppDownload } from '../lib/market/downloads';
import { NewsFeed } from './NewsFeed';

// Fallback used until an admin uploads an installer to Storage.
const FALLBACK_HREF = '/PristonZone-Timer-Boss.exe';
const FALLBACK_NAME = 'PristonZone Timer Boss.exe';

export function Home() {
  const { t } = useI18n();
  const [href, setHref] = useState(FALLBACK_HREF);
  const [filename, setFilename] = useState(FALLBACK_NAME);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchAppDownload(OVERLAY_KEY).then((d) => {
      if (cancelled || !d) return;
      setHref(downloadUrl(d.path));
      setFilename(d.filename);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home">
      <header className="home-hero">
        <img src="/pristonzone-logo.png" alt="PristonZONE" className="home-logo" />
        <h1 className="home-welcome-title">{t('home.welcome.title')}</h1>
        <p className="home-welcome-body">{t('home.welcome.body')}</p>
      </header>

      <a className="home-download" href={href} download={filename} title={t('home.download.hint')}>
        <img src="/overlay-download.png" alt={t('home.download.alt')} />
      </a>

      <NewsFeed />

      <footer className="home-credits">
        {t('home.credits', { a: 'HaDDeR', b: 'CommitaoDourado' })}
      </footer>
    </div>
  );
}
