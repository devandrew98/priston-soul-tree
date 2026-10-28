// State shared by the Quest Tracker tabs: the official data, the player's characters (saved by themselves) and the selections
// that travel between tabs. Official data and the player's data are kept apart; simulations never write to a character.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../market/store';
import { makeExpTable, pctToState, type ExpState, type ExpTable } from '../../lib/quest/exp';
import { createAccountStore, createLocalStore, MAX_CHARACTERS, newCharacter, type CharacterStore } from '../../lib/quest/characters';
import { makeContext, type PlanContext } from '../../lib/quest/planner';
import { getQuestRepo, QUEST_FAKE, QuestUnavailableError } from '../../lib/quest/repo';
import type { Character, QuestData, QuestProgress, QuestSettings } from '../../lib/quest/types';

export type QuestTab = 'database' | 'calculator' | 'planner' | 'characters';
export type ProgressAction = 'start' | 'ready' | 'deliver' | 'reset' | 'undo';

interface QuestCtx {
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  data: QuestData | null;
  reload: () => void;
  table: ExpTable | null;
  settings: QuestSettings;
  chars: Character[];
  active: Character | null;
  setActiveId: (id: string) => void;
  /** Changes the ACTIVE character (saved automatically a moment later). */
  update: (patch: Partial<Character> | ((c: Character) => Partial<Character>)) => void;
  setQuestState: (questId: string, action: ProgressAction) => void;
  create: (name?: string) => void;
  remove: (id: string) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  storage: 'account' | 'local';
  /** Calculation context for the active character's bonuses; null while data is loading. */
  plan: PlanContext | null;
  /** The active character's REAL position (null when the table does not know their level). */
  start: ExpState | null;
  now: number;
  tab: QuestTab;
  setTab: (t: QuestTab) => void;
  calcQuestId: string | null;
  setCalcQuestId: (id: string | null) => void;
  plannerIds: string[];
  setPlannerIds: (ids: string[]) => void;
  togglePlanner: (id: string) => void;
}

const Ctx = createContext<QuestCtx | null>(null);
export const useQuest = (): QuestCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useQuest outside QuestProvider');
  return c;
};

const ACTIVE_KEY = 'pz-quest-active';
const DEFAULT_SETTINGS_FALLBACK: QuestSettings = { expTableMode: 'per_level', combineMode: 'additive', rounding: 'floor', rules: { capPercentPerQuest: null, overflow: 'carry' }, dataVersion: 0 };

export function QuestProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, ready } = useAuth();
  const useAccount = !QUEST_FAKE && isLoggedIn;
  const store: CharacterStore = useMemo(() => (useAccount ? createAccountStore() : createLocalStore()), [useAccount]);

  const [status, setStatus] = useState<QuestCtx['status']>('loading');
  const [data, setData] = useState<QuestData | null>(null);
  const [chars, setChars] = useState<Character[]>([]);
  const [charsLoaded, setCharsLoaded] = useState(false);
  const [activeId, setActiveIdState] = useState<string | null>(() => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } });
  const [saveState, setSaveState] = useState<QuestCtx['saveState']>('idle');
  const [tab, setTab] = useState<QuestTab>('database');
  const [calcQuestId, setCalcQuestId] = useState<string | null>(null);
  const [plannerIds, setPlannerIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    getQuestRepo().loadData(false)
      .then((d) => { setData(d); setStatus('ready'); })
      .catch((e) => setStatus(e instanceof QuestUnavailableError ? 'unavailable' : 'error'));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(id); }, []);

  // Characters: from the account when signed in, from this browser otherwise.
  const timers = useRef(new Map<string, number>());
  const latest = useRef(new Map<string, Character>());
  useEffect(() => {
    if (!QUEST_FAKE && !ready) return;
    let cancelled = false;
    setCharsLoaded(false);
    store.list()
      .then(async (list) => {
        if (cancelled) return;
        if (list.length === 0) { const c = newCharacter('Meu personagem'); await store.save(c).catch(() => {}); list = [c]; }
        setChars(list);
        setCharsLoaded(true);
      })
      .catch(() => { if (!cancelled) { const c = newCharacter('Meu personagem'); setChars([c]); setCharsLoaded(true); setSaveState('error'); } });
    return () => { cancelled = true; };
  }, [store, ready]);

  const flush = useCallback((id: string) => {
    const c = latest.current.get(id);
    if (!c) return;
    setSaveState('saving');
    store.save(c).then(() => setSaveState('saved')).catch(() => setSaveState('error'));
  }, [store]);
  const scheduleSave = useCallback((c: Character) => {
    latest.current.set(c.id, c);
    window.clearTimeout(timers.current.get(c.id));
    timers.current.set(c.id, window.setTimeout(() => flush(c.id), 600));
    setSaveState('saving');
  }, [flush]);
  useEffect(() => () => { timers.current.forEach((t, id) => { window.clearTimeout(t); flush(id); }); }, [flush]);

  const active = useMemo(() => chars.find((c) => c.id === activeId) ?? chars[0] ?? null, [chars, activeId]);
  const setActiveId = useCallback((id: string) => { setActiveIdState(id); try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ } }, []);

  const update = useCallback<QuestCtx['update']>((patch) => {
    if (!active) return;
    setChars((list) => list.map((c) => {
      if (c.id !== active.id) return c;
      const next = { ...c, ...(typeof patch === 'function' ? patch(c) : patch), updatedAt: Date.now() };
      scheduleSave(next);
      return next;
    }));
  }, [active, scheduleSave]);

  const setQuestState = useCallback((questId: string, action: ProgressAction) => {
    update((c) => {
      const prog = c.progress[questId];
      const deliveries = prog?.deliveries ?? [];
      const t = Date.now();
      const progress = { ...c.progress };
      const set = (p: QuestProgress | null) => { if (p) progress[questId] = p; else delete progress[questId]; };
      if (action === 'start') set({ status: 'in_progress', deliveries, updatedAt: t });
      else if (action === 'ready') set({ status: 'ready', deliveries, updatedAt: t });
      else if (action === 'deliver') set({ status: 'completed', deliveries: [...deliveries, t], updatedAt: t });
      else if (action === 'undo') { const d = deliveries.slice(0, -1); set(d.length ? { status: 'completed', deliveries: d, updatedAt: t } : null); }
      else set(deliveries.length ? { status: 'completed', deliveries, updatedAt: t } : null); // reset: back to not started, history kept
      return { progress };
    });
  }, [update]);

  const create = useCallback((name = '') => {
    if (chars.length >= MAX_CHARACTERS) return;
    const c = newCharacter(name || `Personagem ${chars.length + 1}`);
    setChars((l) => [...l, c]);
    setActiveId(c.id);
    scheduleSave(c);
  }, [chars.length, scheduleSave, setActiveId]);

  const remove = useCallback((id: string) => {
    if (chars.length <= 1) return;
    window.clearTimeout(timers.current.get(id));
    latest.current.delete(id);
    setChars((l) => l.filter((c) => c.id !== id));
    store.remove(id).catch(() => setSaveState('error'));
  }, [chars.length, store]);

  const settings = data?.settings ?? DEFAULT_SETTINGS_FALLBACK;
  const table = useMemo(() => (data ? makeExpTable(data.expLevels, settings.expTableMode) : null), [data, settings.expTableMode]);
  const plan = useMemo(() => (data && active ? makeContext(data.expLevels, settings, data.bonuses, active.bonuses) : null), [data, settings, active]);
  const start = useMemo(() => (table && active ? pctToState(table, active.level, active.expPct) : null), [table, active]);

  const togglePlanner = useCallback((id: string) => setPlannerIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])), []);

  const value: QuestCtx = {
    status: status === 'ready' && !charsLoaded ? 'loading' : status, data, reload: load, table, settings, chars, active, setActiveId, update, setQuestState, create, remove,
    saveState, storage: useAccount ? 'account' : 'local', plan, start, now, tab, setTab, calcQuestId, setCalcQuestId, plannerIds, setPlannerIds, togglePlanner,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
