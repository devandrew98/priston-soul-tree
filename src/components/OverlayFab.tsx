// A small floating button in the bottom-left corner of every page that opens the Overlay page (/overlay).
// Can be hidden for the rest of the visit with the ✕.
import { useState } from 'react';
import { trackEvent } from '../lib/analytics';
import { useI18n } from '../lib/i18n';

const HIDE_KEY = 'pz-overlay-fab-hidden';

const TXT = {
  label: { pt: 'Overlay PristonZONE', en: 'PristonZONE Overlay' },
  hint: { pt: 'Timers de boss na tela do jogo: veja como funciona e baixe', en: 'Boss timers on top of your game: see how it works and download' },
  tag: { pt: 'Download Overlay', en: 'Download Overlay' },
  hide: { pt: 'Esconder', en: 'Hide' },
} as const;

export function OverlayFab({ onOpen }: { onOpen: () => void }) {
  const { lang } = useI18n();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;

  const hide = () => { setHidden(true); try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } };

  return (
    <div className="ovfab">
      <button type="button" className="ovfab-main" title={TXT.hint[lang]} aria-label={TXT.label[lang]} onClick={() => { trackEvent('overlay:fab'); onOpen(); }}>
        <img src="/overlay/icone.png" alt="" />
        <span className="ovfab-tag">{TXT.tag[lang]}</span>
      </button>
      <button type="button" className="ovfab-x" onClick={hide} title={TXT.hide[lang]} aria-label={TXT.hide[lang]}>✕</button>
    </div>
  );
}
