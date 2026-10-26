import { describe, expect, it } from 'vitest';
import { CHAT_MAX_LENGTH, cleanChatText, cleanName, makeProof, makeRoomCode, normalizeRoomCode, parseChatMessage, NAME_MAX_LENGTH } from './p2p';

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

describe('chat helpers', () => {
  it('cleans text: trims, collapses spaces, drops control characters, caps the length', () => {
    expect(cleanChatText('  oi   mundo \n ')).toBe('oi mundo');
    expect(cleanChatText('a\u0000b\u0007c')).toBe('a b c');
    expect(cleanChatText('x'.repeat(1000))).toHaveLength(CHAT_MAX_LENGTH);
    expect(cleanChatText(42)).toBe('');
  });

  it('rebuilds a message field by field and rejects junk', () => {
    const ok = parseChatMessage({ id: 'abc', fromId: 'v1', name: 'Ana', text: ' oi ', ts: 5, fromHost: true, evil: '<script>' });
    expect(ok).toEqual({ id: 'abc', fromId: 'v1', name: 'Ana', text: 'oi', ts: 5, fromHost: true });
    expect(parseChatMessage(null)).toBeNull();
    expect(parseChatMessage({ id: 'a', fromId: 'b', text: '   ' })).toBeNull();
    expect(parseChatMessage({ id: 1, fromId: 'b', text: 'oi' })).toBeNull();
    expect(parseChatMessage({ id: 'a', fromId: 'b', text: 'oi', fromHost: 'yes' })?.fromHost).toBe(false);
  });
});
