import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Build, Inventory, SlotState } from './lib/types';
import { TREE_NODES } from './lib/tree';
import { decodeBuild } from './lib/share';
import { openByCode, rememberOpened } from './lib/cloud';
import { getPlayerCode, setPlayerCode, createPlayer, savePlayer, loadPlayer } from './lib/player';

const LS_KEY = 'priston-soul-tree-v2';
const DEFAULT_FUSION_LEVEL = 198;

interface PersistShape {
  inventory: Inventory;
  builds: Build[];
  activeBuildId: string | null;
  fusionLevel: number;
}

function emptySlots(): Record<string, SlotState> {
  const s: Record<string, SlotState> = {};
  for (const def of TREE_NODES) {
    s[def.id] = { soulId: null, soulLevel: 1, nodeLevel: 1 };
  }
  return s;
}

function newBuild(name: string): Build {
  const now = Date.now();
  return { id: 'b-' + now + '-' + Math.random().toString(36).slice(2, 7), name, slots: emptySlots(), createdAt: now, updatedAt: now };
}

/** Mark every soul placed in `slots` as owned (keeping the highest level seen). */
function mergeOwned(inv: Inventory, slots: Record<string, SlotState>): Inventory {
  const out: Inventory = { ...inv };
  for (const s of Object.values(slots)) {
    if (!s.soulId) continue;
    const lvl = (s.soulLevel || 1) as 1 | 2 | 3;
    if (!out[s.soulId] || out[s.soulId]! < lvl) out[s.soulId] = lvl;
  }
  return out;
}

/** Ensure a loaded state has all slots, an inventory and at least one build. */
function normalize(p: PersistShape): PersistShape {
  if (!p || typeof p !== 'object') p = {} as PersistShape;
  if (!p.inventory || typeof p.inventory !== 'object') p.inventory = {};
  if (typeof p.fusionLevel !== 'number') p.fusionLevel = DEFAULT_FUSION_LEVEL;
  if (!Array.isArray(p.builds) || !p.builds.length) {
    const b = newBuild(localStorage.getItem('site-lang') === 'en' ? 'My Build' : 'Minha Build');
    p.builds = [b];
    p.activeBuildId = b.id;
  }
  for (const b of p.builds) {
    b.slots = { ...emptySlots(), ...b.slots };
    if (!Array.isArray(b.opened)) b.opened = [];
  }
  if (!p.activeBuildId || !p.builds.some((b) => b.id === p.activeBuildId)) {
    p.activeBuildId = p.builds[0].id;
  }
  return p;
}

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalize(JSON.parse(raw) as PersistShape);
  } catch (e) {
    console.warn('failed to load state', e);
  }
  return normalize({} as PersistShape);
}

/** Total fusion points available: 16 (levels 1-80) + 1 per fusion level. */
export function totalFusionPoints(fusionLevel: number): number {
  return 16 + Math.max(0, fusionLevel);
}

interface Store {
  inventory: Inventory;
  builds: Build[];
  activeBuild: Build;
  fusionLevel: number;
  setFusionLevel: (level: number) => void;
  setOwned: (soulId: string, level: 0 | 1 | 2 | 3) => void;
  bulkSetOwned: (level: 0 | 1 | 2 | 3, soulIds?: string[]) => void;
  setSlot: (slotId: string, patch: Partial<SlotState>) => void;
  clearSlot: (slotId: string) => void;
  clearBuild: () => void;
  applySlots: (slots: Record<string, SlotState>) => void;
  selectBuild: (id: string) => void;
  createBuild: (name: string) => void;
  duplicateBuild: () => void;
  renameBuild: (name: string) => void;
  deleteBuild: () => void;
  importBuild: (name: string, slots: Record<string, SlotState>) => string;
  // cloud player sync (optional, via a short code)
  playerCode: string | null;
  syncStatus: string;
  startSync: () => void;
  syncWithCode: (code: string) => void;
  stopSync: () => void;
  saveNow: () => void;
  /** Move (or swap) the soul from one node to another, keeping each node's own level. */
  moveSoul: (fromId: string, toId: string) => void;
  /** Open/close an empty node manually (unlock without placing a soul). */
  toggleOpen: (nodeId: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistShape>(load);
  const [playerCode, setPlayerCodeState] = useState<string | null>(getPlayerCode());
  const [syncStatus, setSyncStatus] = useState('');
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  // Load this player's cloud data on mount (if a code is remembered).
  useEffect(() => {
    const code = getPlayerCode();
    if (!code) { hydrated.current = true; return; }
    loadPlayer(code)
      .then((data) => {
        if (data && typeof data === 'object') {
          setState(normalize(data as PersistShape));
          setSyncStatus('st.sync.loaded');
        }
      })
      .catch(() => setSyncStatus('st.sync.offline'))
      .finally(() => { hydrated.current = true; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to the cloud (debounced) whenever the state changes.
  useEffect(() => {
    if (!playerCode || !hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePlayer(playerCode, state)
        .then(() => setSyncStatus('st.sync.saved'))
        .catch(() => setSyncStatus('st.sync.savefail'));
    }, 1200);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, playerCode]);

  const activeBuild = useMemo(
    () => state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0],
    [state],
  );

  const updateActive = (fn: (b: Build) => Build) => {
    setState((s) => ({
      ...s,
      builds: s.builds.map((b) => (b.id === activeBuild.id ? { ...fn(b), updatedAt: Date.now() } : b)),
    }));
  };

  const store: Store = {
    inventory: state.inventory,
    builds: state.builds,
    activeBuild,
    fusionLevel: state.fusionLevel,
    setFusionLevel: (level) => setState((s) => ({ ...s, fusionLevel: Math.max(1, Math.min(400, Math.round(level || 0))) })),
    setOwned: (soulId, level) =>
      setState((s) => {
        const inv = { ...s.inventory };
        if (level === 0) delete inv[soulId];
        else inv[soulId] = level;
        return { ...s, inventory: inv };
      }),
    bulkSetOwned: (level, soulIds) =>
      setState((s) => {
        const inv = { ...s.inventory };
        const ids = soulIds ?? Object.keys(inv);
        if (!soulIds) {
          // operate on all souls when no list: only meaningful for clearing
        }
        for (const id of ids) {
          if (level === 0) delete inv[id];
          else inv[id] = level;
        }
        return { ...s, inventory: inv };
      }),
    setSlot: (slotId, patch) =>
      setState((s) => {
        const active = s.builds.find((b) => b.id === s.activeBuildId) ?? s.builds[0];
        const newSlot = { ...active.slots[slotId], ...patch };
        return {
          ...s,
          inventory: newSlot.soulId ? mergeOwned(s.inventory, { n: newSlot }) : s.inventory,
          builds: s.builds.map((b) => (b.id === active.id ? { ...b, slots: { ...b.slots, [slotId]: newSlot }, updatedAt: Date.now() } : b)),
        };
      }),
    clearSlot: (slotId) =>
      updateActive((b) => ({
        ...b,
        slots: { ...b.slots, [slotId]: { soulId: null, soulLevel: 1, nodeLevel: b.slots[slotId].nodeLevel } },
      })),
    clearBuild: () => updateActive((b) => ({ ...b, slots: emptySlots() })),
    toggleOpen: (nodeId) =>
      setState((s) => {
        const active = s.builds.find((b) => b.id === s.activeBuildId) ?? s.builds[0];
        if (active.slots[nodeId]?.soulId) return s; // souled nodes are managed via the soul
        const opened = new Set(active.opened ?? []);
        if (opened.has(nodeId)) opened.delete(nodeId);
        else opened.add(nodeId);
        return { ...s, builds: s.builds.map((b) => (b.id === active.id ? { ...b, opened: [...opened], updatedAt: Date.now() } : b)) };
      }),
    moveSoul: (fromId, toId) =>
      setState((s) => {
        if (fromId === toId) return s;
        const active = s.builds.find((b) => b.id === s.activeBuildId) ?? s.builds[0];
        const from = active.slots[fromId];
        const to = active.slots[toId];
        if (!from?.soulId) return s;
        // Swap the soul (id + its level) between the two nodes; node levels stay put.
        const slots = {
          ...active.slots,
          [fromId]: { ...from, soulId: to?.soulId ?? null, soulLevel: to?.soulLevel ?? 1 },
          [toId]: { ...to, soulId: from.soulId, soulLevel: from.soulLevel },
        };
        return { ...s, builds: s.builds.map((b) => (b.id === active.id ? { ...b, slots, updatedAt: Date.now() } : b)) };
      }),
    applySlots: (slots) =>
      setState((s) => {
        const active = s.builds.find((b) => b.id === s.activeBuildId) ?? s.builds[0];
        return {
          ...s,
          inventory: mergeOwned(s.inventory, slots),
          builds: s.builds.map((b) => (b.id === active.id ? { ...b, slots: { ...emptySlots(), ...slots }, updatedAt: Date.now() } : b)),
        };
      }),
    selectBuild: (id) => setState((s) => ({ ...s, activeBuildId: id })),
    createBuild: (name) =>
      setState((s) => {
        const b = newBuild(name || (localStorage.getItem('site-lang') === 'en' ? 'New Build' : 'Nova Build'));
        return { ...s, builds: [...s.builds, b], activeBuildId: b.id };
      }),
    duplicateBuild: () =>
      setState((s) => {
        const src = s.builds.find((b) => b.id === s.activeBuildId) ?? s.builds[0];
        const b = newBuild(src.name + ' (cópia)');
        b.slots = JSON.parse(JSON.stringify(src.slots));
        return { ...s, builds: [...s.builds, b], activeBuildId: b.id };
      }),
    renameBuild: (name) => updateActive((b) => ({ ...b, name })),
    deleteBuild: () =>
      setState((s) => {
        if (s.builds.length <= 1) return s;
        const builds = s.builds.filter((b) => b.id !== s.activeBuildId);
        return { ...s, builds, activeBuildId: builds[0].id };
      }),
    importBuild: (name, slots) => {
      const b = newBuild(name);
      b.slots = { ...emptySlots(), ...slots };
      setState((s) => ({ ...s, inventory: mergeOwned(s.inventory, slots), builds: [...s.builds, b], activeBuildId: b.id }));
      return b.id;
    },
    playerCode,
    syncStatus,
    startSync: () => {
      setSyncStatus('st.sync.creating');
      createPlayer(state)
        .then((code) => { setPlayerCodeState(code); hydrated.current = true; setSyncStatus('st.sync.saved'); })
        .catch((e) => setSyncStatus(e.message || 'st.sync.fail'));
    },
    syncWithCode: (code) => {
      const c = code.toUpperCase().trim();
      if (!c) return;
      setSyncStatus('st.sync.loading');
      loadPlayer(c)
        .then((data) => {
          if (data && typeof data === 'object') {
            setState(normalize(data as PersistShape));
            setPlayerCode(c);
            setPlayerCodeState(c);
            hydrated.current = true;
            setSyncStatus('st.sync.loaded');
          } else {
            setSyncStatus('st.sync.nodata');
          }
        })
        .catch((e) => setSyncStatus(e.message || 'st.sync.fail'));
    },
    stopSync: () => { setPlayerCode(null); setPlayerCodeState(null); setSyncStatus('st.sync.off'); },
    saveNow: () => {
      if (playerCode) {
        setSyncStatus('st.sync.saving');
        savePlayer(playerCode, state).then(() => setSyncStatus('st.sync.saved')).catch(() => setSyncStatus('st.sync.savefail'));
      } else {
        setSyncStatus('st.sync.savedlocal');
      }
    },
  };

  // Import a build shared via URL hash, then strip it from the URL.
  //   #b=<payload>  -> full build embedded in the link (offline)
  //   #c=<code>     -> short code resolved from the cloud
  useEffect(() => {
    const hash = window.location.hash;
    const strip = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);

    const mb = hash.match(/^#b=(.+)$/);
    if (mb) {
      const decoded = decodeBuild(mb[1]);
      if (decoded) store.importBuild(decoded.name, decoded.slots);
      strip();
      return;
    }
    const mc = hash.match(/^#c=([A-Za-z0-9]+)$/);
    if (mc) {
      strip();
      openByCode(mc[1])
        .then((data) => {
          const id = store.importBuild(data.name + ' (' + data.code + ')', data.slots);
          rememberOpened(id, data.code, data.publicEdit);
        })
        .catch(() => { /* invalid/expired code — ignore */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used within StoreProvider');
  return s;
}
