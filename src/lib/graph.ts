import { TREE_EDGES, TREE_NODES, TREE_NODE_BY_ID, RARITY_POINT_COST } from './tree';

// The tree unlocks from the very top node and spreads along the connections.
export const ROOT_NODE = 't1';

/** Undirected adjacency built from the tree edges. */
export const ADJACENCY: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const n of TREE_NODES) m[n.id] = [];
  for (const e of TREE_EDGES) {
    if (m[e.a] && m[e.b]) {
      m[e.a].push(e.b);
      m[e.b].push(e.a);
    }
  }
  return m;
})();

/** Points to unlock (open) a node — its rarity cost (common 1 / rare 2 / legendary 3). */
export function unlockCost(nodeId: string): number {
  const n = TREE_NODE_BY_ID[nodeId];
  return n ? RARITY_POINT_COST[n.rarity] : 1;
}

/**
 * Cheapest chain of still-locked nodes to open so that `target` becomes reachable
 * from the already-`unlocked` set. Node-weighted Dijkstra (each hop costs the
 * unlock cost of the node you enter; already-unlocked nodes are free).
 * Returns the nodes to open (root→target order, excluding already-unlocked) and
 * their total unlock cost.
 */
export function shortestUnlockPath(unlocked: Set<string>, target: string): { path: string[]; cost: number } {
  if (unlocked.has(target)) return { path: [], cost: 0 };
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const pq: { id: string; d: number }[] = [];
  for (const id of unlocked) {
    dist[id] = 0;
    prev[id] = null;
    pq.push({ id, d: 0 });
  }
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    if (cur.id === target) break;
    for (const nb of ADJACENCY[cur.id] || []) {
      if (visited.has(nb)) continue;
      const nd = cur.d + unlockCost(nb);
      if (dist[nb] === undefined || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur.id;
        pq.push({ id: nb, d: nd });
      }
    }
  }
  if (dist[target] === undefined) return { path: [], cost: Infinity };
  const path: string[] = [];
  let cur: string | null = target;
  while (cur && !unlocked.has(cur)) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();
  return { path, cost: dist[target] };
}

/** Node-weighted Dijkstra from the whole `unlocked` set: unlock cost + path to
 *  reach every node (dist 0 for already-open nodes). Used by the generator. */
export function reachAll(unlocked: Set<string>): { dist: Record<string, number>; prev: Record<string, string | null> } {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const pq: { id: string; d: number }[] = [];
  for (const id of unlocked) {
    dist[id] = 0;
    prev[id] = null;
    pq.push({ id, d: 0 });
  }
  while (pq.length) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);
    for (const nb of ADJACENCY[cur.id] || []) {
      if (visited.has(nb)) continue;
      const nd = cur.d + unlockCost(nb);
      if (dist[nb] === undefined || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur.id;
        pq.push({ id: nb, d: nd });
      }
    }
  }
  return { dist, prev };
}

/**
 * The full set of nodes that must be open so every `souled` node is connected to
 * the root — i.e. the souled nodes plus the cheapest pass-through nodes. Greedy
 * Steiner-tree heuristic: start at the root, then repeatedly attach the terminal
 * that is cheapest to reach from what is already open.
 */
export function unlockedFor(souled: string[]): Set<string> {
  const unlocked = new Set<string>([ROOT_NODE]);
  const pending = new Set(souled.filter((id) => id !== ROOT_NODE && TREE_NODE_BY_ID[id]));
  while (pending.size) {
    let best: { path: string[]; cost: number; id: string } | null = null;
    for (const t of pending) {
      const r = shortestUnlockPath(unlocked, t);
      if (r.cost === Infinity) continue;
      if (!best || r.cost < best.cost) best = { ...r, id: t };
    }
    if (!best) break; // unreachable — shouldn't happen on a connected tree
    for (const id of best.path) unlocked.add(id);
    for (const t of [...pending]) if (unlocked.has(t)) pending.delete(t);
  }
  return unlocked;
}
