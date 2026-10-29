// Turns the official exports (quests_live.csv + exp_table.csv) into one SQL file for the Quest Tracker:
//   node scripts/build-quest-sql.mjs <quests_live.csv> <exp_table.csv>   ->   supabase/37_quest_official_data.sql
// Nothing is invented: every value comes from the files; empty stays empty. What is derived (and only that):
//   - quest id        = slug of the (unique) name; prerequisites = the ids of the quests named in the file
//   - category id     = slug of the category name (the name itself is kept as the display name)
//   - repeat          = one-time -> once, daily -> daily, interval+168 -> interval 168 h, interval+0 -> repeatable (no wait)
//   - objectives      = "Kill N X" -> monster X x N, "Collect N X" -> item X x N
import { readFileSync, writeFileSync } from 'node:fs';

const [questsPath, expPath] = process.argv.slice(2);
if (!questsPath || !expPath) { console.error('uso: node scripts/build-quest-sql.mjs quests_live.csv exp_table.csv'); process.exit(1); }

function parseCsv(text, sep) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const table = (path, sep) => { const [h, ...r] = parseCsv(readFileSync(path, 'utf8').replace(/^﻿/, ''), sep); return r.map((x) => Object.fromEntries(h.map((k, i) => [k.trim(), (x[i] ?? '').trim()]))); };

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;
const int = (v, what) => { if (v === '') return 'null'; if (!/^\d+$/.test(v)) throw new Error(`${what}: valor inválido "${v}"`); return v; };

const quests = table(questsPath, ';');
const exp = table(expPath, ',');

// ids
const ids = new Map();
const used = new Set();
for (const q of quests) {
  let id = slug(q.name).slice(0, 60) || 'quest';
  for (let n = 2; used.has(id); n++) id = `${slug(q.name).slice(0, 56)}-${n}`;
  used.add(id); ids.set(q.name, id);
}
// categories (the 5 default ones stay; these are added after them)
const cats = new Map();
for (const q of quests) if (!cats.has(q.category)) cats.set(q.category, { id: slug(q.category), sort: 100 + cats.size });
const catIds = new Set();
for (const c of cats.values()) { if (!/^[a-z0-9_-]{2,40}$/.test(c.id) || catIds.has(c.id)) throw new Error(`categoria com id inválido ou repetido: ${c.id}`); catIds.add(c.id); }

const REPEAT = (q) => {
  if (q.repeat === 'one-time') return ['once', 'null'];
  if (q.repeat === 'daily') return ['daily', 'null'];
  if (q.repeat === 'interval') return q['interval (hours)'] === '0' ? ['repeatable', 'null'] : ['interval', int(q['interval (hours)'], 'intervalo')];
  throw new Error(`repetição desconhecida: "${q.repeat}" em ${q.name}`);
};
const objectives = (text) => text.split(' | ').filter(Boolean).map((o) => {
  const m = /^(Kill|Collect) (\d+) (.+)$/.exec(o);
  if (!m) throw new Error(`objetivo fora do padrão: "${o}"`);
  return { kind: m[1] === 'Kill' ? 'monster' : 'item', name: m[3], qty: Number(m[2]) };
});

const out = [];
out.push(`-- Dados oficiais do Quest Tracker (gerado por scripts/build-quest-sql.mjs a partir de quests_live.csv e exp_table.csv).`);
out.push(`-- ${quests.length} quests, ${cats.size} categorias novas e a tabela de EXP dos levels 1 a ${exp.length} (modo "acumulada no início do level").`);
out.push(`-- Rode DEPOIS do 30 e do 31. É seguro rodar de novo, mas isso volta as quests ao texto original (apaga edições feitas no painel).`);
out.push('');
out.push(`-- 1) Remove os DADOS FICTÍCIOS do arquivo 32 (se foram carregados): quests TESTE-nnn e levels acima de 120 que não existem no jogo.`);
out.push(`delete from public.quests where id like 'TESTE-%';`);
out.push(`delete from public.exp_levels where level > ${exp.length};`);
out.push('');
out.push(`-- 2) Categorias (as 5 padrão continuam; estas são o "grupo do livro de quests" do jogo)`);
out.push(`insert into public.quest_categories (id, name, sort, builtin) values`);
out.push([...cats.entries()].map(([name, c]) => `  (${sql(c.id)}, ${sql(name)}, ${c.sort}, false)`).join(',\n'));
out.push(`on conflict (id) do update set name = excluded.name, sort = excluded.sort;`);
out.push('');
out.push(`-- 3) Tabela de EXP: o valor do level L é o EXP total ao chegar no level L (level 1 = 0). Sem extrapolar além do level ${exp.length}.`);
out.push(`insert into public.exp_levels (level, value) values`);
out.push(exp.map((r) => `  (${int(r.level, 'level')}, ${int(r.exp, 'exp')})`).join(',\n'));
out.push(`on conflict (level) do update set value = excluded.value, active = true;`);
out.push(`update public.quest_settings set exp_table_mode = 'cumulative_start' where id = 1;`);
out.push('');
out.push(`-- 4) Quests. EXP 0 é um valor real (a quest não dá EXP). Campo vazio no arquivo continua vazio (nada foi chutado).`);
out.push(`insert into public.quests (id, name, category_id, min_level, max_level, map, npc, description, objectives, base_exp, prerequisites, repeat_type, repeat_interval_hours, active, archived) values`);
out.push(quests.map((q) => {
  const [rt, hours] = REPEAT(q);
  const pre = q.prerequisites ? [q.prerequisites] : [];
  for (const p of pre) if (!ids.has(p)) throw new Error(`pré-requisito "${p}" de "${q.name}" não existe no arquivo`);
  if (q.exp === '' || !/^\d+$/.test(q.exp)) throw new Error(`EXP inválido em "${q.name}": "${q.exp}"`);
  return `  (${sql(ids.get(q.name))}, ${sql(q.name)}, ${sql(cats.get(q.category).id)}, ${int(q['minimum level'], 'level mínimo')}, ${int(q['maximum level'], 'level máximo')}, ${sql(q.map)}, ${sql(q.npc)}, ${sql(q.description)}, ${sql(JSON.stringify(objectives(q.objectives)))}::jsonb, ${q.exp}, ${pre.length ? `'{${pre.map((p) => ids.get(p)).join(',')}}'` : `'{}'`}, ${sql(rt)}, ${hours}, ${q.active.toLowerCase() === 'yes' ? 'true' : 'false'}, false)`;
}).join(',\n'));
out.push(`on conflict (id) do update set name = excluded.name, category_id = excluded.category_id, min_level = excluded.min_level, max_level = excluded.max_level,
  map = excluded.map, npc = excluded.npc, description = excluded.description, objectives = excluded.objectives, base_exp = excluded.base_exp,
  prerequisites = excluded.prerequisites, repeat_type = excluded.repeat_type, repeat_interval_hours = excluded.repeat_interval_hours, active = excluded.active, archived = false;`);
out.push('');

writeFileSync(new URL('../supabase/37_quest_official_data.sql', import.meta.url), out.join('\n'));
console.log(`ok: ${quests.length} quests, ${cats.size} categorias, ${exp.length} levels`);
