// The public list of live rooms. Still no database: every listed host "tracks" a small
// presence record on one shared Realtime channel, and anyone looking at the list reads
// that channel's presence. When the host's tab closes, Supabase drops the record by itself.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../market/supabase';
import { MAX_VIEWERS, cleanName, normalizeRoomCode, serialized } from './p2p';

const LOBBY_TOPIC = 'screen-lobby';
const MAX_LISTED = 50;

export interface LobbyRoom {
  code: string;
  title: string;
  locked: boolean;
  viewers: number;
  since: number; // ms epoch the host went live
}

/** Presence records come from other people's browsers — validate every field. */
export function parseLobby(state: Record<string, unknown[]>): LobbyRoom[] {
  const rooms = new Map<string, LobbyRoom>();
  for (const metas of Object.values(state)) {
    const meta = metas?.[0];
    if (typeof meta !== 'object' || meta === null) continue;
    const m = meta as Record<string, unknown>;
    const code = typeof m.code === 'string' ? normalizeRoomCode(m.code) : null;
    if (!code || rooms.has(code)) continue;
    const viewers = Math.min(MAX_VIEWERS, Math.max(0, Math.floor(Number(m.viewers) || 0)));
    rooms.set(code, {
      code,
      title: typeof m.title === 'string' ? cleanName(m.title) : '',
      locked: m.locked === true,
      viewers,
      since: Number(m.since) || 0,
    });
  }
  return [...rooms.values()].sort((a, b) => b.since - a.since).slice(0, MAX_LISTED);
}

async function openLobbyChannel(
  key: string,
  onSync?: (state: Record<string, unknown[]>) => void,
): Promise<{ channel: RealtimeChannel; close: () => void }> {
  if (!supabase) throw new Error('backend-off');
  const client = supabase;
  const topic = `realtime:${LOBBY_TOPIC}`;
  // Same rule as the room channels: never two live channels on one topic.
  await Promise.all(client.getChannels().filter((c) => c.topic === topic).map((c) => client.removeChannel(c)));
  const channel = client.channel(LOBBY_TOPIC, { config: { presence: { key } } });
  if (onSync) channel.on('presence', { event: 'sync' }, () => onSync(channel.presenceState()));
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), 12000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { window.clearTimeout(timer); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { window.clearTimeout(timer); reject(new Error(status)); }
    });
  });
  return {
    channel,
    close: () => {
      void serialized(async () => {
        if (!client.getChannels().includes(channel)) return;
        await channel.untrack();
        await client.removeChannel(channel);
      });
    },
  };
}

/** Subscribes to the live-room list; returns the function that stops watching. */
export function watchLobby(onRooms: (rooms: LobbyRoom[]) => void, onError: () => void): () => void {
  let stopped = false;
  let close: (() => void) | null = null;
  const key = `w${Math.random().toString(36).slice(2, 10)}`;
  void serialized(() => openLobbyChannel(key, (state) => { if (!stopped) onRooms(parseLobby(state)); }))
    .then((lobby) => {
      if (stopped) lobby.close();
      else close = lobby.close;
    })
    .catch(() => { if (!stopped) onError(); });
  return () => { stopped = true; close?.(); };
}

/** A host's entry in the public list. */
export class LobbyListing {
  private close: (() => void) | null = null;
  private channel: RealtimeChannel | null = null;
  private stopped = false;
  private lastViewers = -1;
  private readonly since = Date.now();

  constructor(private readonly info: { code: string; title: string; locked: boolean }) {}

  async start(): Promise<void> {
    const key = `h${Math.random().toString(36).slice(2, 10)}`;
    const lobby = await serialized(() => openLobbyChannel(key));
    if (this.stopped) { lobby.close(); return; }
    this.channel = lobby.channel;
    this.close = lobby.close;
    await this.publish(0);
  }

  setViewers(count: number): void {
    if (count !== this.lastViewers) void this.publish(count);
  }

  stop(): void {
    this.stopped = true;
    this.close?.();
    this.close = null;
    this.channel = null;
  }

  private async publish(viewers: number): Promise<void> {
    if (!this.channel || this.stopped) return;
    this.lastViewers = viewers;
    await this.channel.track({ code: this.info.code, title: this.info.title, locked: this.info.locked, viewers, since: this.since }).catch(() => {});
  }
}
