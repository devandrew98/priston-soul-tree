import { useState } from 'react';

/** A small "?" that reveals an explanation only when clicked (opt-in help). */
export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="helptip">
      <button
        type="button"
        className="helptip-btn"
        aria-label="Ajuda"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
      >
        ?
      </button>
      {open && (
        <span className="helptip-pop" onClick={(e) => e.stopPropagation()}>
          {text}
          <button className="helptip-close" onClick={() => setOpen(false)} aria-label="Fechar">✕</button>
        </span>
      )}
    </span>
  );
}
