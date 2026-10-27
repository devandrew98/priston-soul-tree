// The leader's board: date of the Bless Castle, a note for the players and the Bless Castle map (signs, numbers, arrows, pencil).
// Saved by itself a moment after each change; the public link (ClanSharePage) re-reads it every few seconds.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  LABEL_MAX, MARKER_ICON, NOTE_MAX, NUMBER_TYPES, STROKE_COLORS, isNumberType,
  type BoardData, type MapMarker, type MarkerType, type StrokeColor,
} from '../../lib/clan/board';
import { bcSaturdays, formatBc } from '../../lib/clan/dates';
import { getClanRepo, type Clan, type ClanMember } from '../../lib/clan/repo';
import { AttendancePanel } from './AttendancePanel';
import { BlessMap, type MapTool } from './BlessMap';
import { markerName } from './markerNames';

const TXT = {
  dateTitle: { pt: 'Próximo Bless Castle', en: 'Next Bless Castle' },
  dateHint: { pt: 'O Bless Castle é sempre aos sábados, ao meio-dia (horário de Brasília). A data é atualizada sozinha e aparece no link dos jogadores, com a contagem regressiva.', en: 'The Bless Castle is always on Saturday at noon (Brasília time). The date updates by itself and shows on the players link, with a countdown.' },
  noteTitle: { pt: 'Orientações para os jogadores', en: 'Instructions for the players' },
  noteHint: { pt: 'Aparece no topo do link dos jogadores. Ex.: Bless Castle de hoje: FULL PvP.', en: 'Shown at the top of the players link. E.g.: Bless Castle today: FULL PvP.' },
  notePlaceholder: { pt: 'Escreva aqui as orientações do dia…', en: 'Write today\'s instructions here…' },
  mapTitle: { pt: 'Mapa do Bless Castle', en: 'Bless Castle map' },
  mapHint: { pt: 'Escolha um sinal e clique no mapa para colocar. Arraste para mover. Os jogadores veem tudo no link.', en: 'Pick a sign and click on the map to place it. Drag to move. Players see everything on the link.' },
  signs: { pt: 'Sinais', en: 'Signs' },
  numbers: { pt: 'Números (ordem)', en: 'Numbers (order)' },
  draw: { pt: 'Desenho', en: 'Drawing' },
  pencil: { pt: 'Lápis', en: 'Pencil' },
  eraser: { pt: 'Borracha', en: 'Eraser' },
  undo: { pt: 'Desfazer', en: 'Undo' },
  clearDraw: { pt: 'Apagar rabiscos', en: 'Erase drawings' },
  drawHint: { pt: 'Com o lápis, arraste sobre o mapa. A borracha apaga a linha que tocar.', en: 'With the pencil, drag over the map. The eraser removes the line it touches.' },
  selected: { pt: 'Sinal selecionado', en: 'Selected sign' },
  label: { pt: 'Texto curto (opcional)', en: 'Short text (optional)' },
  direction: { pt: 'Direção da seta', en: 'Arrow direction' },
  remove: { pt: 'Remover sinal', en: 'Remove sign' },
  clear: { pt: 'Limpar sinais', en: 'Clear signs' },
  clearAsk: { pt: 'Remover todos os sinais?', en: 'Remove all signs?' },
  clearDrawAsk: { pt: 'Apagar todos os rabiscos?', en: 'Erase all drawings?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
  saving: { pt: 'Salvando…', en: 'Saving…' },
  saved: { pt: 'Salvo', en: 'Saved' },
  error: { pt: 'Não foi possível salvar. Tente de novo.', en: 'Could not save. Try again.' },
  loadError: { pt: 'Não foi possível carregar as orientações.', en: 'Could not load the instructions.' },
  count: { pt: 'sinais', en: 'signs' },
} as const;

const SIGNS: MarkerType[] = ['attack', 'defend', 'rebuff', 'enemy', 'arrow'];
const COLOR_NAMES: Record<StrokeColor, string> = { '#ff4040': 'vermelho', '#ffd24a': 'amarelo', '#ffffff': 'branco', '#4aa8ff': 'azul', '#6fcf7f': 'verde' };

export function BoardEditor({ clan, members, onClearConfirmed }: { clan: Clan; members: ClanMember[]; onClearConfirmed: () => void }) {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];

  const [board, setBoard] = useState<BoardData | null>(null);
  const [tool, setTool] = useState<MapTool>('attack');
  const [color, setColor] = useState<StrokeColor>('#ff4040');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'loadError'>('idle');
  const [confirm, setConfirm] = useState<'markers' | 'strokes' | null>(null);
  const dirty = useRef(false);
  const latest = useRef<BoardData | null>(null);
  latest.current = board;

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    getClanRepo().getBoard(clan.id)
      .then((b) => { if (!cancelled) setBoard(b); })
      .catch(() => { if (!cancelled) setStatus('loadError'); });
    return () => { cancelled = true; };
  }, [clan.id]);

  // Saves shortly after the last change; leaving the page/clan with something pending saves it right away.
  useEffect(() => {
    if (!board || !dirty.current) return;
    setStatus('saving');
    const id = window.setTimeout(() => {
      dirty.current = false;
      getClanRepo().saveBoard(clan.id, board).then(() => setStatus('saved')).catch(() => { dirty.current = true; setStatus('error'); });
    }, 700);
    return () => window.clearTimeout(id);
  }, [board, clan.id]);
  useEffect(() => () => {
    if (dirty.current && latest.current) void getClanRepo().saveBoard(clan.id, latest.current).catch(() => {});
  }, [clan.id]);

  const edit = (patch: Partial<BoardData>) => { dirty.current = true; setBoard((b) => (b ? { ...b, ...patch } : b)); };
  const setMarkers = (markers: MapMarker[]) => edit({ markers });
  const selected = board?.markers.find((m) => m.id === selectedId) ?? null;

  if (status === 'loadError') return <p className="ag-warning" role="alert">{T('loadError')}</p>;
  if (!board) return null;

  const patchSelected = (patch: Partial<MapMarker>) => setMarkers(board.markers.map((m) => (m.id === selectedId ? { ...m, ...patch } : m)));
  const pick = (t: MapTool) => setTool(tool === t ? null : t);
  const signBtn = (t: MarkerType) => (
    <button key={t} type="button" className={`cl-tool-btn ${tool === t ? 'on' : ''}`} aria-pressed={tool === t} onClick={() => pick(t)}>
      <span>{MARKER_ICON[t]}</span> {markerName(t, lang)}
    </button>
  );
  const ask = (text: string, run: () => void) => (
    <div className="cl-confirm">
      <span>{text}</span>
      <button type="button" className="mk-btn cl-danger" onClick={() => { run(); setConfirm(null); }}>{T('yes')}</button>
      <button type="button" className="mk-btn" onClick={() => setConfirm(null)}>{T('no')}</button>
    </div>
  );

  return (
    <>
      <section className="sr-card cl-box">
        <div className="cl-boardhead">
          <h3>{T('dateTitle')}</h3>
          <small className={`cl-save ${status}`}>{status === 'saving' ? T('saving') : status === 'saved' ? `✔ ${T('saved')}` : status === 'error' ? T('error') : ''}</small>
        </div>
        <p className="mk-muted">{T('dateHint')}</p>
        <p className="cl-bcnext">📅 {formatBc(bcSaturdays(Date.now()).next, lang)}</p>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('noteTitle')}</h3>
        <p className="mk-muted">{T('noteHint')}</p>
        <textarea className="cl-note" value={board.note} maxLength={NOTE_MAX} rows={3} placeholder={T('notePlaceholder')} onChange={(e) => edit({ note: e.target.value })} />
        <small className="mk-muted">{board.note.length}/{NOTE_MAX}</small>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('mapTitle')} <small>· {board.markers.length} {T('count')}</small></h3>
        <p className="mk-muted">{T('mapHint')}</p>
        <div className="cl-mapwrap">
          <div className="cl-mapcol">
            <BlessMap markers={board.markers} strokes={board.strokes} tool={tool} color={color} selectedId={selectedId} onSelect={setSelectedId} onChange={setMarkers} onStrokes={(strokes) => edit({ strokes })} />
          </div>
          <aside className="cl-maptools">
            <h4>{T('signs')}</h4>
            <div className="cl-palette">{SIGNS.map(signBtn)}</div>

            <h4>{T('numbers')}</h4>
            <div className="cl-palette cl-numbers">
              {NUMBER_TYPES.map((t) => (
                <button key={t} type="button" className={`cl-tool-btn num ${tool === t ? 'on' : ''}`} aria-pressed={tool === t} aria-label={markerName(t, lang)} onClick={() => pick(t)}>{t.slice(1)}</button>
              ))}
            </div>

            <h4>{T('draw')}</h4>
            <div className="cl-palette">
              <button type="button" className={`cl-tool-btn ${tool === 'pencil' ? 'on' : ''}`} aria-pressed={tool === 'pencil'} onClick={() => pick('pencil')}><span>✏️</span> {T('pencil')}</button>
              <button type="button" className={`cl-tool-btn ${tool === 'eraser' ? 'on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => pick('eraser')}><span>🧽</span> {T('eraser')}</button>
            </div>
            <div className="cl-colors" role="group" aria-label={T('pencil')}>
              {STROKE_COLORS.map((c) => (
                <button key={c} type="button" className={`cl-swatch ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={COLOR_NAMES[c]} aria-pressed={color === c} onClick={() => { setColor(c); setTool('pencil'); }} />
              ))}
            </div>
            <small className="mk-muted">{T('drawHint')}</small>
            {board.strokes.length > 0 && (
              confirm === 'strokes' ? ask(T('clearDrawAsk'), () => edit({ strokes: [] })) : (
                <div className="cl-palette">
                  <button type="button" className="mk-btn" onClick={() => edit({ strokes: board.strokes.slice(0, -1) })}>↶ {T('undo')}</button>
                  <button type="button" className="mk-btn" onClick={() => setConfirm('strokes')}>{T('clearDraw')}</button>
                </div>
              )
            )}

            {selected && (
              <div className="cl-selected">
                <h4>{T('selected')}: {isNumberType(selected.type) ? '' : `${MARKER_ICON[selected.type]} `}{markerName(selected.type, lang)}</h4>
                <input value={selected.label} maxLength={LABEL_MAX} placeholder={T('label')} aria-label={T('label')} onChange={(e) => patchSelected({ label: e.target.value })} />
                {selected.type === 'arrow' && (
                  <label className="cl-rot">
                    <span>{T('direction')}: {selected.rot}°</span>
                    <input type="range" min={0} max={359} step={5} value={selected.rot} onChange={(e) => patchSelected({ rot: Number(e.target.value) })} />
                  </label>
                )}
                <button type="button" className="mk-btn cl-danger" onClick={() => { setMarkers(board.markers.filter((m) => m.id !== selected.id)); setSelectedId(null); }}>{T('remove')}</button>
              </div>
            )}
            {board.markers.length > 0 && (confirm === 'markers'
              ? ask(T('clearAsk'), () => { setMarkers([]); setSelectedId(null); })
              : <button type="button" className="mk-btn" onClick={() => setConfirm('markers')}>{T('clear')}</button>)}
          </aside>
        </div>
      </section>

      <AttendancePanel clan={clan} members={members} onUncheckAll={onClearConfirmed} />
    </>
  );
}
