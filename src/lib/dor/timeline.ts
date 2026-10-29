// The unified timeline of the diary and the spreadsheet export, both built only from saved records.
import { crisisStats, type Ctx } from './calc';
import { dayKey, fmtDateTime, timeKey } from './time';
import type { Crisis, Intensity, MedAdmin, NoPain, Physio, Rec, Sleep, SymptomUpdate } from './types';

export type TLGroup = 'headache' | 'meds' | 'other';
export interface TLEvent { key: string; at: number; group: TLGroup; icon: string; title: string; detail?: string; rec: Rec }
export type TLFilter = 'all' | 'headache' | 'meds';

const ms = (iso: string) => new Date(iso).getTime();
export const medLabel = (a: Pick<MedAdmin, 'name' | 'dose' | 'unit' | 'quantity'>) => `${a.quantity > 1 || !a.dose ? `${a.quantity}× ` : ''}${a.name}${a.dose ? ` ${a.dose} ${a.unit}` : ''}`.trim();

export const physioLabel = (p: Pick<Physio, 'techniques'>) => p.techniques.join(' + ') || 'sessão';
/** Pain before/after the session and the note, as the person typed them (no conclusion drawn). */
export const physioDetail = (p: Physio) => [typeof p.painBefore === 'number' ? `dor antes ${p.painBefore}/10` : '', typeof p.painAfter === 'number' ? `dor depois ${p.painAfter}/10` : '', p.note].filter(Boolean).join(' — ') || undefined;

export function allEvents(ctx: Ctx, symptoms: Rec<SymptomUpdate>[]): TLEvent[] {
  const ev: TLEvent[] = [];
  for (const c of ctx.crises) {
    ev.push({ key: `${c.id}:s`, at: ms(c.data.start), group: 'headache', icon: '🤕', title: 'Início da crise', detail: c.data.note, rec: c });
    if (c.data.end) ev.push({ key: `${c.id}:e`, at: ms(c.data.end), group: 'headache', icon: '✅', title: 'Fim da crise', detail: c.data.endNote, rec: c });
  }
  const adminById = new Map(ctx.admins.map((a) => [a.id, a]));
  for (const i of ctx.intensities) {
    const after = i.data.afterAdminId ? adminById.get(i.data.afterAdminId) : undefined;
    ev.push({
      key: i.id, at: ms(i.data.at), group: 'headache', icon: '📈', rec: i,
      title: `Dor ${i.data.value}/10${after ? ` (após ${after.data.name})` : ''}`, detail: i.data.note,
    });
  }
  for (const s of symptoms) {
    ev.push({ key: s.id, at: ms(s.data.at), group: 'headache', icon: '🩺', title: 'Sintomas atualizados', detail: [s.data.symptoms.join(', ') || 'nenhum', s.data.note].filter(Boolean).join(' — '), rec: s });
  }
  for (const a of ctx.admins) {
    const omitted = a.data.status === 'omitted';
    ev.push({ key: a.id, at: ms(a.data.at), group: 'meds', icon: omitted ? '⏭' : '💊', title: omitted ? `Dose omitida: ${a.data.name}` : medLabel(a.data), detail: a.data.note, rec: a });
  }
  for (const n of ctx.nopain) ev.push({ key: n.id, at: ms(`${n.data.date}T12:00:00Z`), group: 'other', icon: '🌤', title: 'Dia sem cefaleia confirmado', rec: n });
  for (const s of ctx.sleeps) {
    const bits = [typeof s.data.hours === 'number' ? `${String(s.data.hours).replace('.', ',')} h` : '', s.data.quality ? `qualidade ${s.data.quality}` : '', s.data.note].filter(Boolean);
    ev.push({ key: s.id, at: ms(`${s.data.date}T12:00:00Z`), group: 'other', icon: '😴', title: 'Sono', detail: bits.join(' — '), rec: s });
  }
  for (const p of ctx.physio) ev.push({ key: p.id, at: ms(p.data.at), group: 'other', icon: '🙌', title: `Fisioterapia: ${physioLabel(p.data)}`, detail: physioDetail(p.data), rec: p });
  return ev.sort((a, b) => a.at - b.at);
}

/** Events of one calendar day. Date-only records (sleep, no-pain) are placed by their own date, not by an instant. */
export function dayEvents(ctx: Ctx, symptoms: Rec<SymptomUpdate>[], day: string, filter: TLFilter): TLEvent[] {
  return allEvents(ctx, symptoms)
    .filter((e) => {
      const d = e.rec.kind === 'nopain' ? (e.rec.data as unknown as NoPain).date : e.rec.kind === 'sleep' ? (e.rec.data as unknown as Sleep).date : dayKey(e.at, ctx.tz);
      return d === day;
    })
    .filter((e) => filter === 'all' || (filter === 'headache' ? e.group === 'headache' : e.group === 'meds'));
}

// ---------- spreadsheet export ----------
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Semicolon separated (what Excel in Brazilian Portuguese opens directly), UTF-8 with BOM. Text starting with = + - @ is quoted so a spreadsheet never runs it as a formula. */
export const toCsv = (rows: unknown[][]): string => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
const num = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

export function eventsCsv(ctx: Ctx, symptoms: Rec<SymptomUpdate>[]): string {
  const rows: unknown[][] = [['tipo', 'data', 'hora', 'crise_id', 'intensidade', 'medicamento', 'dose', 'unidade', 'quantidade', 'categoria', 'situacao', 'horas_sono', 'qualidade_sono', 'sintomas', 'observacao', 'criado_em', 'alterado_em', 'id']];
  const base = (r: Rec) => [r.createdAt, r.updatedAt, r.id];
  const when = (iso: string) => [dayKey(ms(iso), ctx.tz).split('-').reverse().join('/'), timeKey(ms(iso), ctx.tz)];
  for (const c of ctx.crises) {
    rows.push(['inicio_crise', ...when(c.data.start), c.id, '', '', '', '', '', '', '', '', '', c.data.symptoms.join(', '), c.data.note ?? '', ...base(c)]);
    if (c.data.end) rows.push(['fim_crise', ...when(c.data.end), c.id, '', '', '', '', '', '', '', '', '', '', c.data.endNote ?? '', ...base(c)]);
  }
  for (const i of ctx.intensities as Rec<Intensity>[]) rows.push(['intensidade', ...when(i.data.at), i.data.crisisId ?? '', i.data.value, '', '', '', '', '', i.data.afterAdminId ? 'reavaliacao_apos_medicamento' : '', '', '', '', i.data.note ?? '', ...base(i)]);
  for (const s of symptoms) rows.push(['sintomas', ...when(s.data.at), s.data.crisisId, '', '', '', '', '', '', '', '', '', s.data.symptoms.join(', '), s.data.note ?? '', ...base(s)]);
  for (const a of ctx.admins as Rec<MedAdmin>[]) rows.push(['medicamento', ...when(a.data.at), a.data.crisisId ?? '', '', a.data.name, a.data.dose, a.data.unit, a.data.quantity, a.data.category === 'crisis' ? 'crise' : 'continuo', a.data.status === 'taken' ? 'administrado' : 'omitido', '', '', '', a.data.note ?? '', ...base(a)]);
  for (const s of ctx.sleeps as Rec<Sleep>[]) rows.push(['sono', s.data.date.split('-').reverse().join('/'), '', '', '', '', '', '', '', '', '', num(s.data.hours), s.data.quality ?? '', '', s.data.note ?? '', ...base(s)]);
  for (const n of ctx.nopain as Rec<NoPain>[]) rows.push(['dia_sem_cefaleia', n.data.date.split('-').reverse().join('/'), '', '', '', '', '', '', '', '', '', '', '', '', '', ...base(n)]);
  for (const p of ctx.physio as Rec<Physio>[]) rows.push(['fisioterapia', ...when(p.data.at), '', '', '', '', '', '', '', '', '', '', p.data.techniques.join(', '), physioDetail(p.data) ?? '', ...base(p)]);
  return toCsv(rows);
}

export function crisesCsv(ctx: Ctx): string {
  const rows: unknown[][] = [['crise_id', 'inicio', 'fim', 'duracao_min', 'intensidade_inicial', 'intensidade_final', 'intensidade_maxima', 'media_simples', 'media_por_tempo_estimada', 'avaliacoes', 'medicamentos', 'localizacao', 'caracteristica', 'sintomas', 'fatores', 'observacao']];
  for (const c of ctx.crises as Rec<Crisis>[]) {
    const s = crisisStats(c, ctx.intensities, ctx.admins, ctx.now);
    rows.push([c.id, fmtDateTime(ms(c.data.start), ctx.tz), c.data.end ? fmtDateTime(ms(c.data.end), ctx.tz) : 'em andamento', Math.round(s.durationMs / 60000), s.initial ?? '', s.last ?? '', s.max ?? '', num(s.simpleMean), num(s.timeMean), s.points.length, s.admins,
      c.data.location.join(', '), c.data.character.join(', '), c.data.symptoms.join(', '), c.data.factors.join(', '), c.data.note ?? '']);
  }
  return toCsv(rows);
}
