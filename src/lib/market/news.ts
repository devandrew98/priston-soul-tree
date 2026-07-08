// News / events shown on the Home page and managed in the admin panel.
import { supabase } from './supabase';

export type NewsKind = 'news' | 'event' | 'maintenance';

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  kind: NewsKind;
  pinned: boolean;
  published: boolean;
  sort: number;
  createdAt: number;
}

interface NewsRow { id: string; title: string; body: string; kind: NewsKind; pinned: boolean; published: boolean; sort: number; created_at: string }

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }
const toItem = (r: NewsRow): NewsItem => ({ id: r.id, title: r.title, body: r.body, kind: r.kind, pinned: r.pinned, published: r.published, sort: r.sort, createdAt: new Date(r.created_at).getTime() });

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

export interface NewsInput { title: string; body: string; kind: NewsKind; pinned: boolean; published: boolean; sort: number }

export async function createNews(input: NewsInput): Promise<void> {
  const { error } = await sb().from('news').insert(input);
  if (error) throw error;
}

export async function updateNews(id: string, patch: Partial<NewsInput>): Promise<void> {
  const { error } = await sb().from('news').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteNews(id: string): Promise<void> {
  const { error } = await sb().from('news').delete().eq('id', id);
  if (error) throw error;
}

// Demo content for local dev without a backend.
export const MOCK_NEWS: NewsItem[] = [
  { id: 'n1', title: 'Evento de Fury em dobro neste fim de semana!', body: 'Sábado e domingo, drop e spawn de Fury aumentados. Aproveitem!', kind: 'event', pinned: true, published: true, sort: 0, createdAt: Date.now() - 3600_000 },
  { id: 'n2', title: 'Manutenção programada', body: 'Terça-feira às 03h (GMT-3), ~30 min de instabilidade.', kind: 'maintenance', pinned: false, published: true, sort: 1, createdAt: Date.now() - 86400_000 },
];
