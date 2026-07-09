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
//
// Diagnóstico: chame com ?debug=1 (além do secret) para receber, em vez do
// resumo curto, o detalhe por streamer do YouTube (status HTTP, tamanho da
// resposta, se bateu um muro de consentimento/robô, etc.) — útil pra
// descobrir por que a raspagem falha a partir do servidor da função.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWITCH_ID = Deno.env.get('TWITCH_CLIENT_ID') ?? '';
const TWITCH_SECRET = Deno.env.get('TWITCH_CLIENT_SECRET') ?? '';
const YT_KEY = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const REFRESH_SECRET = Deno.env.get('REFRESH_SECRET') ?? '';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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

interface ScrapeResult { live: boolean; title: string; debug: string }

async function youtubeScrape(handle: string): Promise<ScrapeResult> {
  const path = handle.startsWith('UC') ? `channel/${handle}` : handle.startsWith('@') ? handle : `@${handle}`;
  const url = `https://www.youtube.com/${path}/live?hl=en`;
  const r = await fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': 'CONSENT=YES+1; SOCS=CAI',
      'User-Agent': CHROME_UA,
    },
  });
  const html = await r.text();
  // Several independent signals YouTube embeds when a channel's /live page
  // resolves to an actually-live video; checking more than one (the ytInitial
  // player-response fields AND the thumbnail LIVE badge) hedges against any
  // one of them being absent in a particular page variant/region.
  const isLiveNow = html.includes('"isLiveNow":true');
  const isLive = html.includes('"isLive":true');
  const liveBadge = html.includes('"style":"LIVE"');
  const hls = html.includes('hlsManifestUrl');
  const blocked = /unusual traffic|detected unusual|solve this puzzle|consent\.youtube\.com|Before you continue/i.test(html);
  const live = isLiveNow || isLive || liveBadge || hls;
  // The <meta name="title"> tag isn't present in every page variant; fall
  // back to og:title, then the <title> tag (stripping the trailing " - YouTube").
  const titleMeta = html.match(/<meta name="title" content="([^"]*)">/)?.[1]
    ?? html.match(/<meta property="og:title" content="([^"]*)">/)?.[1]
    ?? html.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/ - YouTube$/, '')
    ?? '';
  const canon = html.match(/"canonicalBaseUrl":"([^"]*)"/);
  const debug = `status=${r.status} bytes=${html.length} isLiveNow=${isLiveNow} isLive=${isLive} liveBadge=${liveBadge} hls=${hls} blocked=${blocked} canon=${canon?.[1] ?? '?'} finalUrl=${r.url}`;
  return { live, title: titleMeta, debug };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (REFRESH_SECRET) {
    const given = req.headers.get('x-refresh-secret') ?? url.searchParams.get('secret');
    if (given !== REFRESH_SECRET) return new Response('unauthorized', { status: 401 });
  }
  const debugMode = url.searchParams.get('debug') === '1';

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await sb.from('streamers').select('id,platform,handle');
  const rows = (data ?? []) as Row[];
  const updates: Update[] = [];
  const debugInfo: Record<string, string> = {};

  const tw = rows.filter((s) => s.platform === 'twitch' && s.handle);
  if (tw.length && TWITCH_ID && TWITCH_SECRET) {
    try {
      const token = await twitchToken();
      const liveMap = await twitchLive(tw.map((s) => s.handle.toLowerCase()), token);
      for (const s of tw) {
        const hit = liveMap.get(s.handle.toLowerCase());
        updates.push({ id: s.id, live: !!hit, viewers: hit?.viewers ?? 0, title: hit?.title ?? '' });
      }
    } catch (e) { debugInfo['twitch:error'] = String(e); }
  }

  const yt = rows.filter((s) => s.platform === 'youtube' && s.handle);
  for (const s of yt) {
    try {
      if (YT_KEY && s.handle.startsWith('UC')) {
        const res = await youtubeApi(s.handle);
        updates.push({ id: s.id, live: res.live, viewers: 0, title: res.title });
        if (debugMode) debugInfo[s.handle] = 'via youtube_api_key';
      } else {
        const res = await youtubeScrape(s.handle);
        updates.push({ id: s.id, live: res.live, viewers: 0, title: res.title });
        if (debugMode) debugInfo[s.handle] = res.debug;
      }
    } catch (e) {
      updates.push({ id: s.id, live: false, viewers: 0, title: '' });
      if (debugMode) debugInfo[s.handle] = `exception: ${e}`;
    }
  }

  const now = new Date().toISOString();
  for (const u of updates) {
    await sb.from('streamers').update({ live: u.live, viewers: u.viewers, title: u.title, live_checked_at: now }).eq('id', u.id);
  }

  return new Response(JSON.stringify({ ok: true, checked: updates.length, ...(debugMode ? { debug: debugInfo } : {}) }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
