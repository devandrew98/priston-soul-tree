import { describe, expect, it } from 'vitest';
import { LABEL_MAX, MAX_MARKERS, NOTE_MAX, sanitizeBoard, sanitizeMarkers } from './board';

describe('sanitizeMarkers', () => {
  it('keeps valid markers', () => {
    expect(sanitizeMarkers([{ id: 'a', type: 'attack', x: 10, y: 20.5, label: 'Cristal' }])).toEqual([{ id: 'a', type: 'attack', x: 10, y: 20.5, label: 'Cristal' }]);
  });
  it('drops unknown types, bad numbers and non-objects', () => {
    expect(sanitizeMarkers([{ type: 'hack', x: 1, y: 1 }, { type: 'attack', x: 'a', y: 1 }, null, 5, { type: 'defend', x: 1, y: 2 }])).toHaveLength(1);
  });
  it('clamps positions into the map and cuts long labels', () => {
    const [m] = sanitizeMarkers([{ type: 'rebuff', x: -5, y: 250, label: 'x'.repeat(100) }]);
    expect(m.x).toBe(0);
    expect(m.y).toBe(100);
    expect(m.label).toHaveLength(LABEL_MAX);
  });
  it('limits the number of markers and tolerates garbage', () => {
    const many = Array.from({ length: MAX_MARKERS + 10 }, (_, i) => ({ id: `i${i}`, type: 'enemy', x: 1, y: 1 }));
    expect(sanitizeMarkers(many)).toHaveLength(MAX_MARKERS);
    expect(sanitizeMarkers('x')).toEqual([]);
    expect(sanitizeMarkers(undefined)).toEqual([]);
  });
});

describe('sanitizeBoard', () => {
  it('cuts a long note and defaults to empty', () => {
    expect(sanitizeBoard({ note: 'a'.repeat(NOTE_MAX + 50) }).note).toHaveLength(NOTE_MAX);
    expect(sanitizeBoard(null)).toEqual({ note: '', markers: [] });
  });
});
