import { useAuth } from '../market/store';
import { FAKE_DB, fakeUser } from '../../lib/builds/account';

/** Signed-in state for the builds features (a fake user in the local ?fakedb demo). */
export function useBuildsAccount(): { loggedIn: boolean; userId: string; nick: string } {
  const auth = useAuth();
  if (FAKE_DB) return { loggedIn: true, userId: fakeUser.id, nick: fakeUser.nick };
  return { loggedIn: auth.isLoggedIn, userId: auth.userId ?? '', nick: auth.user?.nick ?? '' };
}
