import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE, TIMER_PATHS, TOOL_PATHS, pathFor, routeFromPath, type Route } from './routes';

describe('routes', () => {
  it('every page round-trips path -> route -> path', () => {
    const routes: Route[] = [
      { ...DEFAULT_ROUTE },
      ...Object.keys(TIMER_PATHS).map((t) => ({ ...DEFAULT_ROUTE, section: 'timers' as const, timerTab: t as Route['timerTab'] })),
      ...Object.keys(TOOL_PATHS).map((t) => ({ ...DEFAULT_ROUTE, section: 'tools' as const, toolTab: t as Route['toolTab'] })),
      { ...DEFAULT_ROUTE, section: 'market' },
      { ...DEFAULT_ROUTE, section: 'guides' },
      { ...DEFAULT_ROUTE, section: 'streamers' },
      { ...DEFAULT_ROUTE, section: 'tutorial' },
    ];
    for (const route of routes) {
      expect(routeFromPath(pathFor(route))).toEqual(route);
    }
  });

  it('uses the friendly URLs', () => {
    expect(pathFor({ ...DEFAULT_ROUTE, section: 'tools', toolTab: 'soultree' })).toBe('/souls');
    expect(pathFor({ ...DEFAULT_ROUTE, section: 'tools', toolTab: 'skilltree' })).toBe('/skills');
    expect(pathFor({ ...DEFAULT_ROUTE, section: 'tools', toolTab: 'screenshare' })).toBe('/sharing');
  });

  it('ignores trailing slashes and letter case', () => {
    expect(routeFromPath('/Souls/')).toEqual(routeFromPath('/souls'));
    expect(routeFromPath('')).toEqual(DEFAULT_ROUTE);
  });

  it('keeps the shared-link paths working', () => {
    expect(routeFromPath('/skill-tree/fighter')).toMatchObject({ section: 'tools', toolTab: 'skilltree' });
    expect(routeFromPath('/sala/ABCD2345')).toMatchObject({ section: 'tools', toolTab: 'screenshare' });
  });

  it('opens the first sub-page for the bare group paths', () => {
    expect(routeFromPath('/timers')).toMatchObject({ section: 'timers', timerTab: 'boss' });
    expect(routeFromPath('/ferramentas')).toMatchObject({ section: 'tools', toolTab: 'soultree' });
  });

  it('returns null for unknown paths', () => {
    expect(routeFromPath('/nao-existe')).toBeNull();
    expect(routeFromPath('/souls/extra')).toBeNull();
  });
});
