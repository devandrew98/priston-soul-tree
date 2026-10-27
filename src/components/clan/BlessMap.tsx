// The Bless Castle map with the leader's signs and pencil drawings. Read only by default.
// With `onChange` the signs can be placed (click) and moved (drag); with `onStrokes` and the pencil/eraser tool the map can be drawn on.
import { useRef, useState } from 'react';
import {
  MARKER_ICON, MAX_MARKERS, MAX_STROKES, MARKER_TYPES, appendPoint, isNumberType, strokeHit,
  type MapMarker, type MarkerType, type Stroke, type StrokeColor,
} from '../../lib/clan/board';

export const MAP_SRC = '/clan/bless-castle.webp';
const MAP_W = 1003, MAP_H = 1568;
const ERASER_PX = 14;

export type MapTool = MarkerType | 'pencil' | 'eraser' | null;

interface Props {
  markers: MapMarker[];
  strokes?: Stroke[];
  /** Editing: the active tool (a sign to place, the pencil or the eraser), the pencil color and the selected sign. */
  tool?: MapTool;
  color?: StrokeColor;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (markers: MapMarker[]) => void;
  onStrokes?: (strokes: Stroke[]) => void;
}

const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isMarkerTool = (t: MapTool): t is MarkerType => !!t && (MARKER_TYPES as readonly string[]).includes(t);
const polyline = (pts: number[]) => pts.reduce((s, v, i) => s + (i % 2 === 0 ? `${i ? ' ' : ''}${v}` : `,${v}`), '');

function ArrowIcon({ rot }: { rot: number }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M12 2 L21 21 L12 16 L3 21 Z" fill="currentColor" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function BlessMap({ markers, strokes = [], tool = null, color = '#ff4040', selectedId = null, onSelect, onChange, onStrokes }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const liveRef = useRef<number[] | null>(null);
  const [live, setLive] = useState<number[] | null>(null);
  const editable = !!onChange;
  const drawTool = onStrokes && (tool === 'pencil' || tool === 'eraser') ? tool : null;

  /** Pointer position as a percentage of the map. */
  const pctOf = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) };
  };

  const place = (e: React.MouseEvent) => {
    if (!editable) return;
    if (!isMarkerTool(tool) || markers.length >= MAX_MARKERS) { onSelect?.(null); return; }
    const { x, y } = pctOf(e);
    const m: MapMarker = { id: newId('m'), type: tool, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, label: '', rot: 0 };
    onChange!([...markers, m]);
    onSelect?.(m.id);
  };

  const erase = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect();
    const rx = (ERASER_PX / r.width) * 100, ry = (ERASER_PX / r.height) * 100;
    const next = strokesRef.current.filter((s) => !strokeHit(s, x, y, rx, ry));
    if (next.length !== strokesRef.current.length) { strokesRef.current = next; onStrokes!(next); }
  };

  const down = (e: React.PointerEvent) => {
    if (!drawTool) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pctOf(e);
    if (drawTool === 'pencil') { liveRef.current = appendPoint([], x, y); setLive(liveRef.current); } else { liveRef.current = []; erase(x, y); }
  };
  const move = (e: React.PointerEvent) => {
    if (!drawTool || !liveRef.current) return;
    const { x, y } = pctOf(e);
    if (drawTool === 'pencil') { liveRef.current = appendPoint(liveRef.current, x, y); setLive(liveRef.current); } else erase(x, y);
  };
  const up = () => {
    const pts = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (drawTool !== 'pencil' || !pts || pts.length < 2 || strokesRef.current.length >= MAX_STROKES) return;
    // a single tap draws a dot
    onStrokes!([...strokesRef.current, { id: newId('s'), color, pts: pts.length < 4 ? [pts[0], pts[1], pts[0], pts[1]] : pts }]);
  };

  return (
    <div
      ref={ref}
      className={`cl-map${editable ? ' editable' : ''}${isMarkerTool(tool) && editable ? ' placing' : ''}${drawTool ? ` drawing ${drawTool}` : ''}`}
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}
      onClick={place}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <img src={MAP_SRC} alt="" width={MAP_W} height={MAP_H} draggable={false} />
      <svg className="cl-strokes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {strokes.map((s) => <polyline key={s.id} points={polyline(s.pts)} stroke={s.color} />)}
        {live && live.length >= 2 && <polyline points={polyline(live.length < 4 ? [live[0], live[1], live[0], live[1]] : live)} stroke={color} />}
      </svg>
      {markers.map((m) => (
        <div
          key={m.id}
          className={`cl-mk cl-mk-${m.type}${isNumberType(m.type) ? ' cl-mk-num' : ''}${m.id === selectedId ? ' sel' : ''}`}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={editable && !drawTool ? (e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = m.id; onSelect?.(m.id); } : undefined}
          onPointerMove={editable && !drawTool ? (e) => {
            if (drag.current !== m.id) return;
            const { x, y } = pctOf(e);
            onChange!(markers.map((o) => (o.id === m.id ? { ...o, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } : o)));
          } : undefined}
          onPointerUp={editable ? () => { drag.current = null; } : undefined}
          onPointerCancel={editable ? () => { drag.current = null; } : undefined}
        >
          <span className="cl-mk-ic">{m.type === 'arrow' ? <ArrowIcon rot={m.rot} /> : MARKER_ICON[m.type]}</span>
          {m.label && <span className="cl-mk-label">{m.label}</span>}
        </div>
      ))}
    </div>
  );
}
