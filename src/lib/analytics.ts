// Anonymous site statistics: every page opened and a few measured clicks are sent to Supabase (see supabase/42_site_analytics.sql).
// Nothing personal is sent: no IP, no name; the visitor is a random code kept in this browser. The private diary (/dor) is never measured.
import { BACKEND_ENABLED, supabase } from './market/supabase';

const VISITOR_KEY = 'pz-visitor';
const GEO_KEY = 'pz-country';

/** The path to record for an address, or null when it must not be measured. Shared-link tokens are folded into a prefix. */
export function normalizePath(pathname: string): string | null {
  const p = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (p === '/dor' || p.startsWith('/dor/')) return null;
  for (const prefix of ['/char/', '/formacao/', '/sala/', '/skill-tree/']) {
    if (p.startsWith(prefix)) return `${prefix.slice(0, -1)}/*`;
  }
  if (p === '/pessoalhadder') return '/leveling';
  return p.slice(0, 60);
}

/** Where the visit came from: the site name of the referrer, or '' for a direct visit / our own pages. */
export function refHost(referrer: string, ownHost: string): string {
  if (!referrer) return '';
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    return h === ownHost.replace(/^www\./, '').toLowerCase() ? '' : h.slice(0, 80);
  } catch {
    return '';
  }
}

export const deviceOf = (width: number): 'mobile' | 'desktop' => (width < 768 ? 'mobile' : 'desktop');

const isBot = () => typeof navigator !== 'undefined' && (navigator.webdriver || /bot|crawl|spider|headless|preview/i.test(navigator.userAgent));
const isLocal = () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) || window.location.hostname.endsWith('.localhost');

let muted = false;
/** The administrator's own visits are not counted. */
export function setAnalyticsMuted(v: boolean) { muted = v; }

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 24);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

let countryP: Promise<string | null> | null = null;
function country(): Promise<string | null> {
  if (!countryP) {
    countryP = (async () => {
      try {
        const cached = sessionStorage.getItem(GEO_KEY);
        if (cached) return cached;
      } catch { /* ignore */ }
      try {
        const res = await fetch('/api/geo');
        if (!res.ok) return null;
        const c = (await res.json())?.country;
        if (typeof c === 'string') { try { sessionStorage.setItem(GEO_KEY, c); } catch { /* ignore */ } return c; }
      } catch { /* API not available (plain local dev) */ }
      return null;
    })();
  }
  return countryP;
}

const currentLang = () => {
  try { return localStorage.getItem('site-lang') === 'en' ? 'en' : 'pt'; } catch { return 'pt'; }
};

async function send(kind: 'view' | 'event', path: string | null, name: string | null, ref: string | null) {
  if (!BACKEND_ENABLED || !supabase || muted || isBot() || isLocal()) return;
  try {
    await supabase.rpc('track_hit', {
      p_kind: kind, p_path: path, p_name: name, p_country: await country(),
      p_device: deviceOf(window.innerWidth), p_lang: currentLang(), p_ref: ref, p_visitor: visitorId(),
    });
  } catch { /* statistics must never get in the way */ }
}

let lastPath = '';
export function trackView(pathname: string, referrer = '') {
  const path = normalizePath(pathname);
  if (!path || path === lastPath) return;
  lastPath = path;
  void send('view', path, null, referrer ? refHost(referrer, window.location.hostname) : '');
}

/** A measured click, e.g. trackEvent('quests:phone_link'). */
export function trackEvent(name: string) {
  void send('event', normalizePath(window.location.pathname), name.slice(0, 80), null);
}

/** Starts measuring: the page the person landed on (with where they came from) and every later page change. */
export function initAnalytics() {
  if (typeof window === 'undefined') return;
  trackView(window.location.pathname, document.referrer);
  const push = window.history.pushState.bind(window.history);
  window.history.pushState = (...args: Parameters<History['pushState']>) => {
    push(...args);
    trackView(window.location.pathname);
  };
  window.addEventListener('popstate', () => trackView(window.location.pathname));
}
