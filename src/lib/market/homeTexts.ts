// Editable Home messages (welcome text and the Pix support text). Each has a PT and an EN version and a choice of which
// language it is shown in. An empty field means "use the site's default text"; no row means everything default.
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { BACKEND_ENABLED, supabase } from './supabase';

export type HomeTextKey = 'welcome' | 'pix';
export type Lang = 'pt' | 'en';

export interface HomeText {
  key: HomeTextKey;
  titlePt: string; titleEn: string; bodyPt: string; bodyEn: string;
  showPt: boolean; showEn: boolean;
}

interface Row {
  key: HomeTextKey; title_pt: string; title_en: string; body_pt: string; body_en: string; show_pt: boolean; show_en: boolean;
}

const toText = (r: Row): HomeText => ({
  key: r.key, titlePt: r.title_pt, titleEn: r.title_en, bodyPt: r.body_pt, bodyEn: r.body_en, showPt: r.show_pt, showEn: r.show_en,
});

function sb() { if (!supabase) throw new Error('backend_not_configured'); return supabase; }

export async function fetchHomeTexts(): Promise<Partial<Record<HomeTextKey, HomeText>>> {
  const { data, error } = await sb().from('home_texts').select('*');
  if (error) throw error;
  const out: Partial<Record<HomeTextKey, HomeText>> = {};
  for (const r of data as Row[]) out[r.key] = toText(r);
  return out;
}

export async function saveHomeText(t: HomeText): Promise<void> {
  const { error } = await sb().from('home_texts').upsert({
    key: t.key, title_pt: t.titlePt.trim(), title_en: t.titleEn.trim(), body_pt: t.bodyPt.trim(), body_en: t.bodyEn.trim(),
    show_pt: t.showPt, show_en: t.showEn, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Back to the default text (removes the saved version). */
export async function resetHomeText(key: HomeTextKey): Promise<void> {
  const { error } = await sb().from('home_texts').delete().eq('key', key);
  if (error) throw error;
}

/** The pure rules, kept apart from React so they can be tested. */
export function pickText(row: HomeText | undefined, field: 'title' | 'body', lang: Lang, fallback: string): string {
  const v = row ? (field === 'title' ? (lang === 'pt' ? row.titlePt : row.titleEn) : (lang === 'pt' ? row.bodyPt : row.bodyEn)) : '';
  return v.trim() || fallback;
}

export function isShown(row: HomeText | undefined, lang: Lang): boolean {
  if (!row) return true;
  return lang === 'pt' ? row.showPt : row.showEn;
}

/** The Home reads its messages through this: `text(key, 'title', default)` and `shown(key)` for the current language. */
export function useHomeTexts() {
  const { lang } = useI18n();
  const [rows, setRows] = useState<Partial<Record<HomeTextKey, HomeText>>>({});
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let cancelled = false;
    fetchHomeTexts().then((r) => { if (!cancelled) setRows(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return {
    text: (key: HomeTextKey, field: 'title' | 'body', fallback: string) => pickText(rows[key], field, lang, fallback),
    shown: (key: HomeTextKey) => isShown(rows[key], lang),
  };
}
