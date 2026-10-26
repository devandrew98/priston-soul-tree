import { describe, expect, it } from 'vitest';
import { buildMeta, buildStats, escapeHtml, injectMeta } from '../../api/share';
import { encodeBuild } from './skilltree/buildCode';
import { getSkillClass } from './skilltree/classes';
import { sanitizeBuild } from './skilltree/rules';
import { TOOL_PATHS } from './routes';

const html = '<!doctype html>\n<html><head>\n<title>PristonZONE</title>\n</head><body><div id="root"></div></body></html>';

describe('page meta', () => {
  it('has a specific title for each routed page', () => {
    for (const path of Object.values(TOOL_PATHS)) {
      const meta = buildMeta(path);
      expect(meta.title).not.toBe(buildMeta('/').title);
      expect(meta.path).toBe(path);
    }
    expect(buildMeta('/').title).toContain('PristonZONE');
  });

  it('falls back to the home page for unknown paths', () => {
    expect(buildMeta('/nao-existe').path).toBe('/');
  });

  it('describes a shared skill build with the class, level and points', () => {
    const skills = getSkillClass('fighter').tiers.flatMap((t) => t.skills);
    const levels = sanitizeBuild('fighter', 120, [], Object.fromEntries(skills.map((s) => [s.id, 1])));
    const encoded = encodeBuild('fighter', [], levels);
    expect(buildStats(encoded)).toEqual({ sp: 12, ep: 4 });
    const meta = buildMeta('/skill-tree/fighter', { level: '120', build: encoded, name: 'PvP' });
    expect(meta.title).toBe('PvP — Build de Fighter nível 120 — PristonZONE');
    expect(meta.description).toContain('12 Skill Points e 4 Elite Points');
    expect(meta.image).toBe('/wardrobe/classes/fighter.png');
  });

  it('does not trust the query: bad level, bad class, bad build', () => {
    expect(buildMeta('/skill-tree/fighter', { level: '9999' }).title).toContain('nível 120');
    expect(buildMeta('/skill-tree/zzz').path).toBe('/');
    expect(buildStats('!!!not base64!!!')).toBeNull();
    expect(buildStats('')).toBeNull();
  });

  it('keeps screen rooms generic (no code, nothing about who is in it)', () => {
    const meta = buildMeta('/sala/ABCD2345');
    expect(meta.title + meta.description).not.toContain('ABCD2345');
  });
});

describe('injectMeta', () => {
  it('replaces the title and adds the Open Graph tags', () => {
    const out = injectMeta(html, buildMeta('/skills'), 'https://pristonzone.com');
    expect(out).toContain('<title>Construtor de Skills — PristonZONE</title>');
    expect(out).toContain('property="og:title" content="Construtor de Skills — PristonZONE"');
    expect(out).toContain('property="og:image" content="https://pristonzone.com/pristonzone-logo.png"');
    expect(out).toContain('href="https://pristonzone.com/skills"');
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain('<div id="root">'); // the app itself is untouched
  });

  it('escapes anything that came from the URL so it cannot break out of the tags', () => {
    const meta = buildMeta('/skill-tree/fighter', { level: '10', name: '"><script>alert(1)</script>' });
    const out = injectMeta(html, meta, 'https://pristonzone.com');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
    expect(escapeHtml(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&#39;');
  });
});
