import { describe, expect, it } from 'vitest';
import {
  LABEL_MAX, MAX_MARKERS, MAX_STROKES, MAX_STROKE_POINTS, NOTE_MAX, appendPoint, sanitizeBcAt, sanitizeBoard, sanitizeMarkers, sanitizeStrokes, strokeHit,
} from './board';

describe('sanitizeMarkers', () => {
  it('keeps valid markers', () => {
    expect(sanitizeMarkers([{ id: 'a', type: 'attack', x: 10, y: 20.5, label: 'Cristal', rot: 0 }])).toEqual([{ id: 'a', type: 'attack', x: 10, y: 20.5, label: 'Cristal', rot: 0 }]);
  });
  it('accepts the arrow and the numbers 1 to 7, and drops unknown types', () => {
    const ok = ['arrow', 'n1', 'n7'].map((type) => ({ type, x: 1, y: 1 }));
    expect(sanitizeMarkers(ok)).toHaveLength(3);
    expect(sanitizeMarkers([{ type: 'n8', x: 1, y: 1 }, { type: 'hack', x: 1, y: 1 }])).toHaveLength(0);
  });
  it('drops bad numbers and non-objects', () => {
    expect(sanitizeMarkers([{ type: 'attack', x: 'a', y: 1 }, null, 5, { type: 'defend', x: 1, y: 2 }])).toHaveLength(1);
  });
  it('clamps positions into the map and cuts long labels', () => {
    const [m] = sanitizeMarkers([{ type: 'rebuff', x: -5, y: 250, label: 'x'.repeat(100) }]);
    expect(m.x).toBe(0);
    expect(m.y).toBe(100);
    expect(m.label).toHaveLength(LABEL_MAX);
  });
  it('keeps the arrow direction between 0 and 359 degrees', () => {
    expect(sanitizeMarkers([{ type: 'arrow', x: 1, y: 1, rot: 450 }])[0].rot).toBe(90);
    expect(sanitizeMarkers([{ type: 'arrow', x: 1, y: 1, rot: -90 }])[0].rot).toBe(270);
    expect(sanitizeMarkers([{ type: 'arrow', x: 1, y: 1 }])[0].rot).toBe(0);
  });
  it('limits the number of markers and tolerates garbage', () => {
    const many = Array.from({ length: MAX_MARKERS + 10 }, (_, i) => ({ id: `i${i}`, type: 'enemy', x: 1, y: 1 }));
    expect(sanitizeMarkers(many)).toHaveLength(MAX_MARKERS);
    expect(sanitizeMarkers('x')).toEqual([]);
    expect(sanitizeMarkers(undefined)).toEqual([]);
  });
});

describe('sanitizeStrokes', () => {
  it('keeps a valid line and rounds it', () => {
    const [s] = sanitizeStrokes([{ id: 's', color: '#ff4040', pts: [10.123456, 20, 30, 40] }]);
    expect(s.pts).toEqual([10.1, 20, 30, 40]);
  });
  it('drops unknown colors, too short lines and garbage', () => {
    expect(sanitizeStrokes([{ color: 'red', pts: [1, 2, 3, 4] }, { color: '#ffffff', pts: [1, 2] }, null, 7])).toEqual([]);
    expect(sanitizeStrokes('x')).toEqual([]);
  });
  it('clamps points into the map and limits points and lines', () => {
    expect(sanitizeStrokes([{ color: '#ffffff', pts: [-5, 200, 50, 50] }])[0].pts).toEqual([0, 100, 50, 50]);
    const long = Array.from({ length: MAX_STROKE_POINTS * 2 + 40 }, (_, i) => i % 100);
    expect(sanitizeStrokes([{ color: '#ffffff', pts: long }])[0].pts).toHaveLength(MAX_STROKE_POINTS * 2);
    const many = Array.from({ length: MAX_STROKES + 5 }, () => ({ color: '#ffffff', pts: [1, 1, 2, 2] }));
    expect(sanitizeStrokes(many)).toHaveLength(MAX_STROKES);
  });
});

describe('drawing helpers', () => {
  it('appendPoint skips points too close to the last one and stops at the limit', () => {
    expect(appendPoint([10, 10], 10.1, 10.1)).toEqual([10, 10]);
    expect(appendPoint([10, 10], 20, 20)).toEqual([10, 10, 20, 20]);
    expect(appendPoint([], 5, 5)).toEqual([5, 5]);
    const full = Array.from({ length: MAX_STROKE_POINTS * 2 }, () => 1);
    expect(appendPoint(full, 50, 50)).toBe(full);
  });
  it('strokeHit finds a line near the eraser, also between two far points', () => {
    const line = { id: 'a', color: '#ffffff' as const, pts: [0, 50, 100, 50] };
    expect(strokeHit(line, 50, 51, 2, 2)).toBe(true);
    expect(strokeHit(line, 50, 60, 2, 2)).toBe(false);
  });
});

describe('sanitizeBoard / sanitizeBcAt', () => {
  it('cuts a long note and defaults to empty', () => {
    expect(sanitizeBoard({ note: 'a'.repeat(NOTE_MAX + 50) }).note).toHaveLength(NOTE_MAX);
    expect(sanitizeBoard(null)).toEqual({ note: '', markers: [], strokes: [], bcAt: null });
  });
  it('accepts a real date and rejects garbage', () => {
    expect(sanitizeBcAt('2026-11-01T22:00:00Z')).toBe('2026-11-01T22:00:00.000Z');
    expect(sanitizeBcAt('not a date')).toBeNull();
    expect(sanitizeBcAt(5)).toBeNull();
    expect(sanitizeBcAt(null)).toBeNull();
  });
});
