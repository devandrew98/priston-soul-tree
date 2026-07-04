import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'pt' | 'en';

type Entry = { pt: string; en: string };

// All UI strings. Boss names / locations are proper nouns and stay as-is.
const DICT: Record<string, Entry> = {
  // ---- shell / nav ----
  'nav.timeboss': { pt: 'TimeBoss', en: 'TimeBoss' },
  'nav.soultree': { pt: 'Árvore de Souls', en: 'Soul Tree' },
  'nav.tagline': { pt: 'Priston Tale EU · ferramentas da comunidade', en: 'Priston Tale EU · community tools' },
  'lang.switch': { pt: 'English', en: 'Português' },

  // ---- TimeBoss ----
  'tb.title': { pt: 'TIMEBOSS', en: 'TIMEBOSS' },
  'tb.subtitle': {
    pt: 'Veja quais bosses nascem e em quanto tempo — horário oficial de Brasília.',
    en: 'See which bosses spawn and in how long — official Brasília time.',
  },
  'tb.timezone': { pt: 'Fuso: Brasília (GMT-3)', en: 'Timezone: Brasília (GMT-3)' },
  'tb.nowlabel': { pt: 'Agora em Brasília', en: 'Now in Brasília' },
  'tb.next': { pt: 'Próximos bosses', en: 'Upcoming bosses' },
  'tb.nextone': { pt: 'Próximo boss', en: 'Next boss' },
  'tb.in': { pt: 'em {t}', en: 'in {t}' },
  'tb.spawning': { pt: '⚔️ Nascendo agora!', en: '⚔️ Spawning now!' },
  'tb.schedule': { pt: 'Cronograma do dia', en: 'Daily schedule' },
  'tb.schedulenote': {
    pt: 'Cada boss nasce nos dois horários da linha (manhã e noite).',
    en: 'Each boss spawns at both times in the row (AM and PM).',
  },
  'tb.time': { pt: 'Horário', en: 'Time' },
  'tb.bosses': { pt: 'Bosses', en: 'Bosses' },
  'tb.allbosses': { pt: 'Todos os bosses', en: 'All bosses' },
  'tb.nextspawn': { pt: 'Próximo: {time} ({in})', en: 'Next: {time} ({in})' },
  'tb.lvl': { pt: 'Lv', en: 'Lv' },

  // ---- Soul Tree (top level) ----
  'st.title': { pt: 'Priston Tale EU — Árvore de Souls', en: 'Priston Tale EU — Soul Tree' },
  'st.subtitle': {
    pt: 'Fusion Tier · planejador de builds & gerador inteligente',
    en: 'Fusion Tier · build planner & smart generator',
  },
  'st.backtop': { pt: 'Voltar ao topo da página', en: 'Back to top of page' },
  'st.tab.tree': { pt: '🌳 Árvore', en: '🌳 Tree' },
  'st.tab.inventory': { pt: '🎒 Inventário', en: '🎒 Inventory' },
  'st.tab.optimizer': { pt: '🤖 Gerador (IA)', en: '🤖 Generator (AI)' },
  'st.tutorial': { pt: '❓ Tutorial', en: '❓ Tutorial' },
  'st.tutorial.tip': { pt: 'Abrir o tutorial guiado', en: 'Open the guided tutorial' },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LangContext = createContext<Ctx>({ lang: 'pt', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('site-lang');
    if (saved === 'pt' || saved === 'en') return saved;
    return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'pt';
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('site-lang', l);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string, vars?: Record<string, string | number>) => {
    const entry = DICT[key];
    let s = entry ? entry[lang] : key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useI18n = () => useContext(LangContext);
