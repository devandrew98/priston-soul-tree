// Public, read-only page of a clan formation (pristonzone.com/formacao/<token>): no login, nothing can be changed here.
// It re-reads the clan every few seconds, so what the leader changes (formation, note, map) shows up without reloading.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { buildFormation } from '../../lib/clan/formation';
import { MARKER_ICON, MARKER_TYPES } from '../../lib/clan/board';
import { getClanRepo, type ShareView } from '../../lib/clan/repo';
import { Loading } from '../Loading';
import { BlessMap } from './BlessMap';
import { FormationBoard } from './FormationBoard';

const REFRESH_MS = 3_000;

const TXT = {
  title: { pt: 'Formação do Bless Castle', en: 'Bless Castle Formation' },
  notFound: { pt: 'Este link não existe mais. Peça um novo ao líder do clã.', en: 'This link no longer exists. Ask the clan leader for a new one.' },
  error: { pt: 'Não foi possível carregar a formação. Tente de novo.', en: 'Could not load the formation. Try again.' },
  home: { pt: 'Ir para o PristonZONE', en: 'Go to PristonZONE' },
  note: { pt: 'Orientações do líder', en: 'Leader\'s instructions' },
  map: { pt: 'Mapa do Bless Castle', en: 'Bless Castle map' },
  live: { pt: 'Atualiza sozinho.', en: 'Updates by itself.' },
  types: {
    pt: { attack: 'Atacar', defend: 'Defender', rebuff: 'Rebuff', enemy: 'Inimigos' },
    en: { attack: 'Attack', defend: 'Defend', rebuff: 'Rebuff', enemy: 'Enemies' },
  },
} as const;

export function ClanSharePage({ token }: { token: string }) {
  const { lang } = useI18n();
  const T = (k: Exclude<keyof typeof TXT, 'types'>) => TXT[k][lang];
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
  const formation = useMemo(() => buildFormation(confirmed), [confirmed]);

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
          {view.board.note.trim() && (
            <section className="sr-card cl-box cl-notecard">
              <h3>📣 {T('note')}</h3>
              <p className="cl-notetext">{view.board.note}</p>
            </section>
          )}
          <FormationBoard formation={formation} confirmedCount={confirmed.length} />
          {view.board.markers.length > 0 && (
            <section className="sr-card cl-box">
              <h3>{T('map')}</h3>
              <div className="cl-legend">
                {MARKER_TYPES.filter((t) => view.board.markers.some((m) => m.type === t)).map((t) => <span key={t}>{MARKER_ICON[t]} {TXT.types[lang][t]}</span>)}
              </div>
              <div className="cl-mapcol cl-mappublic"><BlessMap markers={view.board.markers} /></div>
            </section>
          )}
        </>
      )}
      <p className="cl-public-foot">{view && <span className="mk-muted">{T('live')} </span>}<a href="/">{T('home')}</a></p>
    </div>
  );
}
