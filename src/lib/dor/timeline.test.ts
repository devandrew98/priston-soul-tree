import { describe, expect, it } from 'vitest';
import type { Ctx } from './calc';
import { crisesCsv, dayEvents, eventsCsv, toCsv } from './timeline';
import { localToMs } from './time';
import type { Crisis, Intensity, MedAdmin, Rec } from './types';

const TZ = 'America/Sao_Paulo';
const at = (d: string, t: string) => new Date(localToMs(d, t, TZ)).toISOString();
let n = 0;
const rec = <T extends object>(kind: Rec['kind'], data: T): Rec<T> => ({ id: `r${++n}`, kind, data, eventAt: null, version: 1, createdAt: 'c', updatedAt: 'u', deletedAt: null }) as Rec<T>;

const c = rec<Crisis>('crisis', { start: at('2026-10-20', '22:00'), end: at('2026-10-21', '02:00'), location: ['Frontal'], character: [], symptoms: ['Náusea'], factors: [] });
const i = rec<Intensity>('intensity', { crisisId: c.id, at: at('2026-10-20', '22:05'), value: 7 });
const a = rec<MedAdmin>('med_admin', { medId: 'm', name: 'Dipirona', dose: '1', unit: 'g', category: 'crisis', quantity: 1, at: at('2026-10-20', '22:10'), crisisId: c.id, status: 'taken' });
const ctx: Ctx = { tz: TZ, now: localToMs('2026-10-28', '12:00', TZ), crises: [c], intensities: [i], admins: [a], nopain: [], sleeps: [], therapy: [], physio: [] };

describe('timeline', () => {
  it('puts the start and the end of a crisis in their own days', () => {
    expect(dayEvents(ctx, [], '2026-10-20', 'all').map((e) => e.title)).toEqual(['Início da crise', 'Dor 7/10', 'Dipirona 1 g']);
    expect(dayEvents(ctx, [], '2026-10-21', 'all').map((e) => e.title)).toEqual(['Fim da crise']);
  });
  it('filters by group', () => {
    expect(dayEvents(ctx, [], '2026-10-20', 'meds').map((e) => e.title)).toEqual(['Dipirona 1 g']);
    expect(dayEvents(ctx, [], '2026-10-20', 'headache')).toHaveLength(2);
  });
});

describe('csv', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(toCsv([['a;b', '=1+1', 'x"y', 'ok']])).toBe('﻿"a;b";"=1+1";"x""y";ok\r\n');
  });
  it('exports real records only, one line per event', () => {
    const lines = eventsCsv(ctx, []).trim().split('\r\n');
    expect(lines).toHaveLength(1 + 4); // header, start, end, intensity, medication
    expect(lines[1]).toContain('inicio_crise;20/10/2026;22:00');
    expect(crisesCsv(ctx).trim().split('\r\n')).toHaveLength(2);
  });
});
