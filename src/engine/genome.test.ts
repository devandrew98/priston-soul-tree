import { describe, it, expect } from 'vitest';
import type { Build } from '../lib/types';
import { pointsSpent } from '../lib/calc';
import { SOULS_BY_ID } from '../lib/souls';
import { TREE_NODE_BY_ID, NODE_CATEGORY, acceptsSoul, pvpSoulKind } from '../lib/tree';
import { candidateSouls, compatibleNodes, genomeToSlots, slotsToGenome, hashGenome, mutate } from './genome';
import { genomeCost } from './pathfinder';
import { mulberry32 } from './rng';
import type { EngineConfig, Genome } from './types';

const cfg: EngineConfig = {
  weights: { attackPower: 1, defense: 1, exp: 6 },
  inventory: {},
  allSouls: true,
  includePvp: false,
  budget: 150,
  timeMs: 100,
  rngSeed: 7,
};

describe('Genome', () => {
  it('hash is stable regardless of key insertion order', () => {
    const cands = candidateSouls(cfg);
    const nodes = compatibleNodes(cands);
    const [c1, c2] = cands;
    const [n1] = nodes.get(c1.soulId)!;
    const n2 = nodes.get(c2.soulId)!.find((x) => x !== n1)!;
    const a: Genome = {
      [n1]: { soulId: c1.soulId, soulLevel: 3, nodeLevel: 2 },
      [n2]: { soulId: c2.soulId, soulLevel: 3, nodeLevel: 1 },
    };
    const b: Genome = {
      [n2]: { soulId: c2.soulId, soulLevel: 3, nodeLevel: 1 },
      [n1]: { soulId: c1.soulId, soulLevel: 3, nodeLevel: 2 },
    };
    expect(hashGenome(a)).toBe(hashGenome(b));
    const c: Genome = { ...a, [n1]: { ...a[n1], nodeLevel: 3 } };
    expect(hashGenome(c)).not.toBe(hashGenome(a));
  });

  it('slots <-> genome roundtrip preserves the build', () => {
    const cands = candidateSouls(cfg);
    const nodes = compatibleNodes(cands);
    const c = cands[0];
    const [nId] = nodes.get(c.soulId)!;
    const g: Genome = { [nId]: { soulId: c.soulId, soulLevel: 2, nodeLevel: 4 } };
    expect(slotsToGenome(genomeToSlots(g))).toEqual(g);
  });

  it('genomeCost matches calc.pointsSpent (PathFinder = game rules)', () => {
    const cands = candidateSouls(cfg);
    const nodesBy = compatibleNodes(cands);
    const rng = mulberry32(123);
    let g: Genome = {};
    for (let i = 0; i < 300; i++) {
      const nx = mutate(g, cands, nodesBy, rng);
      if (nx) g = nx;
    }
    expect(Object.keys(g).length).toBeGreaterThan(0);
    const build = { id: 't', name: 't', slots: genomeToSlots(g), opened: [], createdAt: 0, updatedAt: 0 } as Build;
    expect(genomeCost(g)).toBe(pointsSpent(build));
  });

  it('defensive PvP node takes only defensive PvP souls (and vice-versa)', () => {
    const defNode = TREE_NODE_BY_ID['bv3_8'];
    const atkNode = TREE_NODE_BY_ID['cv_6'];
    expect(defNode.pvpKind).toBe('def');
    expect(atkNode.pvpKind).toBe('atk');
    const offensive = SOULS_BY_ID['vault-mummy']; // attackPower PvP soul
    const defensive = SOULS_BY_ID['vault-guard']; // defense+absorb PvP soul
    expect(pvpSoulKind(offensive)).toBe('atk');
    expect(pvpSoulKind(defensive)).toBe('def');
    const fits = (n: typeof defNode, s: typeof offensive) =>
      acceptsSoul(NODE_CATEGORY[n.type], n.rarity, s.category, s.rarity, n.pvpKind, pvpSoulKind(s));
    expect(fits(defNode, defensive)).toBe(true);
    expect(fits(defNode, offensive)).toBe(false);
    expect(fits(atkNode, offensive)).toBe(true);
    expect(fits(atkNode, defensive)).toBe(false);
  });

  it('300 random mutations keep every genome structurally valid', () => {
    const cands = candidateSouls(cfg);
    const nodesBy = compatibleNodes(cands);
    const rng = mulberry32(99);
    let g: Genome = {};
    for (let i = 0; i < 300; i++) {
      const nx = mutate(g, cands, nodesBy, rng);
      if (!nx) continue;
      g = nx;
      const soulIds = Object.values(g).map((x) => x.soulId);
      expect(new Set(soulIds).size).toBe(soulIds.length); // souls stay unique
      for (const [nodeId, gene] of Object.entries(g)) {
        const node = TREE_NODE_BY_ID[nodeId];
        const soul = SOULS_BY_ID[gene.soulId];
        expect(node).toBeTruthy();
        expect(soul).toBeTruthy();
        expect(acceptsSoul(NODE_CATEGORY[node.type], node.rarity, soul.category, soul.rarity, node.pvpKind, pvpSoulKind(soul))).toBe(true);
        expect(gene.nodeLevel).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
