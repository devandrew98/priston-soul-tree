import fs from 'fs';

const lines = fs.readFileSync('souls.txt', 'utf8').split('\n');

// Map wiki section headers -> icon category used by the game tree
const sectionMap = [
  { re: /Attack Souls \(Sword Icon\)/i, cat: 'attack' },
  { re: /Defense Souls \(Shield Icon\)/i, cat: 'defense' },
  { re: /Utility Souls \(Tower Icon\)/i, cat: 'support' },
  { re: /PVP Attack Souls/i, cat: 'pvp' },
  { re: /PVP Defense Souls/i, cat: 'pvp' },
];

// Normalize benefit label -> stat key + display + unit
const statMap = {
  'Attack Power': { key: 'attackPower', label: 'Attack Power', unit: 'flat' },
  'Attack Rating': { key: 'attackRating', label: 'Attack Rating', unit: 'flat' },
  'Critical Rate': { key: 'critRate', label: 'Critical Rate', unit: 'pct' },
  'Crit': { key: 'critRate', label: 'Critical Rate', unit: 'pct' },
  'Exp': { key: 'exp', label: 'EXP', unit: 'pct' },
  'Mana': { key: 'mana', label: 'Mana', unit: 'flat' },
  'Movement Speed': { key: 'moveSpeed', label: 'Movement Speed', unit: 'flat' },
  'Stamina': { key: 'stamina', label: 'Stamina', unit: 'flat' },
  'Absorb': { key: 'absorb', label: 'Absorption', unit: 'flat' },
  'Block': { key: 'block', label: 'Block', unit: 'pct' },
  'Defense': { key: 'defense', label: 'Defense', unit: 'flat' },
  'Evade': { key: 'evade', label: 'Evade', unit: 'pct' },
  'HP': { key: 'hp', label: 'HP', unit: 'flat' },
  'Aging Success': { key: 'agingSuccess', label: 'Aging Success', unit: 'pct' },
  'Own Item Type': { key: 'ownItemType', label: 'Own Item Drop', unit: 'pct' },
  'Own Spec Chance': { key: 'ownSpecChance', label: 'Own Spec Drop', unit: 'pct' },
};

function num(s) {
  if (s == null) return null;
  s = s.replace('%', '').trim();
  if (s === '' ) return null;
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

// Collect "cell" lines: strip trailing " |"
const cells = lines.map(l => l.replace(/\s*\|\s*$/, '').trim());

let cat = null;
const souls = [];
let i = 0;
// Find rows: a row is name,level,benefit,r1,r2,r3 where benefit is in statMap
for (; i < lines.length; i++) {
  const raw = lines[i];
  // section header
  for (const s of sectionMap) {
    if (s.re.test(raw)) cat = s.cat;
  }
  if (!cat) continue;
  // candidate: current line is a name, line+2 a benefit
  const c0 = cells[i];
  const c1 = cells[i + 1];
  const c2 = cells[i + 2];
  const c3 = cells[i + 3];
  const c4 = cells[i + 4];
  const c5 = cells[i + 5];
  if (!c0 || /\|/.test(raw) === false) {
    // we rely on table cells ending with '|', check original line had '|'
  }
  // Only treat as a row if original line ended with ' |' and is non-empty text
  const isCell = /\|\s*$/.test(raw) && c0 !== '';
  if (!isCell) continue;
  // skip header rows
  if (/^Soul$/i.test(c0)) continue;
  // must have benefit two lines down that maps to a stat
  if (c2 && statMap[c2]) {
    const lvl = num(c1);
    const st = statMap[c2];
    const r1 = num(c3), r2 = num(c4), r3 = num(c5);
    if (r1 != null && r2 != null && r3 != null) {
      souls.push({
        name: c0,
        mapLevel: lvl,
        category: cat,
        stat: st.key,
        statLabel: st.label,
        unit: st.unit,
        ranks: [r1, r2, r3],
      });
      i += 5; // advance past this row's cells
    }
  }
}

// --- Map each soul to its image file in public/fusion ---
const imgDir = 'public/fusion';
const imgFiles = fs.readdirSync(imgDir).filter((f) => /Soul\.png$/.test(f) && !/_d\.png$/.test(f));
const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const imgByNorm = {};
for (const f of imgFiles) {
  const baseNorm = normalize(f.replace(/Soul\.png$/, ''));
  imgByNorm[baseNorm] = f;
}
// known spelling differences wiki -> asset
const aliases = {
  vengefullsaint: 'vengefulsaint',
};
function findImg(name) {
  let n = normalize(name);
  if (aliases[n]) n = aliases[n];
  if (imgByNorm[n]) return imgByNorm[n];
  // try without doubled letters
  const dedup = n.replace(/(.)\1+/g, '$1');
  for (const k of Object.keys(imgByNorm)) {
    if (k === dedup || k.replace(/(.)\1+/g, '$1') === dedup) return imgByNorm[k];
  }
  return null;
}
let matched = 0;
for (const s of souls) {
  const img = findImg(s.name);
  s.img = img ? `/fusion/${img}` : null;
  if (img) matched++;
}
console.log(`Matched images: ${matched}/${souls.length}`);

// Build a stable id
const seen = {};
for (const s of souls) {
  let base = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let id = base + '-' + s.stat;
  if (seen[id]) id = id + '-' + (++seen[id]);
  else seen[id] = 1;
  s.id = id;
}

fs.writeFileSync('src/data/souls.json', JSON.stringify(souls, null, 2));
console.log('Parsed', souls.length, 'souls');
const byCat = {};
const byStat = {};
for (const s of souls) {
  byCat[s.category] = (byCat[s.category] || 0) + 1;
  byStat[s.stat] = (byStat[s.stat] || 0) + 1;
}
console.log('By category:', byCat);
console.log('By stat:', byStat);
