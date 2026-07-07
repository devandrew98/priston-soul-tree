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
 *  reach every node (dist 0 for already-open nodes). Used by the generator and
 *  the solver's hot path — O(V²) with linear extract-min, which beats a
 *  sort-based queue by a wide margin on this 36-node graph. */
export function reachAll(unlocked: Set<string>): { dist: Record<string, number>; prev: Record<string, string | null> } {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  for (const id of unlocked) {
    dist[id] = 0;
    prev[id] = null;
  }
  for (;;) {
    let cur: string | null = null;
    let cd = Infinity;
    for (const id in dist) {
      if (!visited.has(id) && dist[id] < cd) {
        cd = dist[id];
        cur = id;
      }
    }
    if (cur === null) break;
    visited.add(cur);
    for (const nb of ADJACENCY[cur] || []) {
      if (visited.has(nb)) continue;
      const nd = cd + unlockCost(nb);
      if (dist[nb] === undefined || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur;
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
// ---- integer-indexed fast core (the solver evaluates thousands of builds/s,
// and this Steiner is its hot path — typed arrays beat Records/Sets ~30×) ----
const N_NODES = TREE_NODES.length;
const NODE_IDX: Record<string, number> = {};
TREE_NODES.forEach((n, i) => (NODE_IDX[n.id] = i));
const NODE_IDS: string[] = TREE_NODES.map((n) => n.id);
const COST_I = new Float64Array(N_NODES).map((_, i) => RARITY_POINT_COST[TREE_NODES[i].rarity]);
const ADJ_I: number[][] = TREE_NODES.map((n) => (ADJACENCY[n.id] || []).map((id) => NODE_IDX[id]));
const ROOT_I = NODE_IDX[ROOT_NODE];
// scratch buffers reused across calls (single-threaded per JS context)
const S_DIST = new Float64Array(N_NODES);
const S_PREV = new Int32Array(N_NODES);
const S_DONE = new Uint8Array(N_NODES);
const S_OPEN = new Uint8Array(N_NODES);

export function unlockedFor(souled: string[]): Set<string> {
  const pending: number[] = [];
  const seen = new Uint8Array(N_NODES);
  for (const id of souled) {
    const i = NODE_IDX[id];
    if (i === undefined || i === ROOT_I || seen[i]) continue;
    seen[i] = 1;
    pending.push(i);
  }
  S_OPEN.fill(0);
  S_OPEN[ROOT_I] = 1;
  const openList: number[] = [ROOT_I];
  let remaining = pending.length;

  while (remaining > 0) {
    // ONE node-weighted Dijkstra from the whole open set per round.
    S_DIST.fill(Infinity);
    S_DONE.fill(0);
    S_PREV.fill(-1);
    for (const o of openList) S_DIST[o] = 0;
    for (;;) {
      let cur = -1;
      let cd = Infinity;
      for (let i = 0; i < N_NODES; i++) {
        if (!S_DONE[i] && S_DIST[i] < cd) {
          cd = S_DIST[i];
          cur = i;
        }
      }
      if (cur < 0) break;
      S_DONE[cur] = 1;
      const adj = ADJ_I[cur];
      for (let k = 0; k < adj.length; k++) {
        const nb = adj[k];
        if (S_DONE[nb]) continue;
        const nd = cd + COST_I[nb];
        if (nd < S_DIST[nb]) {
          S_DIST[nb] = nd;
          S_PREV[nb] = cur;
        }
      }
    }
    // attach the cheapest still-pending terminal
    let best = -1;
    let bestD = Infinity;
    for (const t of pending) {
      if (!seen[t]) continue;
      if (S_DIST[t] < bestD) {
        bestD = S_DIST[t];
        best = t;
      }
    }
    if (best < 0) break; // unreachable — shouldn't happen on a connected tree
    let cur = best;
    while (cur >= 0 && !S_OPEN[cur]) {
      S_OPEN[cur] = 1;
      openList.push(cur);
      cur = S_PREV[cur];
    }
    seen[best] = 0;
    remaining--;
  }
  return new Set(openList.map((i) => NODE_IDS[i]));
}
