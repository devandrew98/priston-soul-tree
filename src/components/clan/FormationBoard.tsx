// The raids and parties of a formation. Used by the leader's tool (can change the party leader) and by the public share page (read only).
import { useI18n } from '../../lib/i18n';
import { BUFF_CLASSES, type Formation, type FormationMember, type Party, type PtClass } from '../../lib/clan/formation';

const TXT = {
  formation: { pt: 'Formações do Bless Castle', en: 'Bless Castle formations' },
  confirmedMembers: { pt: 'membros confirmados', en: 'confirmed members' },
  noFormation: { pt: 'Ainda não há membros confirmados.', en: 'No confirmed members yet.' },
  raid: { pt: 'Raid', en: 'Raid' },
  party: { pt: 'Grupo', en: 'Party' },
  buffs: { pt: 'buffs', en: 'buffs' },
  leader: { pt: 'Líder', en: 'Leader' },
  makeLeader: { pt: 'Tornar líder do grupo', en: 'Make party leader' },
  reserves: { pt: 'Reservas (passam de 24 confirmados)', en: 'Reserves (over 24 confirmed)' },
  missing: { pt: 'Faltam', en: 'Missing' },
} as const;

export const classIcon = (c: PtClass) => `/skilltree/classes/${c.toLowerCase()}.png`;

export function ClassTag({ cls }: { cls: PtClass }) {
  return <span className="cl-cls"><img src={classIcon(cls)} alt="" width={22} height={22} /> {cls}</span>;
}

type PartyMember = FormationMember & { partyLeader?: boolean };

function PartyBox({ index, party, onLeader }: { index: number; party: Party; onLeader?: (p: Party, m: FormationMember) => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const leaderId = (party.members as PartyMember[]).find((m) => m.partyLeader)?.id ?? party.members[0]?.id;
  // The leader is always shown at the top of the party.
  const ordered = [...party.members].sort((a, b) => Number(b.id === leaderId) - Number(a.id === leaderId));
  return (
    <div className="cl-party">
      <h4>{T('party')} {index} <span>{party.members.length}/6</span></h4>
      <ul>
        {ordered.map((m) => (
          <li key={m.id} className={m.id === leaderId ? 'lead' : ''}>
            <ClassTag cls={m.cls} />
            <b>{m.nick}</b>
            {m.id === leaderId
              ? <span className="cl-lead" title={T('leader')}>★ {T('leader')}</span>
              : onLeader && <button type="button" className="cl-star" title={T('makeLeader')} aria-label={T('makeLeader')} onClick={() => onLeader(party, m)}>☆</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormationBoard({ formation, confirmedCount, onLeader }: {
  formation: Formation; confirmedCount: number; onLeader?: (p: Party, m: FormationMember) => void;
}) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  return (
    <section className="sr-card cl-box">
      <div className="cl-fhead">
        <div><h3>{T('formation')}</h3><p className="mk-muted">{confirmedCount} {T('confirmedMembers')}</p></div>
      </div>
      {formation.raids.length === 0 ? <p className="sk-notice">{T('noFormation')}</p> : (
        <div className="cl-raids">
          {formation.raids.map((r, ri) => (
            <div key={ri} className="cl-raid">
              <div className="cl-raidhead">
                <h3>{T('raid')} {ri + 1}</h3>
                <span className={r.buffs.length === BUFF_CLASSES.length ? 'ok' : 'warn'}>{r.buffs.length}/{BUFF_CLASSES.length} {T('buffs')}</span>
              </div>
              <div className="cl-chips">
                {BUFF_CLASSES.map((c) => <span key={c} className={`cl-chip ${r.buffs.includes(c) ? '' : 'off'}`} title={r.buffs.includes(c) ? c : `${T('missing')}: ${c}`}><ClassTag cls={c} /></span>)}
              </div>
              <div className="cl-parties">
                {r.parties.map((p, pi) => <PartyBox key={pi} index={ri * 2 + pi + 1} party={p} onLeader={onLeader} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {formation.reserves.length > 0 && (
        <div className="cl-reserves">
          <h4>{T('reserves')} ({formation.reserves.length})</h4>
          <ul>{formation.reserves.map((m) => <li key={m.id}><ClassTag cls={m.cls} /> <b>{m.nick}</b></li>)}</ul>
        </div>
      )}
    </section>
  );
}
