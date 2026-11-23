// Talks to the database for the season poll. The table is closed: everything goes through supabase/53_season_poll.sql.
import { supabase } from './market/supabase';
import { POLL_ID, type PollRow } from './poll';
import { isClassSlug } from './skilltree/classes';
import type { ClassSlug } from './skilltree/types';

const VISITOR_KEY = 'pz-visitor'; // the same anonymous code the site statistics use (see analytics.ts)
const VOTED_KEY = `pz-poll-${POLL_ID}`;

interface Row { class: string; votes: number | string; mine: boolean }

const toRows = (data: Row[]): PollRow[] =>
  data.filter((r) => isClassSlug(r.class)).map((r) => ({ cls: r.class as ClassSlug, votes: Number(r.votes) || 0, mine: !!r.mine }));

/** The anonymous code of this browser; created on the first vote when it does not exist yet. */
function voterId(): string {
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

/** Whether this browser already voted (remembered locally so the poll opens straight on the result). */
export const hasVoted = (): boolean => { try { return localStorage.getItem(VOTED_KEY) === '1'; } catch { return false; } };
const markVoted = () => { try { localStorage.setItem(VOTED_KEY, '1'); } catch { /* ignore */ } };

export async function fetchPoll(): Promise<PollRow[]> {
  if (!supabase) throw new Error('backend_not_configured');
  const { data, error } = await supabase.rpc('poll_results', { p_poll: POLL_ID, p_voter: voterId() });
  if (error) throw error;
  return toRows(data as Row[]);
}

export async function sendVote(cls: ClassSlug): Promise<PollRow[]> {
  if (!supabase) throw new Error('backend_not_configured');
  const voter = voterId();
  if (!voter) throw new Error('no_storage'); // without a stored code the one-vote rule cannot be kept
  const { data, error } = await supabase.rpc('poll_vote', { p_poll: POLL_ID, p_voter: voter, p_class: cls });
  if (error) throw error;
  markVoted();
  return toRows(data as Row[]);
}
