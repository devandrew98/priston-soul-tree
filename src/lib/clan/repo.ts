// Clan data (clans, leader/vice access, members). Tables and rules: supabase/25_clan_formation.sql.
// Who sees what is enforced by the database (RLS): the admin sees every clan, a leader/vice only their own.
// In `npm run dev` with ?fakedb the in-memory repository is used instead (see FAKE below), without touching the database.
import { supabase } from '../market/supabase';
import type { PtClass } from './formation';

export interface Clan { id: string; name: string }
export interface ClanMember { id: string; clanId: string; nick: string; cls: PtClass; confirmed: boolean; partyLeader: boolean; createdAt: number }
export interface StaffEntry { userId: string; nick: string; role: 'leader' | 'vice' }
export type MemberPatch = Partial<Pick<ClanMember, 'nick' | 'cls' | 'confirmed' | 'partyLeader'>>;

export class ClanUnavailableError extends Error {}

export interface ClanRepo {
  /** Clans I can see: all of them for the admin, only mine for a leader/vice, none for anybody else. */
  listClans(): Promise<Clan[]>;
  listMembers(clanId: string): Promise<ClanMember[]>;
  addMember(clanId: string, nick: string, cls: PtClass): Promise<ClanMember>;
  updateMember(id: string, patch: MemberPatch): Promise<void>;
  updateMembers(ids: string[], patch: MemberPatch): Promise<void>;
  removeMember(id: string): Promise<void>;
  // Admin only.
  createClan(name: string): Promise<Clan>;
  deleteClan(id: string): Promise<void>;
  listStaff(clanId: string): Promise<StaffEntry[]>;
  addStaff(clanId: string, nick: string, role: 'leader' | 'vice'): Promise<void>;
  removeStaff(clanId: string, userId: string): Promise<void>;
}

type MemberRow = { id: string; clan_id: string; nick: string; cls: PtClass; confirmed: boolean; party_leader: boolean; created_at: string };
const toMember = (r: MemberRow): ClanMember => ({
  id: r.id, clanId: r.clan_id, nick: r.nick, cls: r.cls, confirmed: r.confirmed, partyLeader: r.party_leader, createdAt: new Date(r.created_at).getTime(),
});
const toRow = (p: MemberPatch) => ({
  ...(p.nick !== undefined && { nick: p.nick }),
  ...(p.cls !== undefined && { cls: p.cls }),
  ...(p.confirmed !== undefined && { confirmed: p.confirmed }),
  ...(p.partyLeader !== undefined && { party_leader: p.partyLeader }),
});

/** Translates the database errors the player can actually cause into a readable message. */
function fail(e: { message: string; code?: string }): never {
  if (e.code === '42P01' || e.code === 'PGRST205') throw new ClanUnavailableError('migration');
  if (e.code === '23505') throw new Error(/nick/.test(e.message) ? 'Esse nick já está no clã.' : /leader/.test(e.message) ? 'Esse clã já tem um líder.' : /user/.test(e.message) ? 'Esse jogador já tem acesso a um clã.' : 'Já existe.');
  throw new Error(e.message);
}

function createSupabaseRepo(): ClanRepo {
  const sb = () => { if (!supabase) throw new ClanUnavailableError('backend'); return supabase; };
  const check = <T>(r: { data: T; error: { message: string; code?: string } | null }): T => { if (r.error) fail(r.error); return r.data; };
  return {
    async listClans() { return check(await sb().from('clans').select('id,name').order('name')) as Clan[]; },
    async listMembers(clanId) {
      return (check(await sb().from('clan_members').select('*').eq('clan_id', clanId).order('created_at')) as MemberRow[]).map(toMember);
    },
    async addMember(clanId, nick, cls) {
      return toMember(check(await sb().from('clan_members').insert({ clan_id: clanId, nick: nick.trim(), cls }).select('*').single()) as MemberRow);
    },
    async updateMember(id, patch) { check(await sb().from('clan_members').update(toRow(patch)).eq('id', id)); },
    async updateMembers(ids, patch) { if (ids.length) check(await sb().from('clan_members').update(toRow(patch)).in('id', ids)); },
    async removeMember(id) { check(await sb().from('clan_members').delete().eq('id', id)); },
    async createClan(name) { return check(await sb().from('clans').insert({ name: name.trim() }).select('id,name').single()) as Clan; },
    async deleteClan(id) { check(await sb().from('clans').delete().eq('id', id)); },
    async listStaff(clanId) {
      const rows = check(await sb().rpc('clan_staff_list', { p_clan: clanId })) as { user_id: string; nick: string; role: 'leader' | 'vice' }[];
      return rows.map((r) => ({ userId: r.user_id, nick: r.nick, role: r.role }));
    },
    async addStaff(clanId, nick, role) { check(await sb().rpc('admin_clan_add_staff', { p_clan: clanId, p_nick: nick, p_role: role })); },
    async removeStaff(clanId, userId) { check(await sb().from('clan_staff').delete().eq('clan_id', clanId).eq('user_id', userId)); },
  };
}

/** In-memory repository for local tries (`npm run dev` + ?fakedb): behaves as the admin, never touches the database. */
export function createMemoryRepo(): ClanRepo {
  let seq = 0;
  const id = () => `fake-${++seq}`;
  const clans: Clan[] = [{ id: 'c1', name: 'OccultDay' }, { id: 'c2', name: 'Outro Clã' }];
  const members: ClanMember[] = [];
  const staff = new Map<string, StaffEntry[]>();
  const names = ['FxNick', 'PETISTASENSATO', 'Sacerdotada', 'Areon25', 'Kina22', 'CommitaoDourado', 'ArcanisBoy', 'IceLady', 'Submundo', 'Benzetacil', 'RogerioCeni', 'Elyon'];
  const cls: PtClass[] = ['Archer', 'Shaman', 'Priestess', 'Magician', 'Knight', 'Assassin', 'Archer', 'Priestess', 'Atalanta', 'Fighter', 'Mechanician', 'Knight'];
  names.forEach((nick, i) => members.push({ id: id(), clanId: 'c1', nick, cls: cls[i], confirmed: i < 8, partyLeader: false, createdAt: i }));
  members.push({ id: id(), clanId: 'c2', nick: 'DoOutroCla', cls: 'Archer', confirmed: true, partyLeader: false, createdAt: 99 });
  const dup = (clanId: string, nick: string, except?: string) => members.some((m) => m.clanId === clanId && m.id !== except && m.nick.toLowerCase() === nick.trim().toLowerCase());
  return {
    async listClans() { return [...clans]; },
    async listMembers(clanId) { return members.filter((m) => m.clanId === clanId).map((m) => ({ ...m })); },
    async addMember(clanId, nick, c) {
      if (dup(clanId, nick)) throw new Error('Esse nick já está no clã.');
      const m: ClanMember = { id: id(), clanId, nick: nick.trim(), cls: c, confirmed: false, partyLeader: false, createdAt: Date.now() };
      members.push(m);
      return { ...m };
    },
    async updateMember(mid, patch) {
      const m = members.find((x) => x.id === mid);
      if (m && patch.nick !== undefined && dup(m.clanId, patch.nick, mid)) throw new Error('Esse nick já está no clã.');
      Object.assign(m ?? {}, patch);
    },
    async updateMembers(ids, patch) { ids.forEach((mid) => Object.assign(members.find((m) => m.id === mid) ?? {}, patch)); },
    async removeMember(mid) { const i = members.findIndex((m) => m.id === mid); if (i >= 0) members.splice(i, 1); },
    async createClan(name) { const c = { id: id(), name: name.trim() }; clans.push(c); return c; },
    async deleteClan(cid) { const i = clans.findIndex((c) => c.id === cid); if (i >= 0) clans.splice(i, 1); },
    async listStaff(clanId) { return [...(staff.get(clanId) ?? [])]; },
    async addStaff(clanId, nick, role) {
      const list = staff.get(clanId) ?? [];
      if (role === 'leader' && list.some((s) => s.role === 'leader')) throw new Error('Esse clã já tem um líder.');
      if (role === 'vice' && list.filter((s) => s.role === 'vice').length >= 4) throw new Error('Este clã já tem 4 vice-líderes.');
      list.push({ userId: id(), nick, role });
      staff.set(clanId, list);
    },
    async removeStaff(clanId, userId) { staff.set(clanId, (staff.get(clanId) ?? []).filter((s) => s.userId !== userId)); },
  };
}

const FAKE_KEY = 'pz-fakedb';
/** Dev only: ?fakedb (shared with the builds feature) turns on the in-memory repository and a fake admin. */
export const CLAN_FAKE: boolean = (() => {
  if (!import.meta.env.DEV) return false;
  try { return sessionStorage.getItem(FAKE_KEY) === '1' || new URLSearchParams(window.location.search).has('fakedb'); } catch { return false; }
})();

let repo: ClanRepo | null = null;
export const getClanRepo = (): ClanRepo => (repo ??= CLAN_FAKE ? createMemoryRepo() : createSupabaseRepo());
