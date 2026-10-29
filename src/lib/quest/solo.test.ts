import { describe, expect, it } from 'vitest';
import { currentSoloId, isSolo } from './solo';

const solo = (area: string, minLevel: number) => ({ id: area.toLowerCase().replace(/ /g, '-'), name: `Solo Quest | ${area}`, minLevel });
const SOLOS = [
  solo('Ruinen Village', 20), solo('Forge of the Ancients', 115), solo('Crystal Nest', 118), solo('Land Of Neuren', 120), solo('Whispering Vale', 150),
];

describe('current solo quest', () => {
  it('only names starting with "Solo Quest |" are solo quests', () => {
    expect(isSolo({ name: 'Solo Quest | Oasis' })).toBe(true);
    expect(isSolo({ name: '[SOLO] Kill 2 Superior Flamo in Heart of Fire' })).toBe(false);
  });
  it('150 and above: Whispering Vale', () => {
    expect(currentSoloId(SOLOS, 150)).toBe('whispering-vale');
    expect(currentSoloId(SOLOS, 210)).toBe('whispering-vale');
  });
  it('120 to 149: Land of Neuren', () => {
    expect(currentSoloId(SOLOS, 120)).toBe('land-of-neuren');
    expect(currentSoloId(SOLOS, 149)).toBe('land-of-neuren');
  });
  it('118 and 119: Crystal Nest, and below that the highest one reached', () => {
    expect(currentSoloId(SOLOS, 118)).toBe('crystal-nest');
    expect(currentSoloId(SOLOS, 119)).toBe('crystal-nest');
    expect(currentSoloId(SOLOS, 117)).toBe('forge-of-the-ancients');
    expect(currentSoloId(SOLOS, 30)).toBe('ruinen-village');
  });
  it('none before the first solo', () => {
    expect(currentSoloId(SOLOS, 10)).toBeNull();
  });
});
