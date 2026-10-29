import { describe, expect, it } from 'vitest';
import { defaultPage, inlinePieces, isCheckable, pageBlocks, progressOf, sanitizePage, stepNumbers, type Block } from './page';

const blk = (id: string, kind: Block['kind'], level: 0 | 1 = 0): Block => ({ id, kind, text: id, level });

describe('sanitizePage', () => {
  it('never throws and returns an empty valid page for garbage', () => {
    for (const bad of [null, undefined, 5, 'x', [], { sections: 'no' }]) expect(sanitizePage(bad)).toEqual({ title: '', intro: '', sections: [] });
  });
  it('fixes unknown kinds, levels and duplicate ids', () => {
    const p = sanitizePage({ title: 'T', sections: [{ id: 's', title: 'S', blocks: [{ id: 'a', kind: 'weird', text: 'x', level: 7 }, { id: 'a', kind: 'check', text: 'y' }] }] });
    const [first, second] = p.sections[0].blocks;
    expect(first).toMatchObject({ kind: 'text', level: 0 });
    expect(second.id).not.toBe(first.id);
  });
  it('cuts texts at the limits', () => {
    expect(sanitizePage({ title: 'x'.repeat(500) }).title).toHaveLength(120);
  });
  it('allows 3000 characters per block and keeps line breaks', () => {
    const text = ['linha 1', 'linha 2', 'x'.repeat(3500)].join('\n');
    const p = sanitizePage({ sections: [{ id: 's', title: 'S', blocks: [{ id: 'a', kind: 'text', text }] }] });
    expect(p.sections[0].blocks[0].text).toHaveLength(3000);
    expect(p.sections[0].blocks[0].text.split('\n').slice(0, 2)).toEqual(['linha 1', 'linha 2']);
  });
  it('has the same ids every time, so ticks survive a reload', () => {
    expect(defaultPage()).toEqual(defaultPage());
  });
  it('keeps the default page unchanged by a round trip', () => {
    const d = defaultPage();
    expect(sanitizePage(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});

describe('progress', () => {
  it('counts only items that can be ticked', () => {
    const blocks = [blk('a', 'check'), blk('b', 'step'), blk('c', 'text'), blk('d', 'tip')];
    expect(blocks.filter(isCheckable)).toHaveLength(2);
    expect(progressOf(blocks, { a: true, c: true, gone: true })).toEqual({ done: 1, total: 2 });
  });
  it('the default guide has items to tick', () => {
    expect(progressOf(pageBlocks(defaultPage()), {}).total).toBeGreaterThan(10);
  });
});

describe('stepNumbers', () => {
  it('numbers consecutive steps and restarts after other blocks', () => {
    const blocks = [blk('1', 'step'), blk('2', 'step'), blk('sub', 'check', 1), blk('3', 'step'), blk('t', 'text'), blk('4', 'step')];
    expect(stepNumbers(blocks)).toEqual([1, 2, null, 3, null, 1]);
  });
});

describe('inlinePieces', () => {
  it('reads **bold** and *bold*', () => {
    expect(inlinePieces('a **b** c *d*')).toEqual([
      { text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c ', bold: false }, { text: 'd', bold: true },
    ]);
  });
  it('leaves plain text and a lone asterisk alone', () => {
    expect(inlinePieces('1 * 2')).toEqual([{ text: '1 * 2', bold: false }]);
  });
});
