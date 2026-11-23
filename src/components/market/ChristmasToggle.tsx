// Admin (Global): switch the Christmas decoration off/on. It also turns itself on and off by date (15 Nov – 6 Jan); this only forces it off.
import { useEffect, useState } from 'react';
import { CHRISTMAS_EVENT, CHRISTMAS_FLAG, isChristmasSeason } from '../../lib/christmas';
import { fetchSiteFlag, setSiteFlag } from '../../lib/market/siteSettings';
import { Loading } from '../Loading';

export function ChristmasToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const season = isChristmasSeason();

  useEffect(() => { fetchSiteFlag(CHRISTMAS_FLAG).then(setOn).catch(() => setOn(true)); }, []);

  const flip = async () => {
    if (on === null) return;
    const next = !on;
    setBusy(true); setErr('');
    try {
      await setSiteFlag(CHRISTMAS_FLAG, next);
      setOn(next);
      window.dispatchEvent(new CustomEvent(CHRISTMAS_EVENT, { detail: next }));
    } catch (e) { setErr(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mk-mktoggle">
      <div className="mk-mktoggle-info">
        <b>🎄 Tema de Natal</b>
        <p className="mk-muted">Neve, pisca-pisca no menu, gorro no logo e uma mensagem no rodapé da Home. Liga sozinho de 15/11 a 06/01; aqui você pode desligar antes.</p>
        {on !== null && (
          <span className={`mk-mktoggle-status ${on && season ? 'on' : 'off'}`}>
            {!season ? '🗓️ Fora da época (aparece de 15/11 a 06/01)' : on ? '✅ Ligado — visível para todos' : '⛔ Desligado'}
          </span>
        )}
        {err && <span className="mk-warn" role="alert">{err}</span>}
      </div>
      {on === null ? <Loading inline /> : (
        <button type="button" className={`mk-btn ${on ? 'danger' : 'primary'}`} disabled={busy} onClick={flip}>
          {on ? '⛔ Desligar o tema' : '✅ Ligar o tema'}
        </button>
      )}
    </div>
  );
}
