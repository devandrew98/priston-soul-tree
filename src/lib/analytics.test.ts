import { describe, expect, it } from 'vitest';
import { deviceOf, normalizePath, refHost } from './analytics';

describe('normalizePath', () => {
  it('keeps normal pages and drops trailing slashes and case', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/Quests/')).toBe('/quests');
    expect(normalizePath('/tutorial/quests')).toBe('/tutorial/quests');
  });
  it('never measures the private diary', () => {
    expect(normalizePath('/dor')).toBeNull();
    expect(normalizePath('/DOR/')).toBeNull();
  });
  it('folds shared-link tokens so they are not stored', () => {
    expect(normalizePath('/char/meu-nick')).toBe('/char/*');
    expect(normalizePath('/formacao/abc123')).toBe('/formacao/*');
    expect(normalizePath('/sala/XYZ')).toBe('/sala/*');
  });
  it('maps the old leveling address', () => {
    expect(normalizePath('/pessoalhadder')).toBe('/leveling');
  });
});

describe('refHost', () => {
  it('is empty for direct visits and for our own pages', () => {
    expect(refHost('', 'pristonzone.com')).toBe('');
    expect(refHost('https://www.pristonzone.com/quests', 'pristonzone.com')).toBe('');
  });
  it('returns only the site name of other referrers', () => {
    expect(refHost('https://www.google.com/search?q=x', 'pristonzone.com')).toBe('google.com');
    expect(refHost('https://discord.com/channels/1/2', 'pristonzone.com')).toBe('discord.com');
  });
  it('ignores junk', () => {
    expect(refHost('not a url', 'pristonzone.com')).toBe('');
  });
});

describe('deviceOf', () => {
  it('splits phone-sized from desktop', () => {
    expect(deviceOf(390)).toBe('mobile');
    expect(deviceOf(1280)).toBe('desktop');
  });
});
