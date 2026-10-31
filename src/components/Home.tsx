import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { OVERLAY_KEY, downloadUrl, fetchAppDownload } from '../lib/market/downloads';
import { NewsFeed } from './NewsFeed';
import { RichText } from './RichText';
import { pixPayload } from '../lib/pix';
import { useHomeTexts } from '../lib/market/homeTexts';
import { trackEvent } from '../lib/analytics';

const PIX_KEY = 'aed0ca9e-6f45-4f9c-9370-460bc85b438e';
const PIX_CODE = pixPayload({ key: PIX_KEY, name: 'PristonZONE', city: 'Brasil' });

/** The Pix code as a QR image. The QR library loads only when this is shown. */
function PixQr({ alt }: { alt: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('qrcode')
      .then((m) => m.toDataURL(PIX_CODE, { errorCorrectionLevel: 'M', margin: 2, width: 240 }))
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return src ? <img className="home-pix-qr" src={src} alt={alt} width={160} height={160} /> : null;
}

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
  const ht = useHomeTexts();
  const [copied, setCopied] = useState<'' | 'key' | 'code'>('');
  const copy = (what: 'key' | 'code') => {
    navigator.clipboard?.writeText(what === 'key' ? PIX_KEY : PIX_CODE);
    setCopied(what);
    window.setTimeout(() => setCopied(''), 2000);
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
          <div className="home-logo-frame">
            <img src="/pristonzone-logo.png" alt="PristonZONE" className="home-logo" />
          </div>
          {ht.shown('pix') && <aside className="home-pix">
            <div className="home-pix-head">
              <PixMark />
              <b>{ht.text('pix', 'title', t('home.pix.title'))}</b>
            </div>
            <RichText source={ht.text('pix', 'body', t('home.pix.body'))} />
            <div className="home-pix-pay">
              <div className="home-pix-qrbox">
                <PixQr alt={t('home.pix.qr.alt')} />
                <small>{t('home.pix.qr.hint')}</small>
              </div>
              <div className="home-pix-key">
                <span>{t('home.pix.keylabel')}</span>
                <code>{PIX_KEY}</code>
                <div className="home-pix-btns">
                  <button type="button" className="mk-btn sm" onClick={() => copy('key')}>{copied === 'key' ? t('home.pix.copied') : t('home.pix.copy')}</button>
                  <button type="button" className="mk-btn sm" onClick={() => copy('code')}>{copied === 'code' ? t('home.pix.copied') : t('home.pix.copycode')}</button>
                </div>
              </div>
            </div>
          </aside>}
        </div>
        {ht.shown('welcome') && <>
          <h1 className="home-welcome-title">{ht.text('welcome', 'title', t('home.welcome.title'))}</h1>
          <RichText className="home-welcome-body" source={ht.text('welcome', 'body', t('home.welcome.body'))} />
        </>}
      </header>

      {href && (
        <div className="home-download-row">
          <a className="home-download" href={href} download={filename} title={t('home.download.hint')} onClick={() => trackEvent('home:download_overlay')}>
            <img src="/overlay-download.png" alt={t('home.download.alt')} />
          </a>
          {notes && (
            <div className="home-download-notes">
              <h3>{t('home.download.notes.title')}</h3>
              <RichText source={notes} />
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
