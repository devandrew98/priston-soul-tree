// Administrator only: every clan at a glance (leader, members, confirmed, last activity). Click a clan to open it below.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { relativeDays } from '../../lib/clan/dates';
import { getClanRepo, type ClanOverview as Row } from '../../lib/clan/repo';

const TXT = {
  title: { pt: 'Visão geral dos clãs', en: 'Clans overview' },
  clan: { pt: 'Clã', en: 'Clan' },
  leader: { pt: 'Líder', en: 'Leader' },
  vices: { pt: 'Vices', en: 'Vices' },
  members: { pt: 'Membros', en: 'Members' },
  confirmed: { pt: 'Confirmados', en: 'Confirmed' },
  last: { pt: 'Última atividade', en: 'Last activity' },
  none: { pt: 'sem líder', en: 'no leader' },
  error: { pt: 'Não foi possível carregar a visão geral.', en: 'Could not load the overview.' },
} as const;

export function ClanOverview({ selectedId, onPick, version }: { selectedId: string | null; onPick: (clanId: string) => void; version: number }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClanRepo().overview().then((r) => { if (!cancelled) { setRows(r); setFailed(false); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [version]);

  if (failed) return <p className="ag-warning" role="alert">{T('error')}</p>;
  if (!rows || rows.length === 0) return null;
  const now = Date.now();
  return (
    <div className="cl-overview">
      <h4>{T('title')}</h4>
      <table className="ag-table">
        <thead><tr><th>{T('clan')}</th><th>{T('leader')}</th><th>{T('vices')}</th><th>{T('members')}</th><th>{T('confirmed')}</th><th>{T('last')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.clanId} className={r.clanId === selectedId ? 'on' : ''}>
              <td><button type="button" className="cl-linkbtn" onClick={() => onPick(r.clanId)}>{r.name}</button></td>
              <td>{r.leader ?? <span className="mk-muted">{T('none')}</span>}</td>
              <td>{r.vices}</td>
              <td>{r.members}</td>
              <td>{r.confirmed}</td>
              <td>{relativeDays(r.lastActivity, now, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
