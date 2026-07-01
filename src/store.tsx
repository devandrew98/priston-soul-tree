import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Build, Inventory, SlotState } from './lib/types';
import { TREE_NODES } from './lib/tree';
import { decodeBuild } from './lib/share';
import { openByCode, rememberOpened } from './lib/cloud';

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

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as PersistShape;
      if (p.builds?.length) {
        // ensure every build has all slots
        for (const b of p.builds) {
          const base = emptySlots();
          b.slots = { ...base, ...b.slots };
        }
        if (typeof p.fusionLevel !== 'number') p.fusionLevel = DEFAULT_FUSION_LEVEL;
        return p;
      }
    }
  } catch (e) {
    console.warn('failed to load state', e);
  }
  const b = newBuild('Minha Build');
  return { inventory: {}, builds: [b], activeBuildId: b.id, fusionLevel: DEFAULT_FUSION_LEVEL };
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
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistShape>(load);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

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
      updateActive((b) => ({ ...b, slots: { ...b.slots, [slotId]: { ...b.slots[slotId], ...patch } } })),
    clearSlot: (slotId) =>
      updateActive((b) => ({
        ...b,
        slots: { ...b.slots, [slotId]: { soulId: null, soulLevel: 1, nodeLevel: b.slots[slotId].nodeLevel } },
      })),
    clearBuild: () => updateActive((b) => ({ ...b, slots: emptySlots() })),
    applySlots: (slots) => updateActive((b) => ({ ...b, slots: { ...emptySlots(), ...slots } })),
    selectBuild: (id) => setState((s) => ({ ...s, activeBuildId: id })),
    createBuild: (name) =>
      setState((s) => {
        const b = newBuild(name || 'Nova Build');
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
      setState((s) => ({ ...s, builds: [...s.builds, b], activeBuildId: b.id }));
      return b.id;
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
