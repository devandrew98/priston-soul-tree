// The Bless Castle map with the leader's signs. Read only by default; with `onChange` the signs can be placed (click) and moved (drag).
import { useRef } from 'react';
import { MARKER_ICON, MAX_MARKERS, type MapMarker, type MarkerType } from '../../lib/clan/board';

export const MAP_SRC = '/clan/bless-castle.webp';
const MAP_W = 1003, MAP_H = 1568;

interface Props {
  markers: MapMarker[];
  /** Editing: the sign being placed by a click on the map, the selected sign and the change callbacks. */
  tool?: MarkerType | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (markers: MapMarker[]) => void;
}

const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function BlessMap({ markers, tool = null, selectedId = null, onSelect, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const editable = !!onChange;

  /** Pointer position as a percentage of the map. */
  const pctOf = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) };
  };

  const place = (e: React.MouseEvent) => {
    if (!editable) return;
    if (!tool || markers.length >= MAX_MARKERS) { onSelect?.(null); return; }
    const { x, y } = pctOf(e);
    const m: MapMarker = { id: newId(), type: tool, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, label: '' };
    onChange!([...markers, m]);
    onSelect?.(m.id);
  };

  return (
    <div ref={ref} className={`cl-map${editable ? ' editable' : ''}${editable && tool ? ' placing' : ''}`} onClick={place} style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <img src={MAP_SRC} alt="" width={MAP_W} height={MAP_H} draggable={false} />
      {markers.map((m) => (
        <div
          key={m.id}
          className={`cl-mk cl-mk-${m.type}${m.id === selectedId ? ' sel' : ''}`}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={editable ? (e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = m.id; onSelect?.(m.id); } : undefined}
          onPointerMove={editable ? (e) => {
            if (drag.current !== m.id) return;
            const { x, y } = pctOf(e);
            onChange!(markers.map((o) => (o.id === m.id ? { ...o, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } : o)));
          } : undefined}
          onPointerUp={editable ? () => { drag.current = null; } : undefined}
          onPointerCancel={editable ? () => { drag.current = null; } : undefined}
        >
          <span className="cl-mk-ic">{MARKER_ICON[m.type]}</span>
          {m.label && <span className="cl-mk-label">{m.label}</span>}
        </div>
      ))}
    </div>
  );
}
