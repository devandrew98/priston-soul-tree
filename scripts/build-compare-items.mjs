// Builds src/lib/aging/compare-items.json: base stats (common rarity, best roll) of every weapon, armor and robe of
// pristontale.eu/database. Orbs and shields are left out on purpose (their data on the site is wrong).
// The rarity bonus is NOT stored here: it is applied by src/lib/aging/compare.ts, the same way the site does it.
//
//   node scripts/build-compare-items.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://pristontale.eu/database/catalog?entity=items';
const items = JSON.parse(readFileSync('src/lib/aging/items.json', 'utf8')).filter((i) => i.c === 'weapon' || i.c === 'armor' || i.c === 'robe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = [];
const problems = [];
for (const it of items) {
  let d = null;
  for (let attempt = 0; attempt < 3 && !d; attempt++) {
    try {
      const res = await fetch(`${BASE}&id=${it.id}`);
      if (res.ok) d = await res.json();
      else await sleep(1000);
    } catch { await sleep(1000); }
  }
  if (!d?.stats) { problems.push(it.id + ' ' + it.n); continue; }
  const s = d.stats;
  const row = {
    id: it.id, n: d.name, c: it.c, t: d.itemType, l: d.requirements?.level ?? 0, b: d.isBossItem ? 1 : 0,
    f: d.requirements?.fusion_level ?? 0,
  };
  if (it.c === 'weapon') Object.assign(row, { dmin: s.attack_power_1_max, dmax: s.attack_power_2_max, crit: s.critical, atr: s.attack_rating_max });
  else Object.assign(row, { def: s.defense_max, abs: s.absorb_max });
  out.push(row);
  await sleep(120);
}
writeFileSync('src/lib/aging/compare-items.json', JSON.stringify(out));
console.log('items:', out.length, 'problems:', problems.length, problems.join(' | '));
