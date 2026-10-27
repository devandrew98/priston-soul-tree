// Public, read-only page of a clan formation (pristonzone.com/formacao/<token>): no login, nothing can be changed here.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { buildFormation } from '../../lib/clan/formation';
import { getClanRepo, type ShareView } from '../../lib/clan/repo';
import { Loading } from '../Loading';
import { FormationBoard } from './FormationBoard';

const TXT = {
  title: { pt: 'Formação do Bless Castle', en: 'Bless Castle Formation' },
  notFound: { pt: 'Este link não existe mais. Peça um novo ao líder do clã.', en: 'This link no longer exists. Ask the clan leader for a new one.' },
  error: { pt: 'Não foi possível carregar a formação. Tente de novo.', en: 'Could not load the formation. Try again.' },
  home: { pt: 'Ir para o PristonZONE', en: 'Go to PristonZONE' },
} as const;

export function ClanSharePage({ token }: { token: string }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; view: ShareView | null }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getClanRepo().viewShare(token)
      .then((view) => { if (!cancelled) setState({ status: 'ready', view }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
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
      {view && <FormationBoard formation={formation} confirmedCount={confirmed.length} />}
      <p className="cl-public-foot"><a href="/">{T('home')}</a></p>
    </div>
  );
}
