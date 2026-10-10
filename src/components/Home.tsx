import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { OVERLAY_KEY, downloadUrl, fetchAppDownload } from '../lib/market/downloads';
import { NewsFeed } from './NewsFeed';

const PIX_KEY = 'aed0ca9e-6f45-4f9c-9370-460bc85b438e';

/** Simplified PIX-style diamond mark. */
function PixMark() {
  return (
    <svg className="home-pix-mark" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="22" y="22" width="56" height="56" rx="10" transform="rotate(45 50 50)" fill="#32BCAD" />
      <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M31 36 H37 Q41 36 44 39 L50 45 L56 39 Q59 36 63 36 H69" />
        <path d="M31 64 H37 Q41 64 44 61 L50 55 L56 61 Q59 64 63 64 H69" />
        <path d="M36 43 L43 50 L36 57" />
        <path d="M64 43 L57 50 L64 57" />
      </g>
    </svg>
  );
}

export function Home() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyKey = () => {
    navigator.clipboard?.writeText(PIX_KEY);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const [href, setHref] = useState('');
  const [filename, setFilename] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchAppDownload(OVERLAY_KEY).then((d) => {
      if (cancelled || !d) return;
      setHref(downloadUrl(d.path));
      setFilename(d.filename);
      setNotes(d.notes ?? '');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home">
      <header className="home-hero">
        <div className="home-hero-top">
          <img src="/pristonzone-logo.png" alt="PristonZONE" className="home-logo" />
          <aside className="home-pix">
            <div className="home-pix-head">
              <PixMark />
              <b>{t('home.pix.title')}</b>
            </div>
            <p>{t('home.pix.body')}</p>
            <div className="home-pix-key">
              <span>{t('home.pix.keylabel')}</span>
              <code>{PIX_KEY}</code>
              <button type="button" className="mk-btn sm" onClick={copyKey}>{copied ? `✅ ${t('home.pix.copied')}` : `📋 ${t('home.pix.copy')}`}</button>
            </div>
          </aside>
        </div>
        <h1 className="home-welcome-title">{t('home.welcome.title')}</h1>
        <p className="home-welcome-body">{t('home.welcome.body')}</p>
      </header>

      {href && (
        <div className="home-download-row">
          <a className="home-download" href={href} download={filename} title={t('home.download.hint')}>
            <img src="/overlay-download.png" alt={t('home.download.alt')} />
          </a>
          {notes && (
            <div className="home-download-notes">
              <h3>{t('home.download.notes.title')}</h3>
              <p>{notes}</p>
            </div>
          )}
        </div>
      )}

      <NewsFeed />

      <footer className="home-credits">
        {t('home.credits', { a: 'HaDDeR', b: 'CommitaoDourado' })}
      </footer>
    </div>
  );
}
