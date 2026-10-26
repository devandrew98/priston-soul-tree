// Compartilhamento de Tela — share your screen with friends straight from the browser (P2P, free).
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { useAuth } from '../market/store';
import {
  MAX_VIEWERS, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, RoomHost, RoomViewer, cleanName, normalizeRoomCode, type ChatMessage, type ViewerInfo, type ViewerStatus,
} from '../../lib/screenshare/p2p';
import { closeRoom, fetchClosedRooms } from '../../lib/screenshare/moderation';
import { ScreenChat } from './ScreenChat';
import { ModerationPanel, ReportBox } from './RoomModeration';
import { LobbyListing, watchLobby, type LobbyRoom } from '../../lib/screenshare/lobby';
import { TOOL_PATHS } from '../../lib/routes';

const NAME_KEY = 'screenshare-name';
const ROOM_PATH = '/sala/';

interface Quality { id: string; labelKey: string; width: number; height: number; fps: number; bitrate: number }
const QUALITIES: Quality[] = [
  { id: 'eco', labelKey: 'sc.q.eco', width: 1280, height: 720, fps: 15, bitrate: 1_000_000 },
  { id: 'std', labelKey: 'sc.q.std', width: 1280, height: 720, fps: 30, bitrate: 2_000_000 },
  { id: 'high', labelKey: 'sc.q.high', width: 1920, height: 1080, fps: 30, bitrate: 3_500_000 },
];

const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

function readName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

/** A shared link (/sala/<code>) opens the viewer with the code already filled in. */
function codeFromUrl(): string | null {
  if (!window.location.pathname.startsWith(ROOM_PATH)) return null;
  return normalizeRoomCode(decodeURIComponent(window.location.pathname.slice(ROOM_PATH.length)));
}

type Mode =
  | { kind: 'menu' }
  | { kind: 'host'; host: RoomHost; listing: LobbyListing | null; stream: MediaStream; quality: Quality; password: string }
  | { kind: 'viewer'; code: string; password: string };

export function ScreenRooms() {
  const { t } = useI18n();
  const urlCode = useRef(codeFromUrl()).current;
  const [name, setName] = useState(readName);
  const [mode, setMode] = useState<Mode>(urlCode ? { kind: 'viewer', code: urlCode, password: '' } : { kind: 'menu' });
  const [quality, setQuality] = useState('std');
  const [roomPassword, setRoomPassword] = useState(''); // host: password to create the room with
  const [joinPassword, setJoinPassword] = useState(''); // viewer: password to try when joining
  const [audio, setAudio] = useState(true);
  const [listed, setListed] = useState(true); // host: show the room in the public list
  const [rooms, setRooms] = useState<LobbyRoom[] | null>(null); // null = still loading
  const [lobbyError, setLobbyError] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // e.g. "your room was closed by moderation"
  const [closedRooms, setClosedRooms] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const { isAdmin } = useAuth();
  // The viewer only starts after a click (so the browser lets the video play with sound).
  const [viewerStarted, setViewerStarted] = useState(false);

  const saveName = (value: string) => {
    setName(value);
    try { localStorage.setItem(NAME_KEY, cleanName(value)); } catch { /* ignore */ }
  };
  const finalName = cleanName(name);

  // The live-room list is only needed while the menu is showing.
  const onMenu = mode.kind === 'menu';
  useEffect(() => {
    if (!onMenu || !BACKEND_ENABLED) return;
    setRooms(null);
    setLobbyError(false);
    return watchLobby(setRooms, () => setLobbyError(true));
  }, [onMenu]);

  // Rooms an admin shut down must not show up in the list, even while their host is still connected.
  const refreshClosed = () => { void fetchClosedRooms().then(setClosedRooms); };
  useEffect(() => {
    if (!onMenu || !BACKEND_ENABLED) return;
    refreshClosed();
    const id = window.setInterval(refreshClosed, 20000);
    return () => window.clearInterval(id);
  }, [onMenu]);

  const backToMenu = (message = '') => {
    if (window.location.pathname.startsWith(ROOM_PATH)) window.history.replaceState(null, '', TOOL_PATHS.screenshare);
    setViewerStarted(false);
    setNotice(message);
    setMode({ kind: 'menu' });
  };

  const startSharing = async () => {
    setError('');
    if (!finalName) { setError(t('sc.err.name')); return; }
    setNotice('');
    const q = QUALITIES.find((x) => x.id === quality) ?? QUALITIES[1];
    setStarting(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: q.width }, height: { ideal: q.height }, frameRate: { ideal: q.fps } },
        audio,
      });
    } catch {
      setStarting(false);
      setError(t('sc.err.cancelled'));
      return;
    }
    try {
      const password = roomPassword.trim();
      const host = new RoomHost(stream, { bitrate: q.bitrate, password, name: finalName });
      await host.start();
      // Listing is a bonus: if it fails the room still works (people can use the link).
      const listing = listed ? new LobbyListing({ code: host.code, title: finalName, locked: host.locked }) : null;
      listing?.start().catch(() => {});
      setMode({ kind: 'host', host, listing, stream, quality: q, password });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError(t('sc.err.backend'));
    }
    setStarting(false);
  };

  const enterRoom = (code: string, password: string) => {
    setError('');
    if (!finalName) { setError(t('sc.err.name')); window.scrollTo({ top: 0 }); return; }
    setViewerStarted(true);
    setMode({ kind: 'viewer', code, password });
  };

  const joinRoom = () => {
    const code = normalizeRoomCode(codeInput);
    if (!code) { setError(t('sc.err.code')); return; }
    enterRoom(code, joinPassword.trim());
  };

  return (
    <div className="sr-tool">
      <header className="sk-head">
        <h1 className="mk-h1">🖥 {t('sc.title')}</h1>
        <p className="mk-muted">{t('sc.subtitle')}</p>
      </header>

      {!BACKEND_ENABLED && <p className="sk-notice">{t('sc.err.backend')}</p>}

      {mode.kind === 'menu' && (
        <>
          <label className="mk-field sr-name">
            <span>{t('sc.name')}</span>
            <input type="text" name="screen-display-name" autoComplete="off" data-1p-ignore data-lpignore="true" value={name} maxLength={NAME_MAX_LENGTH} placeholder={t('sc.name.placeholder')} onChange={(e) => saveName(e.target.value)} />
          </label>
          {error && <p className="sk-notice">{error}</p>}
          {notice && <p className="sk-notice">{notice}</p>}

          {BACKEND_ENABLED && (
            <section className="sr-live-list">
              <h2 className="mk-h2">📺 {t('sc.list.title')}</h2>
              {lobbyError ? (
                <p className="mk-muted">{t('sc.list.error')}</p>
              ) : rooms === null ? (
                <p className="mk-muted">{t('sc.list.loading')}</p>
              ) : rooms.filter((r) => !closedRooms.has(r.code)).length === 0 ? (
                <p className="mk-muted">{t('sc.list.empty')}</p>
              ) : (
                <ul className="sr-rooms">
                  {rooms.filter((r) => !closedRooms.has(r.code)).map((room) => {
                    const full = room.viewers >= MAX_VIEWERS;
                    return (
                      <li key={room.code} className="sr-room">
                        <span className="sr-room-icon" title={room.locked ? t('sc.list.locked') : t('sc.list.open')}>{room.locked ? '🔒' : '🔓'}</span>
                        <span className="sr-room-info">
                          <b>{room.title || t('sc.list.untitled')}</b>
                          <em>{room.viewers}/{MAX_VIEWERS} {t('sc.list.watching')}{room.locked ? ` · ${t('sc.list.locked')}` : ''}</em>
                        </span>
                        {isAdmin && (
                          <button className="mk-btn sm" title={t('sc.mod.close')} onClick={() => { void closeRoom(room.code, 'admin').then((ok) => { if (ok) refreshClosed(); else setError(t('sc.mod.closeFail')); }); }}>⛔</button>
                        )}
                        <button className="mk-btn sm primary" disabled={full} onClick={() => enterRoom(room.code, '')}>
                          {full ? t('sc.v.full') : `▶ ${t('sc.join.go')}`}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="sr-cards">
            <section className="sr-card">
              <h2 className="mk-h2">📡 {t('sc.share.title')}</h2>
              {canShare ? (
                <>
                  <label className="mk-field">
                    <span>{t('sc.quality')}</span>
                    <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                      {QUALITIES.map((q) => <option key={q.id} value={q.id}>{t(q.labelKey)}</option>)}
                    </select>
                  </label>
                  <label className="sr-check">
                    <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} />
                    {t('sc.audio')}
                  </label>
                  <label className="sr-check">
                    <input type="checkbox" checked={listed} onChange={(e) => setListed(e.target.checked)} />
                    {t('sc.list.publish')}
                  </label>
                  <label className="mk-field">
                    <span>🔒 {t('sc.pw.label')}</span>
                    <input type="text" value={roomPassword} maxLength={PASSWORD_MAX_LENGTH} placeholder={t('sc.pw.placeholder')} autoComplete="off" onChange={(e) => setRoomPassword(e.target.value)} />
                  </label>
                  <button className="mk-btn primary" disabled={starting || !BACKEND_ENABLED} onClick={startSharing}>
                    {starting ? t('sc.starting') : `▶ ${t('sc.share.start')}`}
                  </button>
                </>
              ) : (
                <p className="mk-muted">{t('sc.nosupport')}</p>
              )}
            </section>

            <section className="sr-card">
              <h2 className="mk-h2">👀 {t('sc.join.title')}</h2>
              <label className="mk-field">
                <span>{t('sc.join.code')}</span>
                <input
                  type="text" name="screen-room-code" autoComplete="off" data-1p-ignore data-lpignore="true"
                  value={codeInput}
                  maxLength={40}
                  placeholder="ABCD2345"
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                />
              </label>
              <label className="mk-field">
                <span>🔒 {t('sc.pw.join')}</span>
                <input type="password" value={joinPassword} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" name="screen-room-password" onChange={(e) => setJoinPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }} />
              </label>
              <button className="mk-btn primary" disabled={!BACKEND_ENABLED} onClick={joinRoom}>👀 {t('sc.join.go')}</button>
            </section>
          </div>

          {isAdmin && BACKEND_ENABLED && <ModerationPanel onClosed={refreshClosed} />}

          <div className="sk-tips" role="note">
            <b className="sk-tips-title">💡 {t('sc.tips.title')}</b>
            <ul className="sr-tips-list">
              <li>{t('sc.tips.limit', { n: MAX_VIEWERS })}</li>
              <li>{t('sc.tips.window')}</li>
              <li>{t('sc.tips.relay')}</li>
              <li>{t('sc.tips.mobile')}</li>
            </ul>
          </div>
        </>
      )}

      {mode.kind === 'host' && <HostView host={mode.host} listing={mode.listing} stream={mode.stream} quality={mode.quality} password={mode.password} onExit={backToMenu} />}

      {mode.kind === 'viewer' && !viewerStarted && (
        <div className="sr-card sr-prejoin">
          <h2 className="mk-h2">👀 {t('sc.join.title')} — <code>{mode.code}</code></h2>
          <label className="mk-field sr-name">
            <span>{t('sc.name')}</span>
            <input type="text" name="screen-display-name" autoComplete="off" data-1p-ignore data-lpignore="true" value={name} maxLength={NAME_MAX_LENGTH} placeholder={t('sc.name.placeholder')} onChange={(e) => saveName(e.target.value)} />
          </label>
          <label className="mk-field sr-name">
            <span>🔒 {t('sc.pw.join')}</span>
            <input type="password" value={joinPassword} maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" name="screen-room-password" onChange={(e) => setJoinPassword(e.target.value)} />
          </label>
          {error && <p className="sk-notice">{error}</p>}
          <div className="sk-actions">
            <button className="mk-btn primary" disabled={!BACKEND_ENABLED} onClick={() => { if (!finalName) setError(t('sc.err.name')); else { setError(''); setMode({ ...mode, password: joinPassword.trim() }); setViewerStarted(true); } }}>
              ▶ {t('sc.join.watch')}
            </button>
            <button className="mk-btn" onClick={() => backToMenu()}>← {t('sc.back')}</button>
          </div>
        </div>
      )}
      {mode.kind === 'viewer' && viewerStarted && <ViewerView code={mode.code} name={finalName} password={mode.password} isAdmin={isAdmin} onExit={backToMenu} />}
    </div>
  );
}

function HostView({ host, listing, stream, quality, password, onExit }: {
  host: RoomHost; listing: LobbyListing | null; stream: MediaStream; quality: Quality; password: string; onExit: (notice?: string) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${ROOM_PATH}${host.code}`;
  const endRoom = () => { host.stop(); listing?.stop(); };

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  // The public list shows how many people are watching right now.
  useEffect(() => { listing?.setViewers(viewers.length); }, [listing, viewers.length]);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    host.onViewersChange(setViewers);
    host.onChat((m) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur.slice(-99), m])));
    const onEnded = () => { endRoom(); onExit(); };
    const track = stream.getVideoTracks()[0];
    track?.addEventListener('ended', onEnded); // the browser's own "Stop sharing" button

    // An admin can shut a room down: check now and then.
    const watchClosed = () => {
      void fetchClosedRooms().then((closed) => {
        if (mounted.current && closed.has(host.code)) { endRoom(); onExit(t('sc.host.closed')); }
      });
    };
    watchClosed();
    const closedTimer = window.setInterval(watchClosed, 15000);

    return () => {
      mounted.current = false;
      window.clearInterval(closedTimer);
      track?.removeEventListener('ended', onEnded);
      // Deferred so React StrictMode's dev-only unmount/remount doesn't kill a live room;
      // a real unmount (leaving the tab) stays mounted=false and stops the room a tick later.
      window.setTimeout(() => { if (!mounted.current) endRoom(); }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const needMbps = ((viewers.length || 1) * quality.bitrate / 1_000_000).toFixed(1);

  return (
    <div className="sr-host">
      <div className="sr-live"><span className="sr-dot" /> {t('sc.live')}</div>
      <div className="sr-stage">
        <video ref={videoRef} className="sr-video" autoPlay muted playsInline />
        <ScreenChat messages={messages} selfId="host" ready onSend={(text) => { host.sendChat(text); return true; }} />
      </div>
      <div className="sr-card">
        <p className="mk-muted">{t('sc.host.invite')}</p>
        <div className="wd-sharebox-row">
          <input readOnly value={link} onClick={(e) => (e.target as HTMLInputElement).select()} />
          <button className="mk-btn" onClick={() => copy(link)}>{copied ? `✅ ${t('wd.share.copied')}` : `🔗 ${t('wd.share.copy')}`}</button>
        </div>
        <div className="sk-buildcode">
          <span>{t('sc.host.code')}: <b>{host.code}</b></span>
          <button className="mk-btn sm" onClick={() => copy(host.code)}>{t('sk.buildcode.copy')}</button>
        </div>
        <div className="sk-buildcode">
          {password ? (
            <>
              <span>🔒 {t('sc.pw.show')}: <b>{password}</b></span>
              <button className="mk-btn sm" onClick={() => copy(password)}>{t('sc.pw.copy')}</button>
            </>
          ) : (
            <span className="mk-muted">🔓 {t('sc.pw.open')}</span>
          )}
        </div>
        {password && <p className="mk-muted sr-upload">{t('sc.pw.hint')}</p>}
        <h3 className="sr-h3">👥 {t('sc.host.viewers')} ({viewers.length}/{MAX_VIEWERS})</h3>
        {viewers.length === 0 ? <p className="mk-muted">{t('sc.host.empty')}</p> : (
          <ul className="sr-viewers">
            {viewers.map((v) => (
              <li key={v.id}>
                <span className={`sr-state ${v.state}`} />
                {v.name}
                <em>{v.state === 'connected' ? t('sc.state.connected') : t('sc.state.connecting')}</em>
                <button type="button" className="mk-btn sm" title={t('sc.host.kick')} onClick={() => host.kick(v.id)}>{t('sc.host.kick')}</button>
              </li>
            ))}
          </ul>
        )}
        <p className="mk-muted sr-upload">{t('sc.host.upload', { mbps: needMbps })}</p>
        <button className="mk-btn" onClick={() => { endRoom(); onExit(); }}>⏹ {t('sc.host.stop')}</button>
      </div>
    </div>
  );
}

function ViewerView({ code, name, password, isAdmin, onExit }: {
  code: string; name: string; password: string; isAdmin: boolean; onExit: (notice?: string) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerRef = useRef<RoomViewer | null>(null);
  const [status, setStatus] = useState<ViewerStatus>('connecting');
  const [closed, setClosed] = useState(false); // shut down by an admin
  const [attempt, setAttempt] = useState(0);
  const [pwInput, setPwInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatReady, setChatReady] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const pwRef = useRef(password); // survives "try again", which rebuilds the viewer
  const submitPw = () => {
    const value = pwInput.trim();
    if (!value) return;
    pwRef.current = value;
    viewerRef.current?.submitPassword(value);
  };

  useEffect(() => {
    let cancelled = false;
    setClosed(false);
    setMessages([]);
    const viewer = new RoomViewer(code, name, {
      onStatus: setStatus,
      onStream: (stream) => {
        const el = videoRef.current;
        if (!el) return;
        el.srcObject = stream;
        el.play().catch(() => { el.muted = true; void el.play(); }); // autoplay policy fallback
      },
      onChat: (m) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur.slice(-99), m])),
      onChatReady: setChatReady,
    }, pwRef.current);
    viewerRef.current = viewer;

    // Don't even join a room an admin closed; and leave one that gets closed while watching.
    const check = () => {
      void fetchClosedRooms().then((set) => {
        if (cancelled || !set.has(code)) return;
        setClosed(true);
        viewer.leave();
      });
    };
    // Deferred a tick so React StrictMode's dev-only mount/unmount/mount only joins once.
    const timer = window.setTimeout(() => { void viewer.join(); check(); }, 0);
    const closedTimer = window.setInterval(check, 15000);
    return () => { cancelled = true; window.clearTimeout(timer); window.clearInterval(closedTimer); viewer.leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, attempt]);

  const statusKey: Record<ViewerStatus, string> = {
    connecting: 'sc.v.connecting', 'waiting-host': 'sc.v.waiting', watching: 'sc.v.watching',
    ended: 'sc.v.ended', full: 'sc.v.full', failed: 'sc.v.failed', error: 'sc.err.backend',
    'need-password': 'sc.v.needpw', denied: 'sc.v.denied', kicked: 'sc.v.kicked',
  };
  const shownStatus: ViewerStatus | 'closed' = closed ? 'closed' : status;
  const retryable = !closed && (status === 'failed' || status === 'error' || status === 'full' || status === 'ended');
  const askPassword = !closed && (status === 'need-password' || status === 'denied');
  const live = !closed && status === 'watching';

  return (
    <div className="sr-viewer">
      <div className="sr-viewer-bar">
        <span>🖥 <code>{code}</code></span>
        <span className={`sr-status ${shownStatus}`}>{shownStatus === 'closed' ? t('sc.v.closed') : t(statusKey[status])}</span>
        {retryable && <button className="mk-btn sm" onClick={() => setAttempt((n) => n + 1)}>↻ {t('sc.v.retry')}</button>}
        {live && <button className="mk-btn sm" onClick={() => setReporting((v) => !v)}>🚩 {t('sc.report.btn')}</button>}
        {isAdmin && (
          <button className="mk-btn sm" onClick={() => { void closeRoom(code, 'admin').then((ok) => setAdminNote(ok ? t('sc.mod.closed') : t('sc.mod.closeFail'))); }}>⛔ {t('sc.mod.close')}</button>
        )}
        <button className="mk-btn sm" onClick={() => onExit()}>← {t('sc.v.leave')}</button>
      </div>
      {adminNote && <p className="sk-notice">{adminNote}</p>}
      {reporting && live && <ReportBox code={code} onDone={() => setReporting(false)} />}
      {askPassword && (
        <div className="sr-card">
          <label className="mk-field">
            <span>🔒 {t('sc.pw.enter')}</span>
            <input
              type="password"
              value={pwInput}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password" name="screen-room-password"
              autoFocus
              onChange={(e) => setPwInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPw(); }}
            />
          </label>
          <button className="mk-btn primary" disabled={!pwInput.trim()} onClick={submitPw}>▶ {t('sc.pw.go')}</button>
        </div>
      )}
      <div className={`sr-stage${live ? '' : ' no-chat'}`}>
        <video ref={videoRef} className={`sr-video${live ? '' : ' hidden'}`} autoPlay playsInline controls />
        {live && <ScreenChat messages={messages} selfId={viewerRef.current?.id ?? ''} ready={chatReady} onSend={(text) => viewerRef.current?.sendChat(text) ?? false} />}
      </div>
      {!closed && status === 'failed' && <p className="mk-muted">{t('sc.v.failed.hint')}</p>}
    </div>
  );
}
