// Builds saved to an account ("Minhas builds") and the community gallery.
// Tables: supabase/24_user_builds.sql. The build itself is the same compact code the share links use.
import { supabase } from '../market/supabase';
import { encodeBuild as encodeSkillCode } from '../skilltree/buildCode';
import { encodeSkillBar, type SkillBar } from '../skilltree/skillBar';
import { splitUsedPoints } from '../skilltree/rules';
import { CLASS_SLUGS, type ClassSlug, type SkillLevels } from '../skilltree/types';

export type BuildKind = 'skills' | 'souls';
export const BUILD_NAME_MAX = 60;

export interface UserBuild {
  id: string;
  ownerId: string;
  kind: BuildKind;
  name: string;
  classSlug: ClassSlug | null;
  level: number | null;
  payload: string;
  summary: string;
  isPublic: boolean;
  likes: number;
  createdAt: number;
  authorNick: string;
  likedByMe: boolean;
}

export interface NewBuild {
  kind: BuildKind;
  name: string;
  classSlug?: ClassSlug;
  level?: number;
  payload: string;
  summary: string;
  isPublic: boolean;
}

export type GallerySort = 'likes' | 'new';

export interface BuildsRepo {
  listMine(kind: BuildKind): Promise<UserBuild[]>;
  listPublic(kind: BuildKind, opts: { classSlug?: ClassSlug; sort: GallerySort }): Promise<UserBuild[]>;
  save(build: NewBuild): Promise<UserBuild>;
  setPublic(id: string, isPublic: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  /** Of these builds, which ones the current user has liked. */
  likedIds(ids: string[]): Promise<Set<string>>;
  setLiked(id: string, liked: boolean): Promise<void>;
}

/** The backend (or its tables) isn't there — the UI says "not available yet" instead of an error. */
export class BuildsUnavailableError extends Error {
  constructor() { super('builds_unavailable'); }
}

// ---- payload helpers (pure, tested) -------------------------------------------------

export function cleanBuildName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, BUILD_NAME_MAX);
}

export function skillBuildPayload(classSlug: ClassSlug, level: number, questIds: string[], skillLevels: SkillLevels, bar: SkillBar): string {
  const payload: { v: 1; b: string; l: number; bar?: string } = { v: 1, b: encodeSkillCode(classSlug, questIds, skillLevels), l: level };
  const barCode = encodeSkillBar(classSlug, bar);
  if (barCode) payload.bar = barCode;
  return JSON.stringify(payload);
}

export function skillBuildSummary(classSlug: ClassSlug, skillLevels: SkillLevels): string {
  const u = splitUsedPoints(classSlug, skillLevels);
  return `${u.skillPointsUsed} SP · ${u.elitePointsUsed} EP`;
}

export function soulBuildPayload(shareCode: string): string {
  return JSON.stringify({ v: 1, c: shareCode });
}

/** The page address that opens a saved build in its tool (null when the payload isn't usable). */
export function openUrlFor(build: Pick<UserBuild, 'kind' | 'name' | 'classSlug' | 'level' | 'payload'>): string | null {
  let data: { b?: unknown; l?: unknown; bar?: unknown; c?: unknown };
  try { data = JSON.parse(build.payload); } catch { return null; }
  if (build.kind === 'skills') {
    if (typeof data.b !== 'string' || !/^[A-Za-z0-9_-]{2,24}$/.test(data.b) || !build.classSlug || !CLASS_SLUGS.includes(build.classSlug)) return null;
    const params = new URLSearchParams({ level: String(Math.max(1, Math.min(120, Number(data.l) || build.level || 1))), build: data.b });
    if (build.name) params.set('name', build.name);
    if (typeof data.bar === 'string' && /^[0-9a-f.]{18}$/.test(data.bar)) params.set('bar', data.bar);
    return `/skill-tree/${build.classSlug}?${params.toString()}`;
  }
  if (typeof data.c !== 'string' || !/^[A-Za-z0-9_-]+$/.test(data.c)) return null;
  return `/souls#b=${data.c}`;
}

// ---- Supabase repository ------------------------------------------------------------

interface Row {
  id: string; owner_id: string; kind: BuildKind; name: string; class_slug: string | null; level: number | null;
  payload: string; summary: string; is_public: boolean; likes_count: number; created_at: string;
  owner?: { nick?: string } | { nick?: string }[] | null;
}
const COLUMNS = 'id, owner_id, kind, name, class_slug, level, payload, summary, is_public, likes_count, created_at, owner:profiles(nick)';

function toBuild(r: Row): UserBuild {
  const owner = Array.isArray(r.owner) ? r.owner[0] : r.owner;
  return {
    id: r.id, ownerId: r.owner_id, kind: r.kind, name: r.name,
    classSlug: r.class_slug && (CLASS_SLUGS as string[]).includes(r.class_slug) ? (r.class_slug as ClassSlug) : null,
    level: r.level, payload: r.payload, summary: r.summary, isPublic: r.is_public, likes: r.likes_count,
    createdAt: new Date(r.created_at).getTime(), authorNick: owner?.nick ?? '', likedByMe: false,
  };
}

function fail(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? '';
  // 42P01 = table doesn't exist; PGRST205 = not in the API schema cache. Either way: not set up yet.
  if (error?.code === '42P01' || error?.code === 'PGRST205' || /does not exist|schema cache/i.test(message)) throw new BuildsUnavailableError();
  throw new Error(message || 'builds_error');
}

function sb() {
  if (!supabase) throw new BuildsUnavailableError();
  return supabase;
}

export const supabaseRepo: BuildsRepo = {
  async listMine(kind) {
    const { data, error } = await sb().from('user_builds').select(COLUMNS).eq('kind', kind).order('updated_at', { ascending: false }).limit(60);
    if (error) fail(error);
    return (data as unknown as Row[]).map(toBuild);
  },
  async listPublic(kind, { classSlug, sort }) {
    let q = sb().from('user_builds').select(COLUMNS).eq('kind', kind).eq('is_public', true);
    if (classSlug) q = q.eq('class_slug', classSlug);
    q = sort === 'likes' ? q.order('likes_count', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at', { ascending: false });
    const { data, error } = await q.limit(60);
    if (error) fail(error);
    return (data as unknown as Row[]).map(toBuild);
  },
  async save(build) {
    const { data, error } = await sb().from('user_builds').insert({
      kind: build.kind, name: cleanBuildName(build.name) || 'Build', class_slug: build.classSlug ?? null, level: build.level ?? null,
      payload: build.payload, summary: build.summary, is_public: build.isPublic,
    }).select(COLUMNS).single();
    if (error) fail(error);
    return toBuild(data as unknown as Row);
  },
  async setPublic(id, isPublic) {
    const { error } = await sb().from('user_builds').update({ is_public: isPublic }).eq('id', id);
    if (error) fail(error);
  },
  async remove(id) {
    const { error } = await sb().from('user_builds').delete().eq('id', id);
    if (error) fail(error);
  },
  async likedIds(ids) {
    if (ids.length === 0) return new Set();
    const { data, error } = await sb().from('build_likes').select('build_id').in('build_id', ids);
    if (error) fail(error);
    return new Set((data ?? []).map((r) => String(r.build_id)));
  },
  async setLiked(id, liked) {
    const { error } = liked
      ? await sb().from('build_likes').insert({ build_id: id })
      : await sb().from('build_likes').delete().eq('build_id', id);
    if (error && error.code !== '23505') fail(error); // 23505 = already liked, fine
  },
};

// ---- in-memory repository (tests and local demo, never touches the real database) -----

export function createMemoryRepo(currentUser: { id: string; nick: string }): BuildsRepo & { _rows: UserBuild[] } {
  const rows: UserBuild[] = [];
  const liked = new Set<string>();
  let seq = 0;
  const clone = (b: UserBuild): UserBuild => ({ ...b, likedByMe: liked.has(b.id) });
  return {
    _rows: rows,
    async listMine(kind) { return rows.filter((b) => b.kind === kind && b.ownerId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt).map(clone); },
    async listPublic(kind, { classSlug, sort }) {
      return rows.filter((b) => b.kind === kind && b.isPublic && (!classSlug || b.classSlug === classSlug))
        .sort((a, b) => (sort === 'likes' ? b.likes - a.likes || b.createdAt - a.createdAt : b.createdAt - a.createdAt)).map(clone);
    },
    async save(build) {
      if (rows.filter((b) => b.ownerId === currentUser.id).length >= 40) throw new Error('build limit reached (40 per account)');
      const b: UserBuild = {
        id: `mem-${++seq}`, ownerId: currentUser.id, kind: build.kind, name: cleanBuildName(build.name) || 'Build',
        classSlug: build.classSlug ?? null, level: build.level ?? null, payload: build.payload, summary: build.summary,
        isPublic: build.isPublic, likes: 0, createdAt: Date.now() + seq, authorNick: currentUser.nick, likedByMe: false,
      };
      rows.push(b);
      return clone(b);
    },
    async setPublic(id, isPublic) {
      const b = rows.find((x) => x.id === id && x.ownerId === currentUser.id);
      if (b) b.isPublic = isPublic;
    },
    async remove(id) {
      const i = rows.findIndex((x) => x.id === id && x.ownerId === currentUser.id);
      if (i >= 0) rows.splice(i, 1);
    },
    async likedIds(ids) { return new Set(ids.filter((id) => liked.has(id))); },
    async setLiked(id, on) {
      const b = rows.find((x) => x.id === id && x.isPublic);
      if (!b) return;
      if (on && !liked.has(id)) { liked.add(id); b.likes += 1; }
      if (!on && liked.has(id)) { liked.delete(id); b.likes = Math.max(0, b.likes - 1); }
    },
  };
}

// ---- which repository the app uses -------------------------------------------------------

let current: BuildsRepo = supabaseRepo;
export const getBuildsRepo = (): BuildsRepo => current;
export const setBuildsRepo = (repo: BuildsRepo): void => { current = repo; };
