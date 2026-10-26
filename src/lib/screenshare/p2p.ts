// Screen rooms — free, serverless-video screen sharing.
//
// The picture travels peer-to-peer over WebRTC (host -> each viewer, "mesh"),
// so it never touches our servers. The only thing that goes through Supabase
// is the tiny signalling chatter (offer/answer/ICE) over a Realtime broadcast
// channel named after the room code — no tables, nothing stored.
//
// Free-tier trade-offs (see ScreenRooms UI copy): STUN only (no TURN relay, so
// a minority of strict networks can't connect), and the host uploads one copy
// of the video per viewer, hence MAX_VIEWERS.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../market/supabase';

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export const MAX_VIEWERS = 6;
export const NAME_MAX_LENGTH = 24;

// No 0/O/1/I/L so a code read aloud or typed by hand can't be mistyped.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function makeRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Cleans up what the user typed/pasted; null when it can't be a room code. */
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX_LENGTH);
}

export const PASSWORD_MAX_LENGTH = 40;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const newId = () => toHex(crypto.getRandomValues(new Uint8Array(8)));
const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

/**
 * Password check without ever sending the password: the host publishes a random salt,
 * and a viewer proves it knows the password by sending PBKDF2(password, salt + its own id).
 * Tying the proof to the viewer id means a proof overheard on the channel can't be replayed
 * by someone else, and the slow hash makes guessing offline expensive.
 */
export async function makeProof(password: string, salt: string, viewerId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`${salt}:${viewerId}`), iterations: 60000 },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

// ---- signalling ------------------------------------------------------------

type Signal =
  | { t: 'join'; from: string; name: string; proof?: string }
  | { t: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { t: 'full'; from: string; to: string }
  | { t: 'denied'; from: string; to: string }
  | { t: 'kicked'; from: string; to: string }
  | { t: 'end'; from: string }
  | { t: 'leave'; from: string };

const SIGNAL_TYPES = ['join', 'offer', 'answer', 'ice', 'full', 'denied', 'kicked', 'end', 'leave'];

/** Anything on the channel comes from other people's browsers — shape-check it. */
function isSignal(value: unknown): value is Signal {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.t === 'string' && SIGNAL_TYPES.includes(v.t) && typeof v.from === 'string' && v.from.length <= 32;
}

interface PeerMeta { id: string; role: 'host' | 'viewer'; locked: boolean; salt: string }
interface SelfMeta { role: 'host' | 'viewer'; locked?: boolean; salt?: string }

interface Link {
  send(sig: Signal): void;
  close(): void;
}

// Opening/closing a room topic must never overlap: leaving one channel on a topic can
// tear down another that just joined the same topic on the shared socket.
let linkQueue: Promise<unknown> = Promise.resolve();
export function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = linkQueue.then(task, task);
  linkQueue = run.catch(() => {});
  return run;
}

function openLink(
  code: string,
  selfId: string,
  meta: SelfMeta,
  on: { signal: (sig: Signal) => void; presence: (peers: PeerMeta[]) => void },
): Promise<Link> {
  return serialized(() => openLinkNow(code, selfId, meta, on));
}

async function openLinkNow(
  code: string,
  selfId: string,
  meta: SelfMeta,
  on: { signal: (sig: Signal) => void; presence: (peers: PeerMeta[]) => void },
): Promise<Link> {
  if (!supabase) throw new Error('backend-off');
  const client = supabase;
  const topic = `screen-room:${code}`;
  // supabase-js hands back the SAME channel object for a topic that is still registered
  // (quick re-join, retry) and then refuses new listeners — start clean.
  await Promise.all(client.getChannels().filter((c) => c.topic === `realtime:${topic}`).map((c) => client.removeChannel(c)));
  const channel: RealtimeChannel = client.channel(topic, {
    config: { broadcast: { self: false }, presence: { key: selfId } },
  });
  channel.on('broadcast', { event: 'sig' }, ({ payload }) => {
    if (isSignal(payload) && payload.from !== selfId) on.signal(payload);
  });
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<{ role?: string; locked?: boolean; salt?: string }>();
    on.presence(Object.entries(state).map(([id, metas]) => ({
      id,
      role: metas[0]?.role === 'host' ? 'host' : 'viewer',
      locked: metas[0]?.locked === true,
      salt: typeof metas[0]?.salt === 'string' ? metas[0].salt.slice(0, 64) : '',
    })));
  });
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), 12000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { window.clearTimeout(timer); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { window.clearTimeout(timer); reject(new Error(status)); }
    });
  });
  await channel.track(meta);
  return {
    send: (sig) => { void channel.send({ type: 'broadcast', event: 'sig', payload: sig }); },
    close: () => {
      void serialized(async () => {
        // A later open on this topic may already have swept this channel away — don't leave twice.
        if (!client.getChannels().includes(channel)) return;
        await channel.untrack();
        await client.removeChannel(channel);
      });
    },
  };
}

// ---- chat (travels over the WebRTC data channel, so only people who really joined can read it) ----

export const CHAT_MAX_LENGTH = 300;
const CHAT_MIN_INTERVAL_MS = 800;
const CHAT_HISTORY = 30;

export interface ChatMessage {
  id: string;
  fromId: string; // viewer id, or 'host'
  name: string;
  text: string;
  ts: number;
  fromHost: boolean;
}

export function cleanChatText(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH) : '';
}

/** Chat messages arrive from other people's browsers — rebuild them field by field. */
export function parseChatMessage(raw: unknown): ChatMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const text = cleanChatText(m.text);
  if (!text || typeof m.id !== 'string' || typeof m.fromId !== 'string') return null;
  return {
    id: m.id.slice(0, 32),
    fromId: m.fromId.slice(0, 32),
    name: typeof m.name === 'string' ? cleanName(m.name) || 'Visitante' : 'Visitante',
    text,
    ts: Number(m.ts) || Date.now(),
    fromHost: m.fromHost === true,
  };
}

// ---- host ------------------------------------------------------------------

export interface ViewerInfo { id: string; name: string; state: RTCPeerConnectionState }

interface HostPeer {
  pc: RTCPeerConnection;
  name: string;
  createdAt: number;
  pendingIce: RTCIceCandidateInit[];
  dc: RTCDataChannel | null;
  lastChatAt: number;
}

export class RoomHost {
  readonly code = makeRoomCode();
  private readonly selfId = newId();
  private link: Link | null = null;
  private peers = new Map<string, HostPeer>();
  private stopped = false;
  private listener: (viewers: ViewerInfo[]) => void = () => {};
  private readonly password: string;
  private readonly salt: string;
  private wrongAttempts = new Map<string, number>();
  private banned = new Set<string>();
  private history: ChatMessage[] = [];
  private chatListener: (message: ChatMessage) => void = () => {};

  constructor(
    private readonly stream: MediaStream,
    private readonly opts: { bitrate: number; maxViewers?: number; password?: string; name?: string },
  ) {
    for (const track of stream.getVideoTracks()) track.contentHint = 'motion'; // games: keep fps over sharpness
    this.password = (opts.password ?? '').slice(0, PASSWORD_MAX_LENGTH);
    this.salt = this.password ? newSalt() : '';
  }

  get locked(): boolean {
    return this.password !== '';
  }

  /** Called with the current viewer list whenever someone joins, leaves or changes state. */
  onViewersChange(fn: (viewers: ViewerInfo[]) => void): void {
    this.listener = fn;
  }

  /** Called for every chat message in the room (including the host's own). */
  onChat(fn: (message: ChatMessage) => void): void {
    this.chatListener = fn;
  }

  /** The host writes to everyone. */
  sendChat(text: string): void {
    const clean = cleanChatText(text);
    if (!clean || this.stopped) return;
    this.pushChat({ id: newId(), fromId: 'host', name: cleanName(this.opts.name ?? '') || 'Anfitrião', text: clean, ts: Date.now(), fromHost: true });
  }

  /** Removes a viewer and refuses them if they try to come back. */
  kick(viewerId: string): void {
    this.banned.add(viewerId);
    this.link?.send({ t: 'kicked', from: this.selfId, to: viewerId });
    this.removePeer(viewerId);
  }

  private pushChat(message: ChatMessage): void {
    this.history.push(message);
    if (this.history.length > CHAT_HISTORY) this.history.shift();
    const payload = JSON.stringify({ t: 'chat', message });
    for (const peer of this.peers.values()) {
      if (peer.dc?.readyState === 'open') peer.dc.send(payload);
    }
    this.chatListener(message);
  }

  private onViewerChat(viewerId: string, data: unknown): void {
    const peer = this.peers.get(viewerId);
    if (!peer || typeof data !== 'string') return;
    let parsed: unknown;
    try { parsed = JSON.parse(data); } catch { return; }
    const text = cleanChatText((parsed as { text?: unknown } | null)?.text);
    const now = Date.now();
    if (!text || now - peer.lastChatAt < CHAT_MIN_INTERVAL_MS) return; // flood control
    peer.lastChatAt = now;
    this.pushChat({ id: newId(), fromId: viewerId, name: peer.name, text, ts: now, fromHost: false });
  }

  async start(): Promise<void> {
    this.link = await openLink(this.code, this.selfId, { role: 'host', locked: this.locked, salt: this.salt }, {
      signal: (sig) => this.onSignal(sig),
      presence: (peers) => this.dropGhosts(peers),
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.link?.send({ t: 'end', from: this.selfId });
    for (const id of [...this.peers.keys()]) this.removePeer(id, false);
    this.link?.close();
    this.stream.getTracks().forEach((t) => t.stop());
    this.listener([]);
  }

  private notify(): void {
    this.listener([...this.peers.entries()].map(([id, p]) => ({ id, name: p.name, state: p.pc.connectionState })));
  }

  private removePeer(id: string, notify = true): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    if (notify) this.notify();
  }

  /** A viewer whose tab closed never sends "leave" — presence tells us. */
  private dropGhosts(present: PeerMeta[]): void {
    const ids = new Set(present.map((p) => p.id));
    for (const [id, peer] of this.peers) {
      if (!ids.has(id) && Date.now() - peer.createdAt > 10000) this.removePeer(id);
    }
  }

  private applyBitrate(pc: RTCPeerConnection): void {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = this.opts.bitrate;
      sender.setParameters(params).catch(() => { /* not supported -> browser default */ });
    }
  }

  private onSignal(sig: Signal): void {
    if (this.stopped) return;
    if (sig.t === 'join') void this.handleJoin(sig.from, cleanName(sig.name) || 'Visitante', sig.proof);
    else if (sig.t === 'answer' && sig.to === this.selfId) void this.handleAnswer(sig.from, sig.sdp);
    else if (sig.t === 'ice' && sig.to === this.selfId) this.handleIce(sig.from, sig.candidate);
    else if (sig.t === 'leave') this.removePeer(sig.from);
  }

  /** True when the room is open, or the viewer proved it knows the password. */
  private async authorized(viewerId: string, proof?: string): Promise<boolean> {
    if (!this.locked) return true;
    const wrong = this.wrongAttempts.get(viewerId) ?? 0;
    if (wrong >= 5) return false; // stop answering a viewer that keeps guessing
    if (typeof proof !== 'string') return false; // no password offered yet — not a wrong guess
    if (proof === (await makeProof(this.password, this.salt, viewerId))) return true;
    this.wrongAttempts.set(viewerId, wrong + 1);
    return false;
  }

  private async handleJoin(viewerId: string, name: string, proof?: string): Promise<void> {
    if (this.banned.has(viewerId)) { this.link?.send({ t: 'kicked', from: this.selfId, to: viewerId }); return; }
    if (this.peers.get(viewerId)?.pc.connectionState === 'connected') return;
    if (!(await this.authorized(viewerId, proof))) {
      if ((this.wrongAttempts.get(viewerId) ?? 0) < 5) this.link?.send({ t: 'denied', from: this.selfId, to: viewerId });
      return;
    }
    if (this.stopped) return;
    const existing = this.peers.get(viewerId);
    if (existing) {
      // The viewer retries "join" until it sees video — don't restart a healthy or still-negotiating link.
      if (existing.pc.connectionState === 'connected' || Date.now() - existing.createdAt < 10000) return;
      this.removePeer(viewerId, false);
    } else if (this.peers.size >= (this.opts.maxViewers ?? MAX_VIEWERS)) {
      this.link?.send({ t: 'full', from: this.selfId, to: viewerId });
      return;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: HostPeer = { pc, name, createdAt: Date.now(), pendingIce: [], dc: null, lastChatAt: 0 };
    this.peers.set(viewerId, peer);
    // Created before the offer so it is negotiated together with the video.
    const dc = pc.createDataChannel('chat');
    peer.dc = dc;
    dc.onopen = () => dc.send(JSON.stringify({ t: 'history', messages: this.history }));
    dc.onmessage = (e) => this.onViewerChat(viewerId, e.data);
    for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.link?.send({ t: 'ice', from: this.selfId, to: viewerId, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.removePeer(viewerId);
      else this.notify();
    };
    this.notify();

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.applyBitrate(pc);
      this.link?.send({ t: 'offer', from: this.selfId, to: viewerId, sdp: { type: offer.type, sdp: offer.sdp } });
    } catch {
      this.removePeer(viewerId);
    }
  }

  private async handleAnswer(viewerId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(viewerId);
    if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
    try {
      await peer.pc.setRemoteDescription(sdp);
      for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {});
    } catch {
      this.removePeer(viewerId);
    }
  }

  private handleIce(viewerId: string, candidate: RTCIceCandidateInit): void {
    const peer = this.peers.get(viewerId);
    if (!peer) return;
    if (peer.pc.remoteDescription) void peer.pc.addIceCandidate(candidate).catch(() => {});
    else peer.pendingIce.push(candidate);
  }
}

// ---- viewer ----------------------------------------------------------------

export type ViewerStatus = 'connecting' | 'waiting-host' | 'watching' | 'ended' | 'full' | 'failed' | 'error' | 'need-password' | 'denied' | 'kicked';

export class RoomViewer {
  private readonly selfId = newId();
  private link: Link | null = null;
  private hostId: string | null = null;
  private pc: RTCPeerConnection | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private retry = 0;
  private left = false;
  private status: ViewerStatus = 'connecting';
  private hostLock: { locked: boolean; salt: string } | null = null;
  private password: string;
  private dc: RTCDataChannel | null = null;

  get id(): string {
    return this.selfId;
  }

  /** Sends a chat line to the host (who relays it to everyone). False when the chat isn't connected. */
  sendChat(text: string): boolean {
    const clean = cleanChatText(text);
    if (!clean || this.dc?.readyState !== 'open') return false;
    this.dc.send(JSON.stringify({ t: 'chat', text: clean }));
    return true;
  }

  constructor(
    private readonly code: string,
    private readonly name: string,
    private readonly cb: {
      onStatus: (status: ViewerStatus) => void;
      onStream: (stream: MediaStream) => void;
      onChat?: (message: ChatMessage) => void;
      onChatReady?: (ready: boolean) => void;
    },
    password = '',
  ) {
    this.password = password.slice(0, PASSWORD_MAX_LENGTH);
  }

  /** Retry with a (new) password after "need-password" / "denied". */
  submitPassword(password: string): void {
    this.password = password.slice(0, PASSWORD_MAX_LENGTH);
    this.setStatus('connecting');
    this.sendJoin();
  }

  async join(): Promise<void> {
    this.setStatus('connecting');
    try {
      this.link = await openLink(this.code, this.selfId, { role: 'viewer' }, {
        signal: (sig) => this.onSignal(sig),
        presence: (peers) => this.onPresence(peers),
      });
    } catch {
      if (!this.left) this.setStatus('error'); // a viewer that already left must not overwrite the live one's status
      return;
    }
    if (this.left) { this.link.close(); return; }
    this.sendJoin();
    // The host may not be there yet, or the first "join" may be missed — keep asking until video arrives.
    this.retry = window.setInterval(() => {
      if (['watching', 'full', 'ended', 'need-password', 'denied', 'kicked'].includes(this.status)) return;
      this.sendJoin();
    }, 4000);
  }

  leave(): void {
    if (this.left) return;
    this.left = true;
    window.clearInterval(this.retry);
    this.link?.send({ t: 'leave', from: this.selfId });
    this.closePc();
    this.link?.close();
  }

  private setStatus(status: ViewerStatus): void {
    this.status = status;
    this.cb.onStatus(status);
  }

  private sendJoin(): void {
    void this.sendJoinNow();
  }

  private async sendJoinNow(): Promise<void> {
    if (!this.link || this.left) return;
    if (this.password) {
      // The proof needs the host's salt, which arrives with its presence — wait for it.
      if (!this.hostLock) return;
      if (this.hostLock.locked) {
        const proof = await makeProof(this.password, this.hostLock.salt, this.selfId);
        if (!this.left) this.link.send({ t: 'join', from: this.selfId, name: this.name, proof });
        return;
      }
    }
    this.link.send({ t: 'join', from: this.selfId, name: this.name });
  }

  private closePc(): void {
    if (this.dc) { this.dc = null; this.cb.onChatReady?.(false); }
    if (!this.pc) return;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
    this.pc = null;
    this.pendingIce = [];
  }

  private onPresence(peers: PeerMeta[]): void {
    const host = peers.find((p) => p.role === 'host');
    this.hostLock = host ? { locked: host.locked, salt: host.salt } : null;
    if (!host && !this.hostId && this.status === 'connecting') this.setStatus('waiting-host');
    if (host && this.status === 'waiting-host') this.setStatus('connecting');
    // (A wrong password must not be re-sent on every presence update — the host counts guesses.)
    if (host && !this.hostId && !['need-password', 'denied', 'full', 'kicked'].includes(this.status)) this.sendJoin();
    if (!host && (this.status === 'watching' || this.hostId)) {
      // Host presence vanished: ended (or their tab died).
      this.closePc();
      this.hostId = null;
      this.setStatus('ended');
    }
  }

  private onSignal(sig: Signal): void {
    if (this.left) return;
    if (sig.t === 'offer' && sig.to === this.selfId) void this.handleOffer(sig.from, sig.sdp);
    else if (sig.t === 'ice' && sig.to === this.selfId && sig.from === this.hostId) this.handleIce(sig.candidate);
    else if (sig.t === 'full' && sig.to === this.selfId) this.setStatus('full');
    else if (sig.t === 'denied' && sig.to === this.selfId) this.setStatus(this.password ? 'denied' : 'need-password');
    else if (sig.t === 'kicked' && sig.to === this.selfId) { this.closePc(); this.setStatus('kicked'); }
    else if (sig.t === 'end' && sig.from === this.hostId) { this.closePc(); this.setStatus('ended'); }
  }

  private async handleOffer(hostId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.closePc();
    this.hostId = hostId;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.ondatachannel = (e) => {
      if (e.channel.label !== 'chat') return;
      const dc = e.channel;
      this.dc = dc;
      dc.onopen = () => this.cb.onChatReady?.(true);
      dc.onclose = () => { if (this.dc === dc) this.cb.onChatReady?.(false); };
      dc.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        let data: { t?: unknown; message?: unknown; messages?: unknown };
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.t === 'chat') {
          const m = parseChatMessage(data.message);
          if (m) this.cb.onChat?.(m);
        } else if (data.t === 'history' && Array.isArray(data.messages)) {
          for (const raw of data.messages.slice(-CHAT_HISTORY)) {
            const m = parseChatMessage(raw);
            if (m) this.cb.onChat?.(m);
          }
        }
      };
      if (dc.readyState === 'open') this.cb.onChatReady?.(true);
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) { this.cb.onStream(stream); this.setStatus('watching'); }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.link?.send({ t: 'ice', from: this.selfId, to: hostId, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.setStatus('failed');
    };
    try {
      await pc.setRemoteDescription(sdp);
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.link?.send({ t: 'answer', from: this.selfId, to: hostId, sdp: { type: answer.type, sdp: answer.sdp } });
    } catch {
      this.setStatus('failed');
    }
  }

  private handleIce(candidate: RTCIceCandidateInit): void {
    if (this.pc?.remoteDescription) void this.pc.addIceCandidate(candidate).catch(() => {});
    else this.pendingIce.push(candidate);
  }
}
