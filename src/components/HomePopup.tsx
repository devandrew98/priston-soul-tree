// An announcement window shown on top of the Home when the site is opened (inside the page, not a browser popup, so nothing blocks it).
// The visitor has to close it (with the X, or Esc) to use the site; once closed it stays closed for the rest of the visit (this browser tab).
import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../lib/analytics';
import { remaining } from '../lib/countdown';
import { useI18n } from '../lib/i18n';
import { BACKEND_ENABLED } from '../lib/market/supabase';
import { pollShares, type PollRow } from '../lib/poll';
import { fetchPoll, hasVoted, sendVote } from '../lib/pollApi';
import { getSkillClass } from '../lib/skilltree/classes';
import { CLASS_SLUGS, type ClassSlug } from '../lib/skilltree/types';

const SEEN_KEY = 'pz-home-popup-nova-temporada';

const TXT = {
  close: { pt: 'Fechar', en: 'Close' },
  title: { pt: 'Aviso', en: 'Notice' },
  left: { pt: 'Faltam', en: 'Time left' },
  until: { pt: 'para a temporada!', en: 'until the season!' },
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
      <span className="hp-count-label hp-count-until">{TXT.until[lang]}</span>
    </div>
  );
}

const POLL_TXT = {
  question: { pt: 'Com qual classe você vai jogar a temporada 13?', en: 'Which class will you play in season 13?' },
  thanks: { pt: 'Obrigado pelo voto!', en: 'Thanks for voting!' },
  votes: { pt: ['voto', 'votos'], en: ['vote', 'votes'] },
  error: { pt: 'Não foi possível votar agora. Tente de novo.', en: 'Could not vote right now. Try again.' },
  limit: { pt: 'Já há votos demais vindos desta rede.', en: 'Too many votes already came from this network.' },
  mine: { pt: 'seu voto', en: 'your vote' },
} as const;

/** One vote per browser; the bars show up as soon as the visitor has voted. */
function SeasonPoll({ lang }: { lang: 'pt' | 'en' }) {
  const [rows, setRows] = useState<PollRow[] | null>(null); // null = not voted yet
  const [busy, setBusy] = useState<ClassSlug | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!BACKEND_ENABLED || !hasVoted()) return;
    let cancelled = false;
    fetchPoll().then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!BACKEND_ENABLED) return null;

  const vote = async (cls: ClassSlug) => {
    if (busy) return;
    setBusy(cls); setError('');
    try {
      setRows(await sendVote(cls));
      trackEvent('home:poll_vote');
    } catch (e) {
      setError(/limite/i.test((e as { message?: string })?.message ?? '') ? POLL_TXT.limit[lang] : POLL_TXT.error[lang]);
    } finally {
      setBusy(null);
    }
  };

  if (!rows) {
    return (
      <section className="hp-poll" aria-label={POLL_TXT.question[lang]}>
        <h3 className="hp-poll-q">{POLL_TXT.question[lang]}</h3>
        <div className="hp-poll-opts">
          {CLASS_SLUGS.map((c) => (
            <button key={c} type="button" className="hp-poll-opt" disabled={!!busy} onClick={() => void vote(c)}>{getSkillClass(c).name}</button>
          ))}
        </div>
        {error && <p className="hp-poll-err" role="alert">{error}</p>}
      </section>
    );
  }

  const { total, shares } = pollShares(rows);
  return (
    <section className="hp-poll" aria-label={POLL_TXT.question[lang]}>
      <h3 className="hp-poll-q">{POLL_TXT.question[lang]} <small>· {POLL_TXT.thanks[lang]}</small></h3>
      <ol className="hp-poll-res">
        {shares.map((s) => (
          <li key={s.cls} className={`${s.mine ? 'mine' : ''} ${s.leader ? 'lead' : ''}`}>
            <span className="hp-poll-name">{getSkillClass(s.cls).name}{s.mine && <i title={POLL_TXT.mine[lang]}> ✓</i>}</span>
            <span className="hp-poll-bar"><span style={{ width: `${s.pct}%` }} /></span>
            <span className="hp-poll-pct">{s.pct}%</span>
          </li>
        ))}
      </ol>
      <p className="hp-poll-total">{total} {POLL_TXT.votes[lang][total === 1 ? 0 : 1]}</p>
    </section>
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
        <SeasonPoll lang={lang} />
        <Countdown lang={lang} />
      </div>
    </div>
  );
}
