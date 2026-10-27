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
import { BoardEditor } from './BoardEditor';
import { ClassTag, FormationBoard } from './FormationBoard';

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
  share: { pt: 'Link para os jogadores', en: 'Link for the players' },
  shareNote: { pt: 'Quem tiver o link vê as parties e raids, sem poder editar nada. Não precisa de login.', en: 'Anyone with the link sees the parties and raids, and cannot edit anything. No login needed.' },
  shareCreate: { pt: 'Criar link', en: 'Create link' },
  shareCopy: { pt: 'Copiar', en: 'Copy' },
  shareCopied: { pt: 'Copiado!', en: 'Copied!' },
  shareNew: { pt: 'Gerar novo link', en: 'New link' },
  shareNewNote: { pt: 'O link antigo deixa de funcionar.', en: 'The old link stops working.' },
  shareStop: { pt: 'Desativar link', en: 'Turn link off' },
} as const;

/** Class cards order: the buff classes first, then the others. */
const GROUP_ORDER: PtClass[] = [...BUFF_CLASSES, ...PT_CLASSES.filter((c) => !BUFF_CLASSES.includes(c))];

type TFn = (k: keyof typeof TXT) => string;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
      <b>{m.nick}</b>
      {mode === 'remove' ? (
        <span className="cl-confirm">
          {T('removeAsk')}
          <button type="button" className="mk-btn cl-danger" onClick={onRemove}>{T('yes')}</button>
          <button type="button" className="mk-btn" onClick={() => setMode('view')}>{T('no')}</button>
        </span>
      ) : (
        <>
          <button type="button" role="switch" aria-checked={m.confirmed} aria-label={T('confirmed')} className={`cl-switch ${m.confirmed ? 'on' : ''}`}
            title={m.confirmed ? T('confirmedShort') : T('notConfirmed')} onClick={onToggle}>
            {m.confirmed ? '✔' : ''}
          </button>
          <button type="button" className="mk-btn cl-x" aria-label={T('edit')} title={T('edit')} onClick={startEdit}>✎</button>
          <button type="button" className="mk-btn cl-x" aria-label={T('remove')} title={T('remove')} onClick={() => setMode('remove')}>✕</button>
        </>
      )}
    </li>
  );
}

/** The read-only link the leader hands to the players. */
function SharePanel({ clan, T }: { clan: Clan; T: TFn }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    setToken(undefined);
    getClanRepo().getShare(clan.id).then((tk) => { if (!cancelled) setToken(tk); }).catch((e) => { if (!cancelled) { setToken(null); setErr(errText(e)); } });
    return () => { cancelled = true; };
  }, [clan.id]);
  const create = () => { setErr(''); setCopied(false); getClanRepo().createShare(clan.id).then(setToken).catch((e) => setErr(errText(e))); };
  const stop = () => { setErr(''); getClanRepo().revokeShare(clan.id).then(() => setToken(null)).catch((e) => setErr(errText(e))); };
  const url = token ? `${window.location.origin}/formacao/${token}` : '';
  const copy = () => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }).catch(() => {}); };
  return (
    <section className="sr-card cl-box">
      <h3>{T('share')}</h3>
      <p className="mk-muted">{T('shareNote')}</p>
      {token === undefined ? null : token ? (
        <>
          <div className="cl-form">
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={T('share')} />
            <button type="button" className="mk-btn primary" onClick={copy}>{copied ? T('shareCopied') : T('shareCopy')}</button>
          </div>
          <div className="cl-confirm">
            <button type="button" className="mk-btn" onClick={create} title={T('shareNewNote')}>{T('shareNew')}</button>
            <button type="button" className="mk-btn cl-danger" onClick={stop}>{T('shareStop')}</button>
            <small className="mk-muted">{T('shareNewNote')}</small>
          </div>
        </>
      ) : <button type="button" className="mk-btn primary" onClick={create}>{T('shareCreate')}</button>}
      {err && <p className="ag-warning" role="alert">{err}</p>}
    </section>
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
    const others = (party.members as (FormationMember & { partyLeader?: boolean })[]).filter((x) => x.id !== m.id && x.partyLeader).map((x) => x.id);
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
              <div className="cl-groups">
                {GROUP_ORDER.map((c) => {
                  const list = members.filter((m) => m.cls === c);
                  if (list.length === 0) return null;
                  return (
                    <div key={c} className="cl-group">
                      <h4><ClassTag cls={c} /> <span>{list.filter((m) => m.confirmed).length}/{list.length}</span></h4>
                      <ul className="cl-members">
                        {list.map((m) => (
                          <MemberRow key={m.id} m={m} T={T} onToggle={() => patchMembers([m.id], { confirmed: !m.confirmed })} onSave={(n, cl) => saveMember(m, n, cl)} onRemove={() => remove(m)} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <FormationBoard formation={formation} confirmedCount={confirmed.length} onLeader={setLeader} />
          <BoardEditor key={clan.id} clan={clan} />
          <SharePanel key={clan.id} clan={clan} T={T} />
        </>
      )}
    </div>
  );
}
