// An announcement window shown on top of the Home when the site is opened (inside the page, not a browser popup, so nothing blocks it).
// The visitor has to close it (with the X, or Esc) to use the site; once closed it stays closed for the rest of the visit (this browser tab).
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics';
import { remaining } from '../lib/countdown';
import { useI18n } from '../lib/i18n';

const SEEN_KEY = 'pz-home-popup-nova-temporada';
const IMAGE = '/events/nova-temporada.webp';

const TXT = {
  alt: { pt: 'PristonTale EU Invasion: Nova Temporada, 27 de novembro, sexta-feira, às 15h', en: 'PristonTale EU Invasion: New Season, November 27th, Friday, 3 PM' },
  close: { pt: 'Fechar', en: 'Close' },
  title: { pt: 'Aviso', en: 'Notice' },
  left: { pt: 'Faltam', en: 'Time left' },
  started: { pt: 'A nova temporada começou!', en: 'The new season has started!' },
  unit: {
    days: { pt: ['dia', 'dias'], en: ['day', 'days'] },
    hours: { pt: ['hora', 'horas'], en: ['hour', 'hours'] },
    minutes: { pt: ['minuto', 'minutos'], en: ['minute', 'minutes'] },
    seconds: { pt: ['segundo', 'segundos'], en: ['second', 'seconds'] },
  },
} as const;

const wasSeen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };

/** Faltam 12 dias 03 horas 05 minutos 09 segundos: ticks every second until the launch (15:00 Brasília, 27 November). */
function Countdown({ lang }: { lang: 'pt' | 'en' }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const r = remaining(now);
  if (r.done) return <div className="hp-count done" role="status">{TXT.started[lang]}</div>;
  const cells = [['days', r.days], ['hours', r.hours], ['minutes', r.minutes], ['seconds', r.seconds]] as const;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="hp-count" role="timer" aria-label={cells.map(([k, v]) => `${v} ${TXT.unit[k][lang][v === 1 ? 0 : 1]}`).join(' ')}>
      <span className="hp-count-label">{TXT.left[lang]}</span>
      {cells.map(([k, v]) => (
        <span key={k} className="hp-count-cell" aria-hidden="true">
          <b>{pad(v)}</b>
          <small>{TXT.unit[k][lang][v === 1 ? 0 : 1]}</small>
        </span>
      ))}
    </div>
  );
}

export function HomePopup() {
  const { lang } = useI18n();
  const [open, setOpen] = useState(() => !wasSeen());
  const closeBtn = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    trackEvent('home:popup_close');
  };

  // While it is open: Esc closes, the page behind does not scroll, and focus starts on the close button.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="hp-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="hp-win" role="dialog" aria-modal="true" aria-label={TXT.title[lang]}>
        <button type="button" ref={closeBtn} className="hp-x" onClick={close} aria-label={TXT.close[lang]} title={TXT.close[lang]}>✕</button>
        <img className="hp-img" src={IMAGE} alt={TXT.alt[lang]} decoding="async" />
        <Countdown lang={lang} />
      </div>
    </div>
  );
}
