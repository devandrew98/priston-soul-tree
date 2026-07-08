// Edge Function: refresh-streamers
// Detecta se cada streamer está AO VIVO (Twitch via API oficial, YouTube via API
// key quando disponível ou raspagem da página /live) e atualiza public.streamers.
// Agendada pelo pg_cron (ver supabase/08_streamers.sql).
//
// Secrets (Project Settings > Edge Functions / Secrets):
//   TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET   (obrigatórios p/ Twitch)
//   YOUTUBE_API_KEY                          (opcional; se ausente, usa raspagem)
//   REFRESH_SECRET                           (opcional; protege o endpoint)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWITCH_ID = Deno.env.get('TWITCH_CLIENT_ID') ?? '';
const TWITCH_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET') ?? '';
const YT_KEY = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const REFRESH_SECRET = Deno.env.get('REFRESH_SECRET') ?? '';

interface Row { id: string; platform: string; handle: string }
interface Update { id: string; live: boolean; viewers: number; title: string }

async function twitchToken(): Promise<string> {
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: TWITCH_ID, client_secret: TWITCH_SECRET, grant_type: 'client_credentials' }),
  });
  const j = await r.json();
  return j.access_token as string;
}

async function twitchLive(logins: string[], token: string): Promise<Map<string, { viewers: number; title: string }>> {
  const map = new Map<string, { viewers: number; title: string }>();
  for (let i = 0; i < logins.length; i += 100) {
    const chunk = logins.slice(i, i + 100);
    const qs = chunk.map((l) => `user_login=${encodeURIComponent(l)}`).join('&');
    const r = await fetch(`https://api.twitch.tv/helix/streams?${qs}`, {
      headers: { 'Client-Id': TWITCH_ID, Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    for (const s of j.data ?? []) {
      map.set(String(s.user_login).toLowerCase(), { viewers: s.viewer_count ?? 0, title: s.title ?? '' });
    }
  }
  return map;
}

async function youtubeApi(channelId: string): Promise<{ live: boolean; title: string }> {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${YT_KEY}`);
  const j = await r.json();
  const item = (j.items ?? [])[0];
  return { live: !!item, title: item?.snippet?.title ?? '' };
}

async function youtubeScrape(handle: string): Promise<{ live: boolean; title: string }> {
  const path = handle.startsWith('UC') ? `channel/${handle}` : handle.startsWith('@') ? handle : `@${handle}`;
  const r = await fetch(`https://www.youtube.com/${path}/live?hl=en`, {
    headers: { 'Accept-Language': 'en-US', cookie: 'CONSENT=YES+1', 'User-Agent': 'Mozilla/5.0' },
  });
  const html = await r.text();
  const live = html.includes('"isLiveNow":true') || html.includes('hlsManifestUrl');
  const m = html.match(/<meta name="title" content="([^"]*)">/);
  return { live, title: m?.[1] ?? '' };
}

Deno.serve(async (req) => {
  if (REFRESH_SECRET) {
    const given = req.headers.get('x-refresh-secret') ?? new URL(req.url).searchParams.get('secret');
    if (given !== REFRESH_SECRET) return new Response('unauthorized', { status: 401 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await sb.from('streamers').select('id,platform,handle');
  const rows = (data ?? []) as Row[];
  const updates: Update[] = [];

  const tw = rows.filter((s) => s.platform === 'twitch' && s.handle);
  if (tw.length && TWITCH_ID && TWITCH_SECRET) {
    try {
      const token = await twitchToken();
      const liveMap = await twitchLive(tw.map((s) => s.handle.toLowerCase()), token);
      for (const s of tw) {
        const hit = liveMap.get(s.handle.toLowerCase());
        updates.push({ id: s.id, live: !!hit, viewers: hit?.viewers ?? 0, title: hit?.title ?? '' });
      }
    } catch (_) { /* keep previous status on transient errors */ }
  }

  const yt = rows.filter((s) => s.platform === 'youtube' && s.handle);
  for (const s of yt) {
    try {
      const res = YT_KEY && s.handle.startsWith('UC') ? await youtubeApi(s.handle) : await youtubeScrape(s.handle);
      updates.push({ id: s.id, live: res.live, viewers: 0, title: res.title });
    } catch (_) { updates.push({ id: s.id, live: false, viewers: 0, title: '' }); }
  }

  const now = new Date().toISOString();
  for (const u of updates) {
    await sb.from('streamers').update({ live: u.live, viewers: u.viewers, title: u.title, live_checked_at: now }).eq('id', u.id);
  }

  return new Response(JSON.stringify({ ok: true, checked: updates.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
