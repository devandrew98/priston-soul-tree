import { describe, expect, it } from 'vitest';
import { insertDivider, insertLink, isSafeUrl, parseBlocks, parseInline, toggleLinePrefix, wrapSelection, type Inline } from './richText';

const text = (nodes: Inline[]): string => nodes.map((n) => (n.t === 'text' ? n.v : n.t === 'br' ? '\n' : text(n.c))).join('');

describe('inline markup', () => {
  it('reads bold, italic, underline, strike and highlight', () => {
    expect(parseInline('**a**')).toEqual([{ t: 'b', c: [{ t: 'text', v: 'a' }] }]);
    expect(parseInline('*a*')).toEqual([{ t: 'i', c: [{ t: 'text', v: 'a' }] }]);
    expect(parseInline('__a__')).toEqual([{ t: 'u', c: [{ t: 'text', v: 'a' }] }]);
    expect(parseInline('~~a~~')).toEqual([{ t: 's', c: [{ t: 'text', v: 'a' }] }]);
    expect(parseInline('==a==')).toEqual([{ t: 'mark', c: [{ t: 'text', v: 'a' }] }]);
  });

  it('keeps plain text around the markers and allows nesting', () => {
    const nodes = parseInline('um **muito __importante__** aviso');
    expect(text(nodes)).toBe('um muito importante aviso');
    expect(nodes[1]).toMatchObject({ t: 'b' });
    expect((nodes[1] as { c: Inline[] }).c[1]).toMatchObject({ t: 'u' });
  });

  it('leaves unmatched markers as plain text', () => {
    expect(text(parseInline('2 * 3 = 6 e **sem fechar'))).toBe('2 * 3 = 6 e **sem fechar');
  });

  it('only turns http(s) links into links', () => {
    expect(parseInline('[site](https://pristonzone.com)')[0]).toMatchObject({ t: 'a', href: 'https://pristonzone.com' });
    const bad = parseInline('[x](javascript:alert(1))');
    expect(bad.some((n) => n.t === 'a')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('https://a.b/c?d=1')).toBe(true);
  });

  it('never produces HTML: tags stay as literal text', () => {
    const nodes = parseInline('<img src=x onerror=alert(1)> **ok**');
    expect(text(nodes)).toBe('<img src=x onerror=alert(1)> ok');
    expect(JSON.stringify(nodes)).not.toContain('"t":"html"');
  });

  it('survives absurd nesting without blowing up', () => {
    const nasty = '**'.repeat(200) + 'x' + '**'.repeat(200);
    expect(() => parseInline(nasty)).not.toThrow();
  });
});

describe('blocks', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    const blocks = parseBlocks('linha 1\nlinha 2\n\noutro');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ t: 'p' });
    expect((blocks[0] as { c: Inline[] }).c.some((n) => n.t === 'br')).toBe(true);
  });

  it('reads titles, subtitles and dividers', () => {
    expect(parseBlocks('# T\n## S\n---').map((b) => b.t)).toEqual(['h1', 'h2', 'hr']);
  });

  it('groups consecutive bullets and numbers into one list each', () => {
    const blocks = parseBlocks('- a\n- b\n- c\n\n1. x\n2. y');
    expect(blocks.map((b) => b.t)).toEqual(['ul', 'ol']);
    expect((blocks[0] as { items: Inline[][] }).items).toHaveLength(3);
    expect((blocks[1] as { items: Inline[][] }).items).toHaveLength(2);
  });

  it('turns the "- item" lines of the existing plain-text news into a real list', () => {
    const old = '🎨 Novo visual e melhorias\n- Interface renovada\n- Melhor adaptação para celulares\n\n⚔ Builds';
    const blocks = parseBlocks(old);
    expect(blocks.map((b) => b.t)).toEqual(['p', 'ul', 'p']);
  });

  it('handles empty input and Windows line endings', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('a\r\nb').length).toBe(1);
  });
});

describe('editing helpers', () => {
  it('wraps the selection, and unwraps when it is already wrapped', () => {
    const wrapped = wrapSelection('olá mundo', 4, 9, '**', '**', 'texto');
    expect(wrapped.text).toBe('olá **mundo**');
    expect(wrapped.text.slice(wrapped.start, wrapped.end)).toBe('mundo');
    const back = wrapSelection(wrapped.text, wrapped.start, wrapped.end, '**', '**', 'texto');
    expect(back.text).toBe('olá mundo');
  });

  it('inserts a placeholder when nothing is selected', () => {
    const e = wrapSelection('abc', 3, 3, '*', '*', 'itálico');
    expect(e.text).toBe('abc*itálico*');
    expect(e.text.slice(e.start, e.end)).toBe('itálico');
  });

  it('adds and removes line prefixes for every selected line', () => {
    const on = toggleLinePrefix('um\ndois\ntrês', 0, 8, '- ', /^[-•]\s+/);
    expect(on.text).toBe('- um\n- dois\ntrês');
    const off = toggleLinePrefix(on.text, on.start, on.end, '- ', /^[-•]\s+/);
    expect(off.text).toBe('um\ndois\ntrês');
  });

  it('numbers lists 1., 2., 3.', () => {
    const e = toggleLinePrefix('a\nb\nc', 0, 5, (i) => `${i + 1}. `, /^\d+[.)]\s+/);
    expect(e.text).toBe('1. a\n2. b\n3. c');
  });

  it('turns a selection into a link and inserts dividers on their own line', () => {
    expect(insertLink('veja aqui', 5, 9, 'https://x.com').text).toBe('veja [aqui](https://x.com)');
    expect(insertDivider('texto', 5).text).toBe('texto\n\n---\n\n');
    expect(insertDivider('', 0).text).toBe('---\n\n');
  });
});
