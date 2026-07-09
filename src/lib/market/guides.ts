// Video guides (YouTube) grouped by category — managed in the admin panel,
// shown on the public "Guias" tab. The cover is the video's own YouTube
// thumbnail; categories are entirely admin-defined (no built-in list).
import { supabase } from './supabase';

export interface GuideCategory {
  id: string;
  name: string;
  sort: number;
}

export interface GuideVideo {
  id: string;
  categoryId: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  sort: number;
}

interface CategoryRow { id: string; name: string; sort: number }
interface GuideRow { id: string; category_id: string; title: string; youtube_url: string; video_id: string; sort: number }

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }
const toCategory = (r: CategoryRow): GuideCategory => ({ id: r.id, name: r.name, sort: r.sort });
const toGuide = (r: GuideRow): GuideVideo => ({ id: r.id, categoryId: r.category_id, title: r.title, youtubeUrl: r.youtube_url, videoId: r.video_id, sort: r.sort });

/** Extract an 11-char YouTube video id from any common URL shape. */
export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

export const youtubeThumbnail = (videoId: string): string => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
export const youtubeWatchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
export const youtubeEmbedUrl = (videoId: string): string => `https://www.youtube.com/embed/${videoId}?autoplay=1`;

export async function fetchGuideCategories(): Promise<GuideCategory[]> {
  const { data, error } = await sb().from('guide_categories').select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data as CategoryRow[]).map(toCategory);
}

export async function fetchGuides(): Promise<GuideVideo[]> {
  const { data, error } = await sb().from('guides').select('*').order('sort', { ascending: true });
  if (error) throw error;
  return (data as GuideRow[]).map(toGuide);
}

export async function createGuideCategory(name: string, sort: number): Promise<void> {
  const { error } = await sb().from('guide_categories').insert({ name, sort });
  if (error) throw error;
}
export async function updateGuideCategory(id: string, patch: { name?: string; sort?: number }): Promise<void> {
  const { error } = await sb().from('guide_categories').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deleteGuideCategory(id: string): Promise<void> {
  const { error } = await sb().from('guide_categories').delete().eq('id', id);
  if (error) throw error;
}

export interface GuideInput { categoryId: string; title: string; youtubeUrl: string; videoId: string; sort: number }
export async function createGuide(input: GuideInput): Promise<void> {
  const { error } = await sb().from('guides').insert({ category_id: input.categoryId, title: input.title, youtube_url: input.youtubeUrl, video_id: input.videoId, sort: input.sort });
  if (error) throw error;
}
export async function updateGuide(id: string, input: Partial<GuideInput>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.youtubeUrl !== undefined) row.youtube_url = input.youtubeUrl;
  if (input.videoId !== undefined) row.video_id = input.videoId;
  if (input.sort !== undefined) row.sort = input.sort;
  if (input.categoryId !== undefined) row.category_id = input.categoryId;
  const { error } = await sb().from('guides').update(row).eq('id', id);
  if (error) throw error;
}
export async function deleteGuide(id: string): Promise<void> {
  const { error } = await sb().from('guides').delete().eq('id', id);
  if (error) throw error;
}

// Demo content for local dev without a backend.
export const MOCK_CATEGORIES: GuideCategory[] = [
  { id: 'c1', name: 'Guia de Souls', sort: 0 },
  { id: 'c2', name: 'Guia de Leveling', sort: 1 },
];
export const MOCK_GUIDES: GuideVideo[] = [
  { id: 'g1', categoryId: 'c1', title: 'Como montar sua árvore de Souls', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', sort: 0 },
  { id: 'g2', categoryId: 'c2', title: 'Melhor rota de leveling 1-100', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', sort: 0 },
];
