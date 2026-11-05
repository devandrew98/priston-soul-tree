// The private /season page: a title, an opening text and a list of FAQ topics (question + formatted answer), all edited in the admin panel.
import { supabase } from './market/supabase';

/** The English fields are optional: when one is empty the page shows the Portuguese text. */
export interface SeasonPage { title: string; intro: string; titleEn: string; introEn: string }
/** `section` is the heading the topic sits under (topics in a row with the same section share one heading); empty = none. */
export interface SeasonItem {
  id: string; position: number; section: string; question: string; answer: string; visible: boolean;
  sectionEn: string; questionEn: string; answerEn: string;
}

export const DEFAULT_PAGE: SeasonPage = { title: 'Temporada', intro: '', titleEn: '', introEn: '' };

interface ItemRow {
  id: string; position: number; section: string | null; question: string; answer: string; visible: boolean;
  section_en: string | null; question_en: string | null; answer_en: string | null;
}
const toItem = (r: ItemRow): SeasonItem => ({ id: r.id, position: r.position, section: r.section ?? '', question: r.question, answer: r.answer, visible: r.visible,
  sectionEn: r.section_en ?? '', questionEn: r.question_en ?? '', answerEn: r.answer_en ?? '',
});

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

/** Everyone gets the visible topics; the administrator also gets the hidden ones (the database decides). */
export async function fetchSeason(): Promise<{ page: SeasonPage; items: SeasonItem[] }> {
  const [p, q] = await Promise.all([
    sb().from('season_page').select('*').eq('id', 1).maybeSingle(),
    sb().from('season_faq').select('*').order('position', { ascending: true }),
  ]);
  if (p.error) throw p.error;
  if (q.error) throw q.error;
  return { // select(*) so the page keeps working even before the English columns exist (supabase/45)
    page: p.data ? { title: p.data.title, intro: p.data.intro, titleEn: p.data.title_en ?? '', introEn: p.data.intro_en ?? '' } : DEFAULT_PAGE, items: (q.data as ItemRow[]).map(toItem) };
}

export async function saveSeasonPage(page: SeasonPage): Promise<void> {
  const { error } = await sb().from('season_page').upsert({ id: 1, title: page.title.trim() || DEFAULT_PAGE.title, intro: page.intro.trim(), title_en: page.titleEn.trim(), intro_en: page.introEn.trim(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Creates the topic (no real id yet) or updates it. */
export async function saveSeasonItem(item: Omit<SeasonItem, 'id'> & { id: string | null }): Promise<void> {
  const row = { position: item.position, section: item.section.trim(), question: item.question.trim(), answer: item.answer.trim(), visible: item.visible,
    section_en: item.sectionEn.trim(), question_en: item.questionEn.trim(), answer_en: item.answerEn.trim(), updated_at: new Date().toISOString() };
  const { error } = item.id ? await sb().from('season_faq').update(row).eq('id', item.id) : await sb().from('season_faq').insert(row);
  if (error) throw error;
}

export async function deleteSeasonItem(id: string): Promise<void> {
  const { error } = await sb().from('season_faq').delete().eq('id', id);
  if (error) throw error;
}

/** Writes the order: the topic at index i gets position i + 1. */
export async function saveSeasonOrder(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => sb().from('season_faq').update({ position: i + 1 }).eq('id', id)));
  const bad = results.find((r) => r.error);
  if (bad?.error) throw bad.error;
}

/** The pure rules, apart from React so they can be tested. */
export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const nextPosition = (items: Pick<SeasonItem, 'position'>[]): number => items.reduce((m, i) => Math.max(m, i.position), 0) + 1;

/** Consecutive topics with the same section go under one heading. */
export function groupBySection<T extends Pick<SeasonItem, 'section'>>(items: T[]): { section: string; items: T[] }[] {
  const out: { section: string; items: T[] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.section === it.section) last.items.push(it); else out.push({ section: it.section, items: [it] });
  }
  return out;
}

/** The text in the visitor's language, or the Portuguese one while the English field is empty. */
export const pickLang = (pt: string, en: string, lang: 'pt' | 'en'): string => (lang === 'en' && en.trim() ? en : pt);

/** What the page shows for one topic in the given language. */
export function localized(item: SeasonItem, lang: 'pt' | 'en'): { id: string; section: string; question: string; answer: string } {
  return {
    id: item.id,
    section: pickLang(item.section, item.sectionEn, lang),
    question: pickLang(item.question, item.questionEn, lang),
    answer: pickLang(item.answer, item.answerEn, lang),
  };
}
