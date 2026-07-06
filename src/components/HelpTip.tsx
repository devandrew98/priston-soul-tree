import { useState } from 'react';
import { useI18n } from '../lib/i18n';

/** A small "?" that reveals an explanation only when clicked (opt-in help). */
export function HelpTip({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <span className="helptip">
      <button
        type="button"
        className="helptip-btn"
        aria-label={t('st.aria.help')}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
      >
        ?
      </button>
      {open && (
        <span className="helptip-pop" onClick={(e) => e.stopPropagation()}>
          {text}
          <button className="helptip-close" onClick={() => setOpen(false)} aria-label={t('st.aria.close')}>✕</button>
        </span>
      )}
    </span>
  );
}
