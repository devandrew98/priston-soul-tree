// The raids and parties of a formation. Used by the leader's tool and by the public share page (read only).
// In the leader's tool a player can be moved to another party/raid (or to the reserves): drag and drop, or tap the player and
// then the party. A full party (6/6) refuses a move and says so; dropping on a player of that party swaps the two.
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  BUFF_CLASSES, PARTIES_PER_RAID, PARTY_SIZE, SLOT_RESERVE, slotsOf,
  type Formation, type FormationMember, type Party, type PtClass,
} from '../../lib/clan/formation';

const TXT = {
  formation: { pt: 'Formações do Bless Castle', en: 'Bless Castle formations' },
  confirmedMembers: { pt: 'membros confirmados', en: 'confirmed members' },
  noFormation: { pt: 'Ainda não há membros confirmados.', en: 'No confirmed members yet.' },
  raid: { pt: 'Raid', en: 'Raid' },
  party: { pt: 'Grupo', en: 'Party' },
  buffs: { pt: 'buffs', en: 'buffs' },
  leader: { pt: 'Líder', en: 'Leader' },
  makeLeader: { pt: 'Tornar líder do grupo', en: 'Make party leader' },
  reserves: { pt: 'Reservas', en: 'Reserves' },
  reservesHint: { pt: 'Fora da formação. Arraste um jogador para cá para tirá-lo, ou para um grupo para colocá-lo.', en: 'Out of the formation. Drag a player here to bench them, or onto a party to place them.' },
  missing: { pt: 'Faltam', en: 'Missing' },
  full: { pt: 'Cheio', en: 'Full' },
  dragHint: { pt: 'Para mudar um jogador de grupo ou raid, arraste-o até o grupo (ou toque nele e depois no grupo).', en: 'To move a player to another party or raid, drag them onto the party (or tap them and then the party).' },
  selected: { pt: 'Selecionado', en: 'Selected' },
  selectedHint: { pt: 'Toque em um grupo para mover, ou em outro jogador para trocar de lugar.', en: 'Tap a party to move, or another player to swap places.' },
  cancel: { pt: 'Cancelar', en: 'Cancel' },
  moveHere: { pt: 'Mover para cá', en: 'Move here' },
  fullTap: { pt: 'Cheio (6/6): toque num jogador daqui para trocar', en: 'Full (6/6): tap a player here to swap' },
  toReserves: { pt: 'Mandar para as reservas', en: 'Send to the reserves' },
  fullMsg: { pt: 'está cheio (6/6). Solte sobre um jogador para trocar de lugar, ou tire alguém de lá primeiro.', en: 'is full (6/6). Drop onto a player to swap places, or move someone out first.' },
  manual: { pt: 'Formação ajustada manualmente.', en: 'Formation adjusted by hand.' },
  resetAuto: { pt: 'Refazer automático', en: 'Redo automatically' },
} as const;
type Tk = keyof typeof TXT;

export const classIcon = (c: PtClass) => `/skilltree/classes/${c.toLowerCase()}.png`;

export function ClassTag({ cls }: { cls: PtClass }) {
  return <span className="cl-cls"><img src={classIcon(cls)} alt="" width={22} height={22} /> {cls}</span>;
}

type PartyMember = FormationMember & { partyLeader?: boolean };

interface Props {
  formation: Formation;
  confirmedCount: number;
  onLeader?: (p: Party, m: FormationMember) => void;
  /** Leader's tool only: move `id` to `target` (a party 0-3 or SLOT_RESERVE); `swapWith` goes to the place `id` leaves. */
  onMove?: (id: string, target: number, swapWith?: string) => void;
  /** True when some players were placed by hand; shows the "redo automatically" button. */
  manual?: boolean;
  onResetAuto?: () => void;
}

export function FormationBoard({ formation, confirmedCount, onLeader, onMove, manual, onResetAuto }: Props) {
  const { lang } = useI18n();
  const T = (k: Tk) => TXT[k][lang];
  const editable = !!onMove;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const slots = useMemo(() => slotsOf(formation), [formation]);
  const nicks = useMemo(() => new Map([...formation.raids.flatMap((r) => r.parties.flatMap((p) => p.members)), ...formation.reserves].map((m) => [m.id, m.nick])), [formation]);
  const selected = selectedId && slots.has(selectedId) ? selectedId : null;

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const sizeOf = (slot: number) => formation.raids[Math.floor(slot / PARTIES_PER_RAID)].parties[slot % PARTIES_PER_RAID].members.length;
  const partyName = (slot: number) => `${T('party')} ${slot + 1}`;

  const move = (id: string, target: number) => {
    const from = slots.get(id);
    if (from === undefined || from === target) return;
    if (target !== SLOT_RESERVE && sizeOf(target) >= PARTY_SIZE) { setNotice(`${partyName(target)} ${T('fullMsg')}`); return; }
    onMove!(id, target);
    setSelectedId(null);
  };
  const swap = (a: string, b: string) => {
    const fa = slots.get(a), fb = slots.get(b);
    if (fa === undefined || fb === undefined || fa === fb) return;
    onMove!(a, fb, b);
    setSelectedId(null);
  };

  const endDrag = () => { setDragId(null); setOverSlot(null); };
  const dropOnSlot = (e: React.DragEvent, slot: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    endDrag();
    if (id) move(id, slot);
  };
  const dropOnMember = (e: React.DragEvent, m: FormationMember) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    endDrag();
    if (!id || id === m.id) return;
    if (slots.get(id) === slots.get(m.id)) return;
    swap(id, m.id);
  };
  const allowDrop = (e: React.DragEvent, slot: number) => {
    if (!dragId) return;
    e.preventDefault();
    if (overSlot !== slot) setOverSlot(slot);
  };

  const memberRow = (m: FormationMember, slot: number, leaderId: string | undefined, party?: Party) => {
    const isLeader = m.id === leaderId;
    return (
      <li
        key={m.id}
        className={`${isLeader ? 'lead' : ''}${m.id === selected ? ' sel' : ''}${m.id === dragId ? ' dragging' : ''}${editable ? ' movable' : ''}`}
        draggable={editable}
        onDragStart={editable ? (e) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'move'; setDragId(m.id); setSelectedId(null); } : undefined}
        onDragEnd={editable ? endDrag : undefined}
        onDragOver={editable ? (e) => allowDrop(e, slot) : undefined}
        onDrop={editable ? (e) => dropOnMember(e, m) : undefined}
        onClick={editable ? () => {
          if (selected && selected !== m.id && slots.get(selected) !== slot) swap(selected, m.id);
          else setSelectedId(selected === m.id ? null : m.id);
        } : undefined}
      >
        <ClassTag cls={m.cls} />
        <b>{m.nick}</b>
        {party && (isLeader
          ? <span className="cl-lead" title={T('leader')}>★ {T('leader')}</span>
          : onLeader && <button type="button" className="cl-star" title={T('makeLeader')} aria-label={T('makeLeader')} onClick={(e) => { e.stopPropagation(); onLeader(party, m); }}>☆</button>)}
      </li>
    );
  };

  const partyBox = (slot: number, party: Party) => {
    const leaderId = (party.members as PartyMember[]).find((m) => m.partyLeader)?.id ?? party.members[0]?.id;
    // The leader is always shown at the top of the party.
    const ordered = [...party.members].sort((a, b) => Number(b.id === leaderId) - Number(a.id === leaderId));
    const size = party.members.length;
    const isFull = size >= PARTY_SIZE;
    const holdsDragged = !!dragId && slots.get(dragId) === slot;
    const hover = editable && overSlot === slot && !!dragId && !holdsDragged ? (isFull ? ' over-full' : ' over-ok') : '';
    const canReceive = editable && selected !== null && slots.get(selected) !== slot;
    return (
      <div
        key={slot}
        className={`cl-party${hover}`}
        onDragOver={editable ? (e) => allowDrop(e, slot) : undefined}
        onDragLeave={editable ? () => { if (overSlot === slot) setOverSlot(null); } : undefined}
        onDrop={editable ? (e) => dropOnSlot(e, slot) : undefined}
      >
        <h4>{partyName(slot)} <span className={isFull ? 'full' : ''}>{size}/{PARTY_SIZE}{isFull && ` · ${T('full')}`}</span></h4>
        {canReceive && (isFull
          ? <p className="cl-fulltap">{T('fullTap')}</p>
          : <button type="button" className="mk-btn primary cl-movehere" onClick={() => move(selected!, slot)}>{T('moveHere')} → {nicks.get(selected!)}</button>)}
        <ul>
          {ordered.map((m) => memberRow(m, slot, leaderId, party))}
          {editable && size === 0 && <li className="cl-emptyslot">—</li>}
        </ul>
      </div>
    );
  };

  const visibleRaids = formation.raids
    .map((r, ri) => ({ r, ri }))
    .filter(({ r }) => editable || r.parties.some((p) => p.members.length > 0));
  const showReserves = editable || formation.reserves.length > 0;

  return (
    <section className="sr-card cl-box">
      <div className="cl-fhead">
        <div><h3>{T('formation')}</h3><p className="mk-muted">{confirmedCount} {T('confirmedMembers')}</p></div>
      </div>
      {editable && <p className="mk-muted cl-draghint">{T('dragHint')}</p>}
      {editable && manual && (
        <p className="cl-manual">✋ {T('manual')} {onResetAuto && <button type="button" className="mk-btn" onClick={onResetAuto}>{T('resetAuto')}</button>}</p>
      )}
      {notice && <p className="ag-warning" role="alert">{notice}</p>}
      {selected && (
        <div className="cl-selbar" role="status">
          <span>{T('selected')}: <b>{nicks.get(selected)}</b> · {T('selectedHint')}</span>
          <button type="button" className="mk-btn" onClick={() => setSelectedId(null)}>{T('cancel')}</button>
        </div>
      )}
      {visibleRaids.length === 0 ? <p className="sk-notice">{T('noFormation')}</p> : (
        <div className="cl-raids">
          {visibleRaids.map(({ r, ri }) => (
            <div key={ri} className="cl-raid">
              <div className="cl-raidhead">
                <h3>{T('raid')} {ri + 1}</h3>
                <span className={r.buffs.length === BUFF_CLASSES.length ? 'ok' : 'warn'}>{r.buffs.length}/{BUFF_CLASSES.length} {T('buffs')}</span>
              </div>
              <div className="cl-chips">
                {BUFF_CLASSES.map((c) => <span key={c} className={`cl-chip ${r.buffs.includes(c) ? '' : 'off'}`} title={r.buffs.includes(c) ? c : `${T('missing')}: ${c}`}><ClassTag cls={c} /></span>)}
              </div>
              <div className="cl-parties">
                {r.parties.map((p, pi) => partyBox(ri * PARTIES_PER_RAID + pi, p))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showReserves && (
        <div
          className={`cl-reserves${editable && overSlot === SLOT_RESERVE && dragId ? ' over-ok' : ''}`}
          onDragOver={editable ? (e) => allowDrop(e, SLOT_RESERVE) : undefined}
          onDragLeave={editable ? () => { if (overSlot === SLOT_RESERVE) setOverSlot(null); } : undefined}
          onDrop={editable ? (e) => dropOnSlot(e, SLOT_RESERVE) : undefined}
        >
          <h4>{T('reserves')} ({formation.reserves.length})</h4>
          {editable && <p className="mk-muted">{T('reservesHint')}</p>}
          {editable && selected !== null && slots.get(selected) !== SLOT_RESERVE && (
            <button type="button" className="mk-btn" onClick={() => move(selected, SLOT_RESERVE)}>{T('toReserves')} → {nicks.get(selected)}</button>
          )}
          <ul>{formation.reserves.map((m) => memberRow(m, SLOT_RESERVE, undefined))}</ul>
        </div>
      )}
    </section>
  );
}
