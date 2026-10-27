// Real URLs for every page (pristonzone.com/souls, /skills, ...). The site is still a
// single-page app: Vercel sends any path to index.html (vercel.json), and this module
// maps path <-> which page to show, so F5, the Back button and shared links all work.

export type Section = 'home' | 'timers' | 'market' | 'streamers' | 'guides' | 'tools';
export type TimerTab = 'boss' | 'fury';
export type ToolTab = 'soultree' | 'mixing' | 'sod' | 'wardrobe' | 'skilltree' | 'screenshare' | 'builds' | 'aging' | 'clan';

export interface Route { section: Section; timerTab: TimerTab; toolTab: ToolTab }

export const DEFAULT_ROUTE: Route = { section: 'home', timerTab: 'boss', toolTab: 'soultree' };

export const TIMER_PATHS: Record<TimerTab, string> = { boss: '/timers/boss', fury: '/timers/fury' };

export const TOOL_PATHS: Record<ToolTab, string> = {
  soultree: '/souls',
  skilltree: '/skills',
  mixing: '/mixing',
  sod: '/sod',
  wardrobe: '/wardrobe',
  screenshare: '/sharing',
  builds: '/builds',
  aging: '/aging',
  clan: '/cla',
};

const SECTION_PATHS: Record<'home' | 'market' | 'guides' | 'streamers', string> = {
  home: '/',
  market: '/marketplace',
  guides: '/guides',
  streamers: '/streamers',
};

/** The URL path that shows this page. */
export function pathFor(route: Route): string {
  if (route.section === 'timers') return TIMER_PATHS[route.timerTab];
  if (route.section === 'tools') return TOOL_PATHS[route.toolTab];
  return SECTION_PATHS[route.section];
}

/** Shared-link paths that live under a prefix (the rest of the path is data for that tool). */
const PREFIX_ROUTES: { prefix: string; toolTab: ToolTab }[] = [
  { prefix: '/skill-tree/', toolTab: 'skilltree' }, // shared builds: /skill-tree/<class>?level=&build=
  { prefix: '/sala/', toolTab: 'screenshare' }, // shared screen rooms: /sala/<code>
];

/** Which page a URL path means, or null when it isn't one of ours (caller shows Home). */
export function routeFromPath(pathname: string): Route | null {
  const path = (pathname.toLowerCase().replace(/\/+$/, '') || '/');

  for (const { prefix, toolTab } of PREFIX_ROUTES) {
    if (`${path}/`.startsWith(prefix)) return { ...DEFAULT_ROUTE, section: 'tools', toolTab };
  }

  if (path === SECTION_PATHS.home) return { ...DEFAULT_ROUTE };
  if (path === '/timers') return { ...DEFAULT_ROUTE, section: 'timers' };
  for (const [timerTab, p] of Object.entries(TIMER_PATHS)) {
    if (path === p) return { ...DEFAULT_ROUTE, section: 'timers', timerTab: timerTab as TimerTab };
  }
  if (path === '/ferramentas') return { ...DEFAULT_ROUTE, section: 'tools' };
  for (const [toolTab, p] of Object.entries(TOOL_PATHS)) {
    if (path === p) return { ...DEFAULT_ROUTE, section: 'tools', toolTab: toolTab as ToolTab };
  }
  for (const section of ['market', 'guides', 'streamers'] as const) {
    if (path === SECTION_PATHS[section]) return { ...DEFAULT_ROUTE, section };
  }
  return null;
}
