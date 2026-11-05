// pristonzone.com/season: the season FAQ. It has no link anywhere on the site (whoever gets the address, gets the page), is kept
// out of search engines, and everything on it is written in the admin panel (Site > Temporada).
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { DEFAULT_PAGE, fetchSeason, groupBySection, localized, pickLang, type SeasonItem, type SeasonPage as Page } from '../../lib/season';
import { Loading } from '../Loading';
import { RichText } from '../RichText';

const TXT = {
  openAll: { pt: 'Abrir todos', en: 'Open all' },
  closeAll: { pt: 'Fechar todos', en: 'Close all' },
  empty: { pt: 'Em breve.', en: 'Coming soon.' },
  error: { pt: 'Não foi possível carregar agora. Tente de novo em instantes.', en: 'Could not load right now. Please try again in a moment.' },
} as const;

/** Keeps the page out of search engines and link lists while it is open. */
function useNoIndex() {
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);
}

export function SeasonPage() {
  useNoIndex();
  const { lang } = useI18n();
  const [page, setPage] = useState<Page>(DEFAULT_PAGE);
  const [items, setItems] = useState<SeasonItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!BACKEND_ENABLED) { setFailed(true); return; }
    let cancelled = false;
    fetchSeason()
      .then((r) => { if (!cancelled) { setPage(r.page); setItems(r.items.filter((i) => i.visible)); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const title = pickLang(page.title, page.titleEn, lang);
  const intro = pickLang(page.intro, page.introEn, lang);
  const shown = items?.map((i) => localized(i, lang)) ?? null;

  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — PristonZONE`;
    return () => { document.title = prev; };
  }, [title]);

  const setAll = (value: boolean) => setOpen(Object.fromEntries((items ?? []).map((i) => [i.id, value])));

  return (
    <div className="mk season">
      <h1 className="mk-h1">🏆 {title}</h1>
      {intro && <RichText className="season-intro" source={intro} />}

      {failed && <p className="mk-muted">{TXT.error[lang]}</p>}
      {!items && !failed && <Loading />}
      {shown && shown.length === 0 && <p className="mk-muted">{TXT.empty[lang]}</p>}

      {shown && shown.length > 1 && (
        <div className="season-bar">
          <button type="button" className="mk-btn sm" onClick={() => setAll(true)}>{TXT.openAll[lang]}</button>
          <button type="button" className="mk-btn sm" onClick={() => setAll(false)}>{TXT.closeAll[lang]}</button>
        </div>
      )}

      {shown && groupBySection(shown).map((g, gi) => (
        <section key={`${gi}-${g.section}`} className="season-group">
          {g.section && <h2 className="season-h">{g.section}</h2>}
          {g.items.map((it) => (
            <details key={it.id} className="sr-card season-q" open={!!open[it.id]} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setOpen((cur) => (cur[it.id] === o ? cur : { ...cur, [it.id]: o })); }}>
              <summary>{it.question}</summary>
              <RichText className="season-a" source={it.answer} />
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
