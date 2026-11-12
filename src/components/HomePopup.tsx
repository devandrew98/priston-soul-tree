// An announcement window shown on top of the Home when the site is opened (inside the page, not a browser popup, so nothing blocks it).
// The visitor has to close it (with the X, or Esc) to use the site; once closed it stays closed for the rest of the visit (this browser tab).
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics';
import { useI18n } from '../lib/i18n';

const SEEN_KEY = 'pz-home-popup-nova-temporada';
const IMAGE = '/events/nova-temporada.webp';

const TXT = {
  alt: { pt: 'PristonTale EU Invasion: Nova Temporada, 27 de novembro, sexta-feira, às 15h', en: 'PristonTale EU Invasion: New Season, November 27th, Friday, 3 PM' },
  close: { pt: 'Fechar', en: 'Close' },
  title: { pt: 'Aviso', en: 'Notice' },
} as const;

const wasSeen = () => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } };

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
      </div>
    </div>
  );
}
