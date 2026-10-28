// Public, read-only page of a clan formation (pristonzone.com/formacao/<token>): no login, nothing can be changed here.
// It re-reads the clan every few seconds, so what the leader changes (formation, note, map) shows up without reloading.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { arrangeFormation } from '../../lib/clan/formation';
import { MARKER_ICON, MARKER_TYPES, isNumberType } from '../../lib/clan/board';
import { bcSaturdays, countdown, formatBc } from '../../lib/clan/dates';
import { getClanRepo, type ShareView } from '../../lib/clan/repo';
import { Loading } from '../Loading';
import { BlessMap } from './BlessMap';
import { FormationBoard } from './FormationBoard';
import { markerName } from './markerNames';

const REFRESH_MS = 3_000;

const TXT = {
  title: { pt: 'Formação do Bless Castle', en: 'Bless Castle Formation' },
  notFound: { pt: 'Este link não existe mais. Peça um novo ao líder do clã.', en: 'This link no longer exists. Ask the clan leader for a new one.' },
  error: { pt: 'Não foi possível carregar a formação. Tente de novo.', en: 'Could not load the formation. Try again.' },
  home: { pt: 'Ir para o PristonZONE', en: 'Go to PristonZONE' },
  note: { pt: 'Orientações do líder', en: 'Leader\'s instructions' },
  map: { pt: 'Mapa do Bless Castle', en: 'Bless Castle map' },
  live: { pt: 'Atualiza sozinho.', en: 'Updates by itself.' },
  nextBc: { pt: 'Próximo Bless Castle', en: 'Next Bless Castle' },
  startsIn: { pt: 'começa em', en: 'starts in' },
  brt: { pt: 'Meio-dia no horário de Brasília', en: 'Noon, Brasília time' },
  order: { pt: 'Números 1–7: ordem', en: 'Numbers 1–7: order' },
} as const;

export function ClanSharePage({ token }: { token: string }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(id); }, []);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; view: ShareView | null }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = (first: boolean) => {
      getClanRepo().viewShare(token)
        .then((view) => { if (!cancelled) setState({ status: 'ready', view }); })
        .catch(() => { if (!cancelled && first) setState({ status: 'error' }); }); // a failed refresh keeps what is on screen
    };
    load(true);
    const id = window.setInterval(() => { if (!document.hidden) load(false); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(false); }; // coming back to the tab refreshes at once
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [token]);

  const view = state.status === 'ready' ? state.view : null;
  const confirmed = useMemo(() => (view ? [...view.members].sort((a, b) => a.createdAt - b.createdAt) : []), [view]);
  const formation = useMemo(() => arrangeFormation(confirmed.map((m) => ({ ...m, slot: m.partySlot }))), [confirmed]);

  return (
    <div className="cl-tool cl-public">
      <header className="sk-head">
        <h1 className="mk-h1">🏰 {T('title')}{view && <> · {view.clanName}</>}</h1>
      </header>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <p className="ag-warning" role="alert">{T('error')}</p>}
      {state.status === 'ready' && !view && <p className="sk-notice">{T('notFound')}</p>}
      {view && (
        <>
          <section className="sr-card cl-box cl-bccard">
            <h3>📅 {T('nextBc')}</h3>
            <p className="cl-bcdate">{formatBc(bcSaturdays(now).next, lang)}</p>
            <p className="mk-muted">{T('startsIn')} {countdown(bcSaturdays(now).next, now)} · {T('brt')}</p>
          </section>
          {view.board.note.trim() && (
            <section className="sr-card cl-box cl-notecard">
              <h3>📣 {T('note')}</h3>
              <p className="cl-notetext">{view.board.note}</p>
            </section>
          )}
          <FormationBoard formation={formation} confirmedCount={confirmed.length} />
          <section className="sr-card cl-box">
            <h3>{T('map')}</h3>
            <div className="cl-legend">
              {MARKER_TYPES.filter((t) => !isNumberType(t) && view.board.markers.some((m) => m.type === t)).map((t) => <span key={t}>{MARKER_ICON[t]} {markerName(t, lang)}</span>)}
              {view.board.markers.some((m) => isNumberType(m.type)) && <span>{T('order')}</span>}
            </div>
            <div className="cl-mapcol cl-mappublic"><BlessMap markers={view.board.markers} strokes={view.board.strokes} /></div>
          </section>
        </>
      )}
      <p className="cl-public-foot">{view && <span className="mk-muted">{T('live')} </span>}<a href="/">{T('home')}</a></p>
    </div>
  );
}
