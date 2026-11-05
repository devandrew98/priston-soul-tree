import { describe, expect, it } from 'vitest';
import { groupBySection, localized, moveId, nextPosition, pickLang, type SeasonItem } from './season';

describe('season order', () => {
  it('moves a topic up or down and stops at the ends', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b']);
  });
  it('a new topic goes to the end', () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition([{ position: 1 }, { position: 4 }, { position: 2 }])).toBe(5);
  });
});

describe('season sections', () => {
  it('groups consecutive topics under the same heading, and keeps topics without one together', () => {
    const g = groupBySection([{ section: 'A', n: 1 }, { section: 'A', n: 2 }, { section: 'B', n: 3 }, { section: '', n: 4 }, { section: '', n: 5 }, { section: 'A', n: 6 }]);
    expect(g.map((x) => [x.section, x.items.map((i) => i.n)])).toEqual([['A', [1, 2]], ['B', [3]], ['', [4, 5]], ['A', [6]]]);
  });
});

describe('season languages', () => {
  const item: SeasonItem = { id: '1', position: 1, section: 'Geral', question: 'Pergunta?', answer: 'Resposta.', visible: true, sectionEn: 'General', questionEn: 'Question?', answerEn: '' };
  it('shows English when it was written, and falls back to Portuguese when the English field is empty', () => {
    expect(pickLang('pt', 'en', 'en')).toBe('en');
    expect(pickLang('pt', '  ', 'en')).toBe('pt');
    expect(pickLang('pt', 'en', 'pt')).toBe('pt');
    expect(localized(item, 'en')).toEqual({ id: '1', section: 'General', question: 'Question?', answer: 'Resposta.' });
    expect(localized(item, 'pt')).toEqual({ id: '1', section: 'Geral', question: 'Pergunta?', answer: 'Resposta.' });
  });
});
