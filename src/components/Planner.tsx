import { useState } from 'react';
import {
  TREE_NODES,
  TREE_EDGES,
  TREE_NODE_BY_ID,
  TREE_COLS,
  TREE_ROWS,
  nodeFrameSrc,
  NODE_TYPE_ICON,
  TYPE_COUNTS,
  RARITY_COUNTS,
  type NodeType,
} from '../lib/tree';
import { SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { slotStatValues } from '../lib/calc';
import { fmt } from '../lib/formula';
import { useStore } from '../store';
import { SoulIcon } from './SoulIcon';
import { NodeEditor } from './NodeEditor';

const CELL = 92; // grid cell size in px
const NODE = 64; // node frame size in px
const PIPE = 12; // pipe thickness in px

const RARITY_GLOW: Record<string, string> = {
  common: '#8a8a8a',
  rare: '#4a90d9',
  legendary: '#e0a93b',
};

const TYPE_LABEL: Record<NodeType, string> = {
  atk: 'Attack',
  def: 'Defense',
  uti: 'Support',
  pvp: 'PvP',
  wild: 'Wildcard',
};

export function Planner() {
  const { activeBuild } = useStore();
  const [editing, setEditing] = useState<string | null>(null);

  const canvasW = TREE_COLS * CELL;
  const canvasH = TREE_ROWS * CELL;
  const center = (col: number, row: number) => ({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });

  const editingNode = editing ? TREE_NODE_BY_ID[editing] : null;

  return (
    <div>
      <div className="tree-legend">
        <span>🌳 Árvore Fusion Tier</span>
        <span className="chip attack">⚔ {TYPE_COUNTS.atk} Attack</span>
        <span className="chip defense">🛡 {TYPE_COUNTS.def} Defense</span>
        <span className="chip support">⏳ {TYPE_COUNTS.uti} Support</span>
        <span className="chip pvp">★ {TYPE_COUNTS.pvp} PvP</span>
        <span className="chip" style={{ background: 'rgba(232,200,105,0.2)', color: 'var(--wildcard)' }}>✦ {TYPE_COUNTS.wild} Wildcard</span>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
          {RARITY_COUNTS.common} comuns · {RARITY_COUNTS.rare} raras · {RARITY_COUNTS.legendary} lendárias — clique num node
        </span>
      </div>

      <div className="tree-wrap">
        <div className="tree-canvas" style={{ width: canvasW, height: canvasH }}>
          {/* Pipes / edges */}
          {TREE_EDGES.map((e, i) => {
            const a = TREE_NODE_BY_ID[e.a];
            const b = TREE_NODE_BY_ID[e.b];
            if (!a || !b) return null;
            const ca = center(a.col, a.row);
            const cb = center(b.col, b.row);
            const horizontal = a.row === b.row;
            const filled = !!activeBuild.slots[e.a]?.soulId && !!activeBuild.slots[e.b]?.soulId;
            const img = horizontal
              ? filled ? '/fusion/Pipe-Fill.png' : '/fusion/Pipe-Empty.png'
              : filled ? '/fusion/Pipe-Fill-ver.png' : '/fusion/Pipe-Empty-ver.png';
            const style: React.CSSProperties = horizontal
              ? {
                  left: Math.min(ca.x, cb.x) + NODE / 2,
                  top: ca.y - PIPE / 2,
                  width: Math.abs(cb.x - ca.x) - NODE,
                  height: PIPE,
                }
              : {
                  left: ca.x - PIPE / 2,
                  top: Math.min(ca.y, cb.y) + NODE / 2,
                  width: PIPE,
                  height: Math.abs(cb.y - ca.y) - NODE,
                };
            return <img key={i} className="tedge" src={img} style={style} alt="" />;
          })}

          {/* Nodes */}
          {TREE_NODES.map((n) => {
            const c = center(n.col, n.row);
            const slot = activeBuild.slots[n.id];
            const soul = slot?.soulId ? SOULS_BY_ID[slot.soulId] : null;
            const svs = soul ? slotStatValues(slot, n.rarity) : [];
            const title = soul
              ? `${soul.name} — ${svs.map((sv) => `${sv.label} +${fmt(sv.value, sv.unit)}`).join(', ')} (node ${n.rarity} Lv${slot.nodeLevel})`
              : `${TYPE_LABEL[n.type]} — node ${n.rarity} vazio`;
            return (
              <div
                key={n.id}
                className={`tnode ${soul ? 'filled' : ''}`}
                style={{
                  left: c.x - NODE / 2,
                  top: c.y - NODE / 2,
                  width: NODE,
                  height: NODE,
                  ['--rarity' as string]: RARITY_GLOW[n.rarity],
                }}
                title={title}
                onClick={() => setEditing(n.id)}
              >
                <img className="tnode-frame" src={nodeFrameSrc(n.type, n.rarity)} alt="" />
                <div className="tnode-content">
                  {soul ? (
                    <SoulIcon soul={soul} size={NODE * 0.56} />
                  ) : (
                    <img className="tnode-type" src={NODE_TYPE_ICON[n.type]} alt={TYPE_LABEL[n.type]} />
                  )}
                </div>
                {soul && <span className="tnode-lvl">{n.rarity[0].toUpperCase()}{slot.nodeLevel}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {editingNode && (
        <NodeEditor
          nodeId={editingNode.id}
          type={editingNode.type}
          onClose={() => setEditing(null)}
        />
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Cada node tem uma raridade fixa (cinza = comum, azul = rara, dourado = lendária). Um node aceita souls da
        sua categoria (<b>{CATEGORY_LABEL.attack}</b>, <b>{CATEGORY_LABEL.defense}</b>, <b>{CATEGORY_LABEL.support}</b>, <b>PvP</b>)
        com raridade igual ou superior à do node. Os nodes <b>Wildcard</b> (✦) aceitam qualquer soul rara ou lendária.
      </p>
    </div>
  );
}
