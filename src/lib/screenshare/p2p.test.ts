import { describe, expect, it } from 'vitest';
import { cleanName, makeProof, makeRoomCode, normalizeRoomCode, NAME_MAX_LENGTH } from './p2p';

describe('room password proof', () => {
  it('is deterministic for the same inputs', async () => {
    expect(await makeProof('segredo', 'salt1', 'viewerA')).toBe(await makeProof('segredo', 'salt1', 'viewerA'));
  });

  it('changes with the password, the salt and the viewer id (no replay)', async () => {
    const base = await makeProof('segredo', 'salt1', 'viewerA');
    expect(await makeProof('outra', 'salt1', 'viewerA')).not.toBe(base);
    expect(await makeProof('segredo', 'salt2', 'viewerA')).not.toBe(base);
    expect(await makeProof('segredo', 'salt1', 'viewerB')).not.toBe(base);
  });

  it('never contains the password', async () => {
    expect(await makeProof('segredo', 'salt1', 'viewerA')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('room codes', () => {
  it('generates codes that normalize back to themselves', () => {
    for (let i = 0; i < 50; i++) {
      const code = makeRoomCode();
      expect(code).toHaveLength(8);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });

  it('accepts lowercase and separators when pasted', () => {
    expect(normalizeRoomCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizeRoomCode(' abcd 2345 ')).toBe('ABCD2345');
  });

  it('rejects wrong lengths and ambiguous characters', () => {
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(normalizeRoomCode('ABCD23456')).toBeNull();
    expect(normalizeRoomCode('ABCD234O')).toBeNull(); // letter O is not in the alphabet
    expect(normalizeRoomCode('')).toBeNull();
  });
});

describe('cleanName', () => {
  it('trims, collapses spaces and caps the length', () => {
    expect(cleanName('  Had   der ')).toBe('Had der');
    expect(cleanName('x'.repeat(100))).toHaveLength(NAME_MAX_LENGTH);
  });
});
