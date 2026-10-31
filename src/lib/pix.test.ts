import { describe, expect, it } from 'vitest';
import { crc16, pixPayload } from './pix';

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('pixPayload', () => {
  const key = 'aed0ca9e-6f45-4f9c-9370-460bc85b438e';
  const p = pixPayload({ key, name: 'PristonZONE', city: 'Brasil' });
  it('carries the key inside the Pix account block', () => {
    expect(p).toContain('0014br.gov.bcb.pix0136' + key);
    expect(p.startsWith('000201010211')).toBe(true);
  });
  it('ends with a valid checksum over everything before it', () => {
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it('writes name and city without accents, in capitals', () => {
    expect(pixPayload({ key, name: 'São José', city: 'São Paulo' })).toContain('5908SAO JOSE6009SAO PAULO');
  });
});
