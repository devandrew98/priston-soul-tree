// Attendance history of the Bless Castle (discreet: closed until the leader opens it).
// The leader registers the BC that is set on the board with the members confirmed at that moment; the list shows, in
// alphabetical order, how many BCs each member took part in and, opening a member, which ones.
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { attendanceRows, type AttendanceEvent } from '../../lib/clan/attendance';
import { bcSaturdays, formatBc, formatShort } from '../../lib/clan/dates';
import { getClanRepo, type Clan, type ClanMember } from '../../lib/clan/repo';

const TXT = {
  title: { pt: 'Histórico de presença', en: 'Attendance history' },
  hint: { pt: 'Registre o BC depois que ele acontecer (sábado ao meio-dia): os membros confirmados naquele momento contam como presentes.', en: 'Register the BC after it happens (Saturday at noon): the members confirmed at that moment count as present.' },
  register: { pt: 'Registrar presença deste BC', en: 'Register attendance for this BC' },
  update: { pt: 'Atualizar presença deste BC', en: 'Update attendance for this BC' },
  willRegister: { pt: 'BC de', en: 'BC of' },
  present: { pt: 'presentes', en: 'present' },
  registered: { pt: 'Presença registrada', en: 'Attendance registered' },
  uncheck: { pt: 'Desmarcar todos os confirmados (para o próximo BC)', en: 'Uncheck everyone (for the next BC)' },
  members: { pt: 'Membros (ordem alfabética)', en: 'Members (alphabetical)' },
  times: { pt: 'BCs', en: 'BCs' },
  never: { pt: 'Nenhum BC registrado ainda.', en: 'No BC registered yet.' },
  events: { pt: 'BCs registrados', en: 'Registered BCs' },
  remove: { pt: 'Remover este registro', en: 'Remove this record' },
  removeAsk: { pt: 'Remover?', en: 'Remove?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
  error: { pt: 'Não foi possível concluir. Tente de novo.', en: 'Could not finish. Try again.' },
  loadError: { pt: 'Não foi possível carregar o histórico.', en: 'Could not load the history.' },
  noMembers: { pt: 'Nenhum membro cadastrado.', en: 'No members yet.' },
} as const;

export function AttendancePanel({ clan, members, onUncheckAll }: { clan: Clan; members: ClanMember[]; onUncheckAll: () => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const [events, setEvents] = useState<AttendanceEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  const load = useCallback(() => {
    getClanRepo().listEvents(clan.id).then(setEvents).catch(() => setMsg({ kind: 'error', text: T('loadError') }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clan.id, lang]);

  const rows = useMemo(() => attendanceRows(members, events ?? []), [members, events]);
  const confirmedIds = members.filter((m) => m.confirmed).map((m) => m.id);
  // The BC to register is the one that already started: the most recent Saturday noon.
  const bcMs = bcSaturdays(Date.now()).last;
  const already = !!events?.some((e) => e.startsAt === bcMs);

  const register = () => {
    setMsg(null);
    getClanRepo().registerEvent(clan.id, new Date(bcMs).toISOString(), confirmedIds)
      .then(() => { setJustRegistered(true); setMsg({ kind: 'ok', text: `${T('registered')}: ${confirmedIds.length} ${T('present')}.` }); load(); })
      .catch(() => setMsg({ kind: 'error', text: T('error') }));
  };
  const removeEvent = (id: string) => {
    setRemoving(null);
    getClanRepo().deleteEvent(id).then(load).catch(() => setMsg({ kind: 'error', text: T('error') }));
  };

  return (
    <details className="sr-card cl-box cl-attendance" onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen(o); if (o && events === null) load(); }}>
      <summary>{T('title')}</summary>
      {open && (
        <div className="cl-att-body">
          <p className="mk-muted">{T('hint')}</p>
          <div className="cl-att-register">
            <span>{T('willRegister')} <b>{formatBc(bcMs, lang)}</b> · {confirmedIds.length} {T('present')}</span>
            <button type="button" className="mk-btn primary" onClick={register}>{already ? T('update') : T('register')}</button>
          </div>
          {msg && <p className={msg.kind === 'ok' ? 'cl-ok' : 'ag-warning'} role={msg.kind === 'ok' ? 'status' : 'alert'}>{msg.text}</p>}
          {justRegistered && confirmedIds.length > 0 && (
            <button type="button" className="mk-btn" onClick={() => { onUncheckAll(); setJustRegistered(false); }}>{T('uncheck')}</button>
          )}

          <h4>{T('members')}</h4>
          {members.length === 0 ? <p className="mk-muted">{T('noMembers')}</p> : (
            <ul className="cl-att-list">
              {rows.map((r) => (
                <li key={r.memberId}>
                  <button type="button" className="cl-att-row" aria-expanded={openMember === r.memberId} disabled={r.count === 0} onClick={() => setOpenMember(openMember === r.memberId ? null : r.memberId)}>
                    <b>{r.nick}</b>
                    <span className={`cl-att-count${r.count === 0 ? ' zero' : ''}`}>{r.count}</span>
                  </button>
                  {openMember === r.memberId && <p className="cl-att-dates">{r.dates.map((d) => formatShort(d, lang)).join(' · ')}</p>}
                </li>
              ))}
            </ul>
          )}

          <h4>{T('events')}</h4>
          {events && events.length === 0 ? <p className="mk-muted">{T('never')}</p> : (
            <ul className="cl-att-events">
              {(events ?? []).map((e) => (
                <li key={e.id}>
                  <span>{formatShort(e.startsAt, lang)} · {e.memberIds.length} {T('present')}</span>
                  {removing === e.id ? (
                    <span className="cl-confirm">
                      {T('removeAsk')}
                      <button type="button" className="mk-btn cl-danger" onClick={() => removeEvent(e.id)}>{T('yes')}</button>
                      <button type="button" className="mk-btn" onClick={() => setRemoving(null)}>{T('no')}</button>
                    </span>
                  ) : <button type="button" className="mk-btn cl-x" aria-label={T('remove')} title={T('remove')} onClick={() => setRemoving(e.id)}>✕</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}
