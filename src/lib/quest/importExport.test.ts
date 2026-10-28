import { describe, expect, it } from 'vitest';
import {
  buildExpImport, buildQuestImport, expToCsv, parseCsv, parseExpFile, parseObjectives, parseQuestFile, questsToCsv, validateQuest,
} from './importExport';
import type { ExpLevel, Quest, QuestCategory } from './types';

// Made-up data, only for the tests.
const cats: QuestCategory[] = [
  { id: 'normal', name: 'Quests normais', sort: 1, color: '', active: true, builtin: true },
  { id: 'boss', name: 'Quests de bosses', sort: 2, color: '', active: true, builtin: true },
];
const base = (over: Partial<Quest> = {}): Quest => ({
  id: 'q1', name: 'Q1', categoryId: 'normal', minLevel: 10, maxLevel: null, map: 'M', npc: 'N', description: '', objectives: [], baseExp: 100,
  prerequisites: [], repeatType: 'once', repeatIntervalHours: null, active: true, archived: false, ...over,
});

describe('parseCsv', () => {
  it('handles quotes, separators inside quotes and line breaks', () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  it('detects ; and tab as separators and ignores empty lines / BOM', () => {
    expect(parseCsv('﻿a;b\r\n1;2\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseObjectives', () => {
  it('reads the text form', () => {
    expect(parseObjectives('monster:Goblin x10|boss:Rei|item:Chave x2|Falar com o NPC').list).toEqual([
      { kind: 'monster', name: 'Goblin', qty: 10 }, { kind: 'boss', name: 'Rei', qty: null }, { kind: 'item', name: 'Chave', qty: 2 }, { kind: 'other', name: 'Falar com o NPC', qty: null },
    ]);
  });
  it('reads JSON objects and rejects bad quantities', () => {
    expect(parseObjectives([{ kind: 'boss', name: 'X', qty: 1 }]).list[0]).toEqual({ kind: 'boss', name: 'X', qty: 1 });
    expect(parseObjectives([{ kind: 'item', name: 'X', qty: -3 }]).error).toBeTruthy();
  });
});

describe('parseQuestFile', () => {
  it('reads CSV with Portuguese headers and tracks which columns were present', () => {
    const { records } = parseQuestFile('ID;Nome;Categoria;Level Mínimo;EXP\nq1;Primeira;normal;10;500\n');
    expect(records[0].values).toMatchObject({ id: 'q1', name: 'Primeira', category: 'normal', minLevel: '10', baseExp: '500' });
    expect(records[0].provided.has('map')).toBe(false);
    expect(records[0].line).toBe(2);
  });
  it('reads JSON arrays and { quests: [] }', () => {
    expect(parseQuestFile('[{"id":"a","name":"A"}]').records).toHaveLength(1);
    expect(parseQuestFile('{"quests":[{"id":"a"},{"id":"b"}]}').records).toHaveLength(2);
  });
  it('reports broken files', () => {
    expect(parseQuestFile('').error).toBeTruthy();
    expect(parseQuestFile('[{').error).toMatch(/JSON/);
    expect(parseQuestFile('id,name').error).toBeTruthy();
  });
});

describe('buildQuestImport', () => {
  const file = (text: string) => parseQuestFile(text).records;

  it('new quests are validated and previewed', () => {
    const p = buildQuestImport(file('id,name,category,minLevel,baseExp\na1,Alpha,normal,5,300\n'), [], cats, false);
    expect(p.counts.new).toBe(1);
    expect(p.toSave[0]).toMatchObject({ id: 'a1', name: 'Alpha', categoryId: 'normal', minLevel: 5, baseExp: 300, active: true, repeatType: 'once' });
  });
  it('finds errors: missing id, unknown category, bad numbers, max below min, duplicates in the file', () => {
    const csv = 'id,name,category,minLevel,maxLevel,baseExp\n,NoId,normal,1,,1\nb1,B,ghost,1,,1\nb2,B2,normal,x,,1\nb3,B3,normal,10,5,1\nb4,B4,normal,1,,1\nb4,B4 again,normal,1,,1\n';
    const p = buildQuestImport(file(csv), [], cats, false);
    expect(p.rows.map((r) => r.action)).toEqual(['error', 'error', 'error', 'error', 'new', 'error']);
    expect(p.rows[1].errors[0]).toMatch(/categoria desconhecida/);
    expect(p.rows[5].errors[0]).toMatch(/duplicado/);
    expect(p.toSave).toHaveLength(1);
  });
  it('existing quests are skipped unless updating is on', () => {
    const csv = 'id,name\nq1,Novo nome\n';
    expect(buildQuestImport(file(csv), [base()], cats, false).rows[0].action).toBe('skip');
    const up = buildQuestImport(file(csv), [base()], cats, true);
    expect(up.rows[0]).toMatchObject({ action: 'update', changes: ['name'] });
    expect(up.toSave[0].name).toBe('Novo nome');
  });
  it('an update only changes the columns in the file: absent columns keep their value', () => {
    const up = buildQuestImport(file('id,baseExp\nq1,999\n'), [base({ map: 'Keep', npc: 'Keep too' })], cats, true);
    expect(up.toSave[0]).toMatchObject({ baseExp: 999, map: 'Keep', npc: 'Keep too', name: 'Q1', minLevel: 10 });
  });
  it('an update with nothing different is "same" and is not saved', () => {
    const p = buildQuestImport(file('id,name,baseExp\nq1,Q1,100\n'), [base()], cats, true);
    expect(p.rows[0].action).toBe('same');
    expect(p.toSave).toEqual([]);
  });
  it('category by name or id, repeat type in Portuguese, active in Portuguese', () => {
    const p = buildQuestImport(file('id,name,category,repeticao,ativo\nd1,Diária,Quests de bosses,diária,não\n'), [], cats, false);
    expect(p.toSave[0]).toMatchObject({ categoryId: 'boss', repeatType: 'daily', active: false });
  });
  it('an interval quest needs its hours', () => {
    expect(buildQuestImport(file('id,name,category,repeatType\ni1,I,normal,interval\n'), [], cats, false).rows[0].errors.join()).toMatch(/intervalo/);
    expect(buildQuestImport(file('id,name,category,repeatType,intervalo\ni1,I,normal,interval,72\n'), [], cats, false).rows[0].action).toBe('new');
  });
  it('warns about a prerequisite that does not exist yet, but accepts one defined in the same file', () => {
    const p = buildQuestImport(file('id,name,category,prerequisites\nb,B,normal,a\na,A,normal,\nc,C,normal,zzz\n'), [], cats, false);
    expect(p.rows[0].warnings.join()).not.toMatch(/não existe/);
    expect(p.rows[2].warnings.join()).toMatch(/zzz/);
  });
  it('a quest without base EXP is accepted with a warning (it just stays out of the calculations)', () => {
    const p = buildQuestImport(file('id,name,category\nn,N,normal\n'), [], cats, false);
    expect(p.rows[0].action).toBe('new');
    expect(p.rows[0].warnings.join()).toMatch(/EXP base/);
    expect(p.toSave[0].baseExp).toBeNull();
  });
});

describe('validateQuest', () => {
  it('flags the rules of the form', () => {
    const { errors } = validateQuest(base({ id: 'has space', name: '', prerequisites: ['has space'] }), cats, new Set());
    expect(errors.join()).toMatch(/espaços/);
    expect(errors.join()).toMatch(/nome obrigatório/);
    expect(errors.join()).toMatch(/dela mesma/);
  });
});

describe('export round trip', () => {
  it('a quest exported to CSV imports back identical', () => {
    const q = base({ objectives: [{ kind: 'monster', name: 'Goblin, grande', qty: 5 }], prerequisites: ['a', 'b'], description: 'Linha "um"\nLinha dois', baseExp: 12345, maxLevel: 20, repeatType: 'interval', repeatIntervalHours: 48 });
    const csv = questsToCsv([q], cats);
    const p = buildQuestImport(parseQuestFile(csv).records, [q], cats, true);
    expect(p.rows[0].action).toBe('same');
    const fresh = buildQuestImport(parseQuestFile(csv).records, [], cats, false);
    expect(fresh.toSave[0]).toEqual(q);
  });
});

describe('EXP table import', () => {
  const existing: ExpLevel[] = [{ level: 1, value: 100, active: true }, { level: 2, value: 200, active: true }];
  it('new, updated and unchanged levels', () => {
    const { records } = parseExpFile('level,value\n1,100\n2,250\n3,300\n');
    const p = buildExpImport(records, existing, 'per_level');
    expect(p.rows.map((r) => r.action)).toEqual(['same', 'update', 'new']);
    expect(p.toSave.map((r) => r.level)).toEqual([2, 3]);
    expect(p.tableIssues).toEqual([]);
  });
  it('rejects bad levels and values, and levels repeated in the file', () => {
    const { records } = parseExpFile('level,value\nx,10\n5,-3\n6,10\n6,20\n');
    const p = buildExpImport(records, [], 'per_level');
    expect(p.rows.map((r) => r.action)).toEqual(['error', 'error', 'new', 'error']);
  });
  it('reports the gaps the result would have', () => {
    const p = buildExpImport(parseExpFile('level,value\n5,10\n').records, existing, 'per_level');
    expect(p.tableIssues.some((i) => i.message.includes('faltam os levels'))).toBe(true);
  });
  it('thousand separators and JSON are accepted; export is the same format', () => {
    expect(buildExpImport(parseExpFile('level;value\n1;"1.000.000"\n').records, [], 'per_level').toSave[0].value).toBe(1_000_000);
    expect(parseExpFile('[{"level":1,"value":5}]').records).toHaveLength(1);
    expect(expToCsv(existing)).toBe('level,value,active\n1,100,true\n2,200,true');
  });
});
