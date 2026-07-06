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
    pt: 'Veja quanto falta para cada boss nascer. Os horários seguem o tempo oficial do jogo (GMT 0).',
    en: 'See how long until each boss spawns. Times follow the game official time (GMT 0).',
  },
  'tb.nowlabel': { pt: 'Agora', en: 'Now' },
  'tb.next': { pt: 'Em seguida', en: 'Coming up' },
  'tb.nextone': { pt: 'Próximo boss', en: 'Next boss' },
  'tb.in': { pt: 'em {t}', en: 'in {t}' },
  'tb.spawning': { pt: '⚔️ Nascendo agora!', en: '⚔️ Spawning now!' },
  'tb.justspawned': { pt: 'Nasceram agora', en: 'Just spawned' },
  'tb.spawnedago': { pt: 'nasceu há {t}', en: 'spawned {t} ago' },
  'tb.schedule': { pt: 'Cronograma do dia', en: 'Daily schedule' },
  'tb.schedulenote': {
    pt: 'Horários no seu fuso. Os bosses são fiéis ao horário oficial do jogo (GMT 0) — o mesmo para todos.',
    en: "Times in your timezone. Bosses follow the game's official time (GMT 0) — the same for everyone.",
  },
  'tb.time': { pt: 'Horário', en: 'Time' },
  'tb.bosses': { pt: 'Bosses', en: 'Bosses' },
  'tb.allbosses': { pt: 'Todos os bosses', en: 'All bosses' },
  'tb.boss.next': { pt: 'Próximo em {in}', en: 'Next in {in}' },
  'tb.lvl': { pt: 'Lv', en: 'Lv' },

  // timezone
  'tb.tz.label': { pt: 'Fuso horário', en: 'Timezone' },
  'tb.tz.showing': { pt: 'Mostrando em {tz}', en: 'Showing in {tz}' },

  // favorites
  'tb.fav.all': { pt: 'Todos', en: 'All' },
  'tb.fav.only': { pt: '⭐ Só favoritos', en: '⭐ Favorites only' },
  'tb.fav.hint': {
    pt: 'Você ainda não escolheu favoritos. Clique na ⭐ dos bosses em "Todos os bosses" para filtrar o topo só por eles.',
    en: 'No favorites yet. Click the ⭐ on bosses under "All bosses" to filter the top by them.',
  },
  'tb.fav.add': { pt: 'Adicionar aos favoritos', en: 'Add to favorites' },
  'tb.fav.remove': { pt: 'Remover dos favoritos', en: 'Remove from favorites' },

  // voice alerts
  'tb.audio.label': { pt: '🔊 Alertas de voz', en: '🔊 Voice alerts' },
  'tb.audio.hint': {
    pt: 'Aviso falado com voz grave antes de cada boss nascer. Escolha os tempos abaixo.',
    en: 'Spoken alert in a deep voice before each boss spawns. Pick the times below.',
  },
  'tb.audio.times': { pt: 'Avisar aos:', en: 'Alert at:' },
  'tb.audio.enabled': { pt: 'Alertas de voz ativados.', en: 'Voice alerts enabled.' },
  'tb.alert.one': { pt: 'O boss {name} vai nascer em {min} minutos.', en: 'Boss {name} will spawn in {min} minutes.' },
  'tb.alert.many': { pt: 'Os bosses {list} vão nascer em {min} minutos.', en: 'Bosses {list} will spawn in {min} minutes.' },
  'tb.alert.and': { pt: 'e', en: 'and' },

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
