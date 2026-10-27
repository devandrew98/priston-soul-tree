// Bless Castle formation for clan leaders: add the members, mark who is confirmed and the parties/raids are built automatically.
// Access: the admin (every clan) and the leader/vice of a clan (only their own). The rules are enforced by the database.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { requestLogin } from '../../lib/builds/account';
import { BUFF_CLASSES, PT_CLASSES, buildFormation, type FormationMember, type Party, type PtClass } from '../../lib/clan/formation';
import { ClanUnavailableError, CLAN_FAKE, getClanRepo, type Clan, type ClanMember, type StaffEntry } from '../../lib/clan/repo';
import { useAuth } from '../market/store';
import { Loading } from '../Loading';
import { useClanAccess } from './useClanAccess';

const TXT = {
  title: { pt: 'Formação do Bless Castle', en: 'Bless Castle Formation' },
  intro: { pt: 'Cadastre os membros do clã e marque quem está confirmado para o Bless Castle. As parties e raids são montadas na hora, distribuindo os buffs.', en: 'Add the clan members and mark who is confirmed for the Bless Castle. Parties and raids are built instantly, spreading the buffs.' },
  login: { pt: 'Entre na sua conta para acessar a ferramenta do clã.', en: 'Log in to use the clan tool.' },
  loginBtn: { pt: 'Entrar', en: 'Log in' },
  noAccess: { pt: 'Esta ferramenta é só para líderes e vice-líderes de clã autorizados. Peça o acesso ao administrador.', en: 'This tool is only for authorized clan leaders and vice-leaders. Ask the administrator for access.' },
  unavailable: { pt: 'A ferramenta de clãs ainda não foi ativada no banco de dados.', en: 'The clan tool is not enabled in the database yet.' },
  error: { pt: 'Não foi possível carregar. Tente de novo.', en: 'Could not load. Try again.' },
  noClans: { pt: 'Nenhum clã ainda.', en: 'No clans yet.' },
  clan: { pt: 'Clã', en: 'Clan' },
  members: { pt: 'Membros do clã', en: 'Clan members' },
  nick: { pt: 'Nick', en: 'Nick' },
  cls: { pt: 'Classe', en: 'Class' },
  add: { pt: 'Adicionar', en: 'Add' },
  confirmed: { pt: 'Confirmado para o Bless Castle', en: 'Confirmed for the Bless Castle' },
  confirmedShort: { pt: 'Confirmado', en: 'Confirmed' },
  notConfirmed: { pt: 'Não confirmado', en: 'Not confirmed' },
  remove: { pt: 'Remover', en: 'Remove' },
  removeAsk: { pt: 'Remover?', en: 'Remove?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
  edit: { pt: 'Editar nick/classe', en: 'Edit nick/class' },
  save: { pt: 'Salvar', en: 'Save' },
  cancel: { pt: 'Cancelar', en: 'Cancel' },
  total: { pt: 'membros', en: 'members' },
  confirmedCount: { pt: 'confirmados', en: 'confirmed' },
  noMembers: { pt: 'Nenhum membro cadastrado.', en: 'No members yet.' },
  formation: { pt: 'Formações do Bless Castle', en: 'Bless Castle formations' },
  confirmedMembers: { pt: 'membros confirmados', en: 'confirmed members' },
  noFormation: { pt: 'Confirme membros para ver a formação.', en: 'Confirm members to see the formation.' },
  raid: { pt: 'Raid', en: 'Raid' },
  party: { pt: 'Grupo', en: 'Party' },
  buffs: { pt: 'buffs', en: 'buffs' },
  leader: { pt: 'Líder', en: 'Leader' },
  makeLeader: { pt: 'Tornar líder do grupo', en: 'Make party leader' },
  reserves: { pt: 'Reservas (passam de 24 confirmados)', en: 'Reserves (over 24 confirmed)' },
  missing: { pt: 'Faltam', en: 'Missing' },
  admin: { pt: 'Administração de clãs', en: 'Clan administration' },
  newClan: { pt: 'Nome do novo clã', en: 'New clan name' },
  createClan: { pt: 'Criar clã', en: 'Create clan' },
  deleteClan: { pt: 'Excluir este clã', en: 'Delete this clan' },
  deleteAsk: { pt: 'Excluir o clã e todos os membros? Não dá para desfazer.', en: 'Delete the clan and all its members? This cannot be undone.' },
  access: { pt: 'Acessos (1 líder e até 4 vices)', en: 'Access (1 leader and up to 4 vices)' },
  playerNick: { pt: 'Nick do jogador no PristonZONE', en: 'Player nick on PristonZONE' },
  roleLeader: { pt: 'Líder', en: 'Leader' },
  roleVice: { pt: 'Vice-líder', en: 'Vice-leader' },
  give: { pt: 'Liberar acesso', en: 'Give access' },
} as const;

type TFn = (k: keyof typeof TXT) => string;
const iconOf = (c: PtClass) => `/skilltree/classes/${c.toLowerCase()}.png`;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function ClassTag({ cls }: { cls: PtClass }) {
  return <span className="cl-cls"><img src={iconOf(cls)} alt="" width={22} height={22} /> {cls}</span>;
}

type PartyMember = FormationMember & { partyLeader?: boolean };

function PartyBox({ index, party, onLeader, T }: { index: number; party: Party; onLeader: (p: Party, m: FormationMember) => void; T: TFn }) {
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
              : <button type="button" className="cl-star" title={T('makeLeader')} aria-label={T('makeLeader')} onClick={() => onLeader(party, m)}>☆</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One member of the list: confirm switch, edit (nick and class) and remove, both done inside the row (no browser dialogs). */
function MemberRow({ m, onToggle, onSave, onRemove, T }: {
  m: ClanMember; onToggle: () => void; onSave: (nick: string, cls: PtClass) => Promise<boolean>; onRemove: () => void; T: TFn;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  const [nick, setNick] = useState(m.nick);
  const [cls, setCls] = useState<PtClass>(m.cls);
  const startEdit = () => { setNick(m.nick); setCls(m.cls); setMode('edit'); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick.trim()) return;
    if (await onSave(nick.trim(), cls)) setMode('view');
  };
  if (mode === 'edit') {
    return (
      <li className="edit">
        <form className="cl-edit" onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') setMode('view'); }}>
          <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={30} aria-label={T('nick')} autoFocus onFocus={(e) => e.target.select()} />
          <select value={cls} onChange={(e) => setCls(e.target.value as PtClass)} aria-label={T('cls')}>
            {PT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" className="mk-btn primary">{T('save')}</button>
          <button type="button" className="mk-btn" onClick={() => setMode('view')}>{T('cancel')}</button>
        </form>
      </li>
    );
  }
  return (
    <li className={m.confirmed ? 'on' : ''}>
      <ClassTag cls={m.cls} />
      <b>{m.nick}</b>
      {mode === 'remove' ? (
        <span className="cl-confirm">
          {T('removeAsk')}
          <button type="button" className="mk-btn cl-danger" onClick={onRemove}>{T('yes')}</button>
          <button type="button" className="mk-btn" onClick={() => setMode('view')}>{T('no')}</button>
        </span>
      ) : (
        <>
          <button type="button" role="switch" aria-checked={m.confirmed} className={`cl-switch ${m.confirmed ? 'on' : ''}`} title={T('confirmed')} onClick={onToggle}>
            {m.confirmed ? `✔ ${T('confirmedShort')}` : T('notConfirmed')}
          </button>
          <button type="button" className="mk-btn cl-x" aria-label={T('edit')} title={T('edit')} onClick={startEdit}>✎</button>
          <button type="button" className="mk-btn cl-x" aria-label={T('remove')} title={T('remove')} onClick={() => setMode('remove')}>✕</button>
        </>
      )}
    </li>
  );
}

function AdminPanel({ clan, onDeleted, T }: { clan: Clan; onDeleted: () => void; T: TFn }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [staff, setStaff] = useState<StaffEntry[]>([]);
  const [nick, setNick] = useState('');
  const [role, setRole] = useState<'leader' | 'vice'>('vice');
  const [err, setErr] = useState('');
  const load = useCallback(() => { getClanRepo().listStaff(clan.id).then(setStaff).catch((e) => setErr(errText(e))); }, [clan.id]);
  useEffect(load, [load]);

  const give = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick.trim()) return;
    setErr('');
    try { await getClanRepo().addStaff(clan.id, nick.trim(), role); setNick(''); load(); } catch (x) { setErr(errText(x)); }
  };
  return (
    <div className="cl-admin">
      <h4>{T('access')} · {clan.name}</h4>
      <ul className="cl-staff">
        {staff.map((s) => (
          <li key={s.userId}>
            <b>{s.nick}</b> <span>{s.role === 'leader' ? T('roleLeader') : T('roleVice')}</span>
            <button type="button" className="mk-btn" aria-label={T('remove')} onClick={() => { void getClanRepo().removeStaff(clan.id, s.userId).then(load).catch((x) => setErr(errText(x))); }}>✕</button>
          </li>
        ))}
      </ul>
      <form className="cl-form" onSubmit={give}>
        <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={T('playerNick')} maxLength={30} />
        <select value={role} onChange={(e) => setRole(e.target.value as 'leader' | 'vice')}>
          <option value="vice">{T('roleVice')}</option>
          <option value="leader">{T('roleLeader')}</option>
        </select>
        <button type="submit" className="mk-btn primary">{T('give')}</button>
      </form>
      {confirmDelete ? (
        <div className="cl-confirm">
          <span>{T('deleteAsk')}</span>
          <button type="button" className="mk-btn cl-danger" onClick={() => { void getClanRepo().deleteClan(clan.id).then(onDeleted).catch((x) => { setErr(errText(x)); setConfirmDelete(false); }); }}>{T('yes')}</button>
          <button type="button" className="mk-btn" onClick={() => setConfirmDelete(false)}>{T('no')}</button>
        </div>
      ) : <button type="button" className="mk-btn cl-danger" onClick={() => setConfirmDelete(true)}>{T('deleteClan')}</button>}
      {err && <p className="ag-warning" role="alert">{err}</p>}
    </div>
  );
}

export function ClanFormation() {
  const { lang } = useI18n();
  const T: TFn = (k) => TXT[k][lang];
  const { isLoggedIn, isAdmin: authAdmin } = useAuth();
  const isAdmin = CLAN_FAKE || authAdmin;
  const access = useClanAccess();

  const [clans, setClans] = useState<Clan[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [clanId, setClanId] = useState<string | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [nick, setNick] = useState('');
  const [cls, setCls] = useState<PtClass>('Archer');
  const [newClan, setNewClan] = useState('');
  const [err, setErr] = useState('');

  const loadClans = useCallback(() => {
    setStatus('loading');
    getClanRepo().listClans()
      .then((c) => { setClans(c); setClanId((cur) => (cur && c.some((x) => x.id === cur) ? cur : c[0]?.id ?? null)); setStatus('ready'); })
      .catch((e) => setStatus(e instanceof ClanUnavailableError ? 'unavailable' : 'error'));
  }, []);
  useEffect(() => { if (access.allowed) loadClans(); }, [access.allowed, loadClans]);

  useEffect(() => {
    if (!clanId) { setMembers([]); return; }
    let cancelled = false;
    getClanRepo().listMembers(clanId).then((m) => { if (!cancelled) setMembers(m); }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [clanId]);

  const clan = clans?.find((c) => c.id === clanId) ?? null;
  const confirmed = useMemo(() => members.filter((m) => m.confirmed).sort((a, b) => a.createdAt - b.createdAt), [members]);
  const formation = useMemo(() => buildFormation(confirmed), [confirmed]);

  /** Optimistic: the screen updates at once and the change is saved in the background (the list is reloaded if it fails). */
  const patchMembers = (ids: string[], patch: Partial<ClanMember>) => {
    setMembers((cur) => cur.map((m) => (ids.includes(m.id) ? { ...m, ...patch } : m)));
    getClanRepo().updateMembers(ids, patch).catch((e) => { setErr(errText(e)); if (clanId) void getClanRepo().listMembers(clanId).then(setMembers); });
  };
  const setLeader = (party: Party, m: FormationMember) => {
    const others = (party.members as PartyMember[]).filter((x) => x.id !== m.id && x.partyLeader).map((x) => x.id);
    if (others.length) patchMembers(others, { partyLeader: false });
    patchMembers([m.id], { partyLeader: true });
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clanId || !nick.trim()) return;
    setErr('');
    try { const m = await getClanRepo().addMember(clanId, nick, cls); setMembers((cur) => [...cur, m]); setNick(''); } catch (x) { setErr(errText(x)); }
  };
  const remove = (m: ClanMember) => {
    setMembers((cur) => cur.filter((x) => x.id !== m.id));
    void getClanRepo().removeMember(m.id).catch((e) => setErr(errText(e)));
  };
  /** Rename / change class: waits for the database so a duplicated nick shows its error and the row stays open. */
  const saveMember = async (m: ClanMember, newNick: string, newCls: PtClass): Promise<boolean> => {
    setErr('');
    try {
      await getClanRepo().updateMember(m.id, { nick: newNick, cls: newCls });
      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, nick: newNick, cls: newCls } : x)));
      return true;
    } catch (x) { setErr(errText(x)); return false; }
  };
  const createClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newClan.trim().length < 2) return;
    setErr('');
    try { const c = await getClanRepo().createClan(newClan); setNewClan(''); setClans((cur) => [...(cur ?? []), c]); setClanId(c.id); } catch (x) { setErr(errText(x)); }
  };

  const header = (
    <header className="sk-head">
      <h1 className="mk-h1">🏰 {T('title')}</h1>
      <p className="mk-muted">{T('intro')}</p>
    </header>
  );

  if (!CLAN_FAKE && !isLoggedIn) {
    return <div className="cl-tool">{header}<section className="sr-card cl-box"><p>{T('login')}</p><button type="button" className="mk-btn primary" onClick={requestLogin}>{T('loginBtn')}</button></section></div>;
  }
  if (access.loading || status === 'loading') return <div className="cl-tool">{header}<Loading /></div>;
  if (!access.allowed) return <div className="cl-tool">{header}<p className="sk-notice">{T('noAccess')}</p></div>;
  if (status === 'unavailable') return <div className="cl-tool">{header}<p className="sk-notice">{T('unavailable')}</p></div>;
  if (status === 'error') return <div className="cl-tool">{header}<p className="ag-warning" role="alert">{T('error')}</p></div>;

  return (
    <div className="cl-tool">
      {header}
      {err && <p className="ag-warning" role="alert">{err}</p>}

      {clans && clans.length > 1 && (
        <label className="mk-field ag-field cl-clanpick"><span>{T('clan')}</span>
          <select value={clanId ?? ''} onChange={(e) => setClanId(e.target.value)}>
            {clans.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      {isAdmin && (
        <section className="sr-card cl-box">
          <h3>{T('admin')}</h3>
          <form className="cl-form" onSubmit={createClan}>
            <input value={newClan} onChange={(e) => setNewClan(e.target.value)} placeholder={T('newClan')} maxLength={40} />
            <button type="submit" className="mk-btn primary">{T('createClan')}</button>
          </form>
          {clan && <AdminPanel key={clan.id} clan={clan} onDeleted={loadClans} T={T} />}
        </section>
      )}

      {!clan ? <p className="sk-notice">{T('noClans')}</p> : (
        <>
          <section className="sr-card cl-box">
            <h3>{T('members')} <small>· {clan.name} · {members.length} {T('total')} · {confirmed.length} {T('confirmedCount')}</small></h3>
            <form className="cl-form" onSubmit={add}>
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={T('nick')} maxLength={30} aria-label={T('nick')} />
              <select value={cls} onChange={(e) => setCls(e.target.value as PtClass)} aria-label={T('cls')}>
                {PT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="submit" className="mk-btn primary">{T('add')}</button>
            </form>
            {members.length === 0 ? <p className="mk-muted">{T('noMembers')}</p> : (
              <ul className="cl-members">
                {members.map((m) => (
                  <MemberRow key={m.id} m={m} T={T} onToggle={() => patchMembers([m.id], { confirmed: !m.confirmed })} onSave={(n, c) => saveMember(m, n, c)} onRemove={() => remove(m)} />
                ))}
              </ul>
            )}
          </section>

          <section className="sr-card cl-box">
            <div className="cl-fhead">
              <div><h3>{T('formation')}</h3><p className="mk-muted">{confirmed.length} {T('confirmedMembers')}</p></div>
            </div>
            {formation.raids.length === 0 ? <p className="sk-notice">{T('noFormation')}</p> : formation.raids.map((r, ri) => (
              <div key={ri} className="cl-raid">
                <div className="cl-raidhead">
                  <h3>{T('raid')} {ri + 1}</h3>
                  <span className={r.buffs.length === BUFF_CLASSES.length ? 'ok' : 'warn'}>{r.buffs.length}/{BUFF_CLASSES.length} {T('buffs')}</span>
                </div>
                <div className="cl-chips">
                  {BUFF_CLASSES.map((c) => <span key={c} className={`cl-chip ${r.buffs.includes(c) ? '' : 'off'}`} title={r.buffs.includes(c) ? c : `${T('missing')}: ${c}`}><ClassTag cls={c} /></span>)}
                </div>
                <div className="cl-parties">
                  {r.parties.map((p, pi) => <PartyBox key={pi} index={ri * 2 + pi + 1} party={p} onLeader={setLeader} T={T} />)}
                </div>
              </div>
            ))}
            {formation.reserves.length > 0 && (
              <div className="cl-reserves">
                <h4>{T('reserves')} ({formation.reserves.length})</h4>
                <ul>{formation.reserves.map((m) => <li key={m.id}><ClassTag cls={m.cls} /> <b>{m.nick}</b></li>)}</ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
