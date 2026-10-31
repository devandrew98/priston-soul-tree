import { describe, expect, it } from 'vitest';
import { isShown, pickText, type HomeText } from './homeTexts';

const row = (over: Partial<HomeText> = {}): HomeText => ({
  key: 'pix', titlePt: '', titleEn: '', bodyPt: '', bodyEn: '', showPt: true, showEn: true, ...over,
});

describe('pickText', () => {
  it('uses the default when nothing was saved or the field is empty', () => {
    expect(pickText(undefined, 'title', 'pt', 'Padrão')).toBe('Padrão');
    expect(pickText(row({ titlePt: '   ' }), 'title', 'pt', 'Padrão')).toBe('Padrão');
  });
  it('uses the saved text of the language being read', () => {
    const r = row({ titlePt: 'Apoie', titleEn: 'Support', bodyPt: 'Texto', bodyEn: 'Text' });
    expect(pickText(r, 'title', 'pt', 'x')).toBe('Apoie');
    expect(pickText(r, 'title', 'en', 'x')).toBe('Support');
    expect(pickText(r, 'body', 'en', 'x')).toBe('Text');
  });
});

describe('isShown', () => {
  it('shows everything when nothing was saved', () => {
    expect(isShown(undefined, 'pt')).toBe(true);
    expect(isShown(undefined, 'en')).toBe(true);
  });
  it('follows the language choice', () => {
    expect(isShown(row({ showEn: false }), 'en')).toBe(false);
    expect(isShown(row({ showEn: false }), 'pt')).toBe(true);
    expect(isShown(row({ showPt: false }), 'pt')).toBe(false);
  });
});
