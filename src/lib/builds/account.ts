// Who the builds features think the user is, and how they ask for a login.
// In `npm run dev` only, opening any page with ?fakedb switches the builds to an in-memory
// repository and a fake signed-in user, so the whole feature can be tried without the database
// (and without touching it). In the production build this block is removed.
import { setBuildsRepo, createMemoryRepo } from './userBuilds';

const FAKE_KEY = 'pz-fakedb';
const FAKE_USER = { id: 'dev-user', nick: 'Visitante Dev' };

export const FAKE_DB: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(window.location.search).has('fakedb')) sessionStorage.setItem(FAKE_KEY, '1');
    return sessionStorage.getItem(FAKE_KEY) === '1';
  } catch {
    return false;
  }
})();

if (FAKE_DB) {
  const repo = createMemoryRepo(FAKE_USER);
  setBuildsRepo(repo);
  // A couple of public builds from "other people" so the gallery isn't empty.
  void repo.save({ kind: 'skills', name: 'Fighter PvP clássico', classSlug: 'fighter', level: 120, payload: JSON.stringify({ v: 1, b: 'AAAAAAAAAAAA', l: 120 }), summary: '56 SP · 31 EP', isPublic: true });
  void repo.save({ kind: 'skills', name: 'Archer farm rápido', classSlug: 'archer', level: 100, payload: JSON.stringify({ v: 1, b: 'AAAAAAAAAAAA', l: 100 }), summary: '46 SP · 21 EP', isPublic: true });
}

export const fakeUser = FAKE_USER;

export const LOGIN_EVENT = 'pz-open-login';
/** Asks the app to open its login window (the builds widgets don't own it). */
export const requestLogin = (): void => { window.dispatchEvent(new Event(LOGIN_EVENT)); };
