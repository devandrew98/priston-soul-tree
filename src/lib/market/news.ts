// News / events shown on the Home page and managed in the admin panel.
// Title and body are stored per-language (PT/EN) so each visitor reads the
// text in their selected language.
import { supabase } from './supabase';

export type NewsKind = 'news' | 'event' | 'maintenance';

export interface NewsItem {
  id: string;
  title: { pt: string; en: string };
  body: { pt: string; en: string };
  kind: NewsKind;
  pinned: boolean;
  published: boolean;
  sort: number;
  createdAt: number;
}

interface NewsRow {
  id: string; title_pt: string; title_en: string; body_pt: string; body_en: string;
  kind: NewsKind; pinned: boolean; published: boolean; sort: number; created_at: string;
}

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }
const toItem = (r: NewsRow): NewsItem => ({
  id: r.id, title: { pt: r.title_pt, en: r.title_en }, body: { pt: r.body_pt, en: r.body_en },
  kind: r.kind, pinned: r.pinned, published: r.published, sort: r.sort, createdAt: new Date(r.created_at).getTime(),
});

/** Published items for the public Home page (pinned first). */
export async function fetchPublishedNews(): Promise<NewsItem[]> {
  const { data, error } = await sb().from('news').select('*').eq('published', true)
    .order('pinned', { ascending: false }).order('sort', { ascending: true }).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data as NewsRow[]).map(toItem);
}

/** Every item, for the admin panel. */
export async function fetchAllNews(): Promise<NewsItem[]> {
  const { data, error } = await sb().from('news').select('*')
    .order('pinned', { ascending: false }).order('sort', { ascending: true }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NewsRow[]).map(toItem);
}

export interface NewsInput {
  titlePt: string; titleEn: string; bodyPt: string; bodyEn: string;
  kind: NewsKind; pinned: boolean; published: boolean; sort: number;
}

function toRow(input: NewsInput) {
  return { title_pt: input.titlePt, title_en: input.titleEn, body_pt: input.bodyPt, body_en: input.bodyEn, kind: input.kind, pinned: input.pinned, published: input.published, sort: input.sort };
}

export async function createNews(input: NewsInput): Promise<void> {
  const { error } = await sb().from('news').insert(toRow(input));
  if (error) throw error;
}

export async function updateNews(id: string, input: NewsInput): Promise<void> {
  const { error } = await sb().from('news').update({ ...toRow(input), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteNews(id: string): Promise<void> {
  const { error } = await sb().from('news').delete().eq('id', id);
  if (error) throw error;
}

// Demo content for local dev without a backend.
export const MOCK_NEWS: NewsItem[] = [
  {
    id: 'n1',
    title: { pt: 'Evento de Fury em dobro neste fim de semana!', en: 'Double Fury event this weekend!' },
    body: { pt: 'Sábado e domingo, drop e spawn de Fury aumentados. Aproveitem!', en: 'Saturday and Sunday, increased Fury drop and spawn rate. Enjoy!' },
    kind: 'event', pinned: true, published: true, sort: 0, createdAt: Date.now() - 3600_000,
  },
  {
    id: 'n2',
    title: { pt: 'Manutenção programada', en: 'Scheduled maintenance' },
    body: { pt: 'Terça-feira às 03h (GMT-3), ~30 min de instabilidade.', en: 'Tuesday at 03:00 (GMT-3), ~30 min of instability.' },
    kind: 'maintenance', pinned: false, published: true, sort: 1, createdAt: Date.now() - 86400_000,
  },
];
