import { useEffect, useMemo, useRef, useState } from 'react';
import type { SlotState } from '../lib/types';
import {
  TREE_NODES,
  TREE_EDGES,
  TREE_NODE_BY_ID,
  TREE_COLS,
  TREE_ROWS,
  nodeFrameSrc,
  NODE_TYPE_ICON,
  NODE_CATEGORY,
  RARITY_POINT_COST,
  acceptsSoul,
  pvpSoulKind,
  TYPE_COUNTS,
  type NodeType,
  type TreeNode,
} from '../lib/tree';
import { SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { fmt } from '../lib/formula';
import { pointsSpent } from '../lib/calc';
import { unlockedFor } from '../lib/graph';
import { useStore, totalFusionPoints } from '../store';
import { useI18n } from '../lib/i18n';
import { SoulIcon } from './SoulIcon';
import { NodeEditor } from './NodeEditor';
import { HelpTip } from './HelpTip';

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

// In-game soul category wording for the hover tooltip (support -> "Utility").
const SOUL_CAT_LABEL: Record<string, string> = {
  attack: 'Attack',
  defense: 'Defense',
  support: 'Utility',
  pvp: 'PvP',
};

// Build order (top → bottom, left → right) used by the "rapid build" auto-advance.
const NODE_ORDER: string[] = [...TREE_NODES].sort((a, b) => a.row - b.row || a.col - b.col).map((n) => n.id);

export function Planner() {
  const { activeBuild, clearSlot, setSlot, moveSoul, toggleOpen, fusionLevel } = useStore();
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rapid, setRapid] = useState(false);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const undoStack = useRef<{ nodeId: string; slot: SlotState }[]>([]);

  // Nodes that are OPEN: every soul plus the cheapest pass-through path back to the top.
  const unlocked = useMemo(() => {
    const souled = Object.entries(activeBuild.slots).filter(([, s]) => s.soulId).map(([id]) => id);
    return unlockedFor([...souled, ...(activeBuild.opened ?? [])]);
  }, [activeBuild]);

  const spent = useMemo(() => pointsSpent(activeBuild), [activeBuild]);
  const budget = totalFusionPoints(fusionLevel);

  // Can the soul on `fromId` be dropped/moved onto `target`? (category+rarity, allows a valid swap)
  const canReceive = (target: TreeNode, fromId: string): boolean => {
    if (fromId === target.id) return false;
    const aId = activeBuild.slots[fromId]?.soulId;
    const soulA = aId ? SOULS_BY_ID[aId] : null;
    if (!soulA) return false;
    if (!acceptsSoul(NODE_CATEGORY[target.type], target.rarity, soulA.category, soulA.rarity, target.pvpKind, pvpSoulKind(soulA))) return false;
    const bId = activeBuild.slots[target.id]?.soulId;
    const soulB = bId ? SOULS_BY_ID[bId] : null;
    if (!soulB) return true;
    const fromNode = TREE_NODE_BY_ID[fromId];
    return acceptsSoul(NODE_CATEGORY[fromNode.type], fromNode.rarity, soulB.category, soulB.rarity, fromNode.pvpKind, pvpSoulKind(soulB));
  };

  // Next still-empty node in build order (for rapid-build auto-advance).
  const nextEmpty = (afterId: string): string | null => {
    const i = NODE_ORDER.indexOf(afterId);
    for (let j = i + 1; j < NODE_ORDER.length; j++) {
      if (!activeBuild.slots[NODE_ORDER[j]]?.soulId) return NODE_ORDER[j];
    }
    return null;
  };

  // Keyboard: Backspace/Delete removes the soul from the selected node; Ctrl+Z
  // restores the last removed soul. (Ignored while typing in an input.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const last = undoStack.current.pop();
        if (last) { setSlot(last.nodeId, last.slot); setSelected(last.nodeId); e.preventDefault(); }
        return;
      }
      if (editing) return;
      if ((e.key === 'Backspace' || e.key === 'Delete') && selected) {
        if (activeBuild.slots[selected]?.soulId) {
          undoStack.current.push({ nodeId: selected, slot: { ...activeBuild.slots[selected] } });
          clearSlot(selected);
          e.preventDefault();
        } else if ((activeBuild.opened ?? []).includes(selected)) {
          toggleOpen(selected); // close a manually-opened empty node
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, selected, activeBuild, clearSlot, setSlot, toggleOpen]);

  const canvasW = TREE_COLS * CELL;
  const canvasH = TREE_ROWS * CELL;
  const center = (col: number, row: number) => ({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });

  const editingNode = editing ? TREE_NODE_BY_ID[editing] : null;

  return (
    <div>
      <div className="tree-legend">
        <span>{t('st.tree.title')}</span>
        <span className="chip attack">⚔ {TYPE_COUNTS.atk} Attack</span>
        <span className="chip defense">🛡 {TYPE_COUNTS.def} Defense</span>
        <span className="chip support">⏳ {TYPE_COUNTS.uti} Support</span>
        <span className="chip pvp">★ {TYPE_COUNTS.pvp} PvP</span>
        <span className="chip" style={{ background: 'rgba(232,200,105,0.2)', color: 'var(--wildcard)' }}>✦ {TYPE_COUNTS.wild} Wildcard</span>
        <label className="row" style={{ gap: 6, marginLeft: 'auto', fontSize: 12, cursor: 'pointer' }} title={t('st.rapid.title')}>
          <input type="checkbox" checked={rapid} onChange={(e) => setRapid(e.target.checked)} /> {t('st.rapid')}
        </label>
        <HelpTip text={t('st.rapid.help')} />
        <span className="muted" style={{ fontSize: 12 }}>{t('st.hint.interact')}</span>
      </div>

      {moving && (
        <div className="move-hint">{t('st.moving')}</div>
      )}
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
            const filled = unlocked.has(e.a) && unlocked.has(e.b);
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
            const emptyTitle = soul ? undefined : t('st.node.emptytitle', { type: TYPE_LABEL[n.type], rarity: t('st.rarity.' + n.rarity) });
            return (
              <div
                key={n.id}
                className={`tnode ${soul ? 'filled' : ''} ${selected === n.id ? 'selected' : ''} ${moving === n.id ? 'moving' : ''} ${moving && canReceive(n, moving) ? 'drop-ok' : ''} ${unlocked.has(n.id) ? '' : 'locked'}`}
                style={{
                  left: c.x - NODE / 2,
                  top: c.y - NODE / 2,
                  width: NODE,
                  height: NODE,
                  ['--rarity' as string]: RARITY_GLOW[n.rarity],
                }}
                title={emptyTitle}
                draggable={!!soul}
                onDragStart={() => { setDragFrom(n.id); setMoving(null); }}
                onDragOver={(e) => { if (dragFrom && canReceive(n, dragFrom)) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragFrom && canReceive(n, dragFrom)) { moveSoul(dragFrom, n.id); setSelected(n.id); } setDragFrom(null); }}
                onDragEnd={() => setDragFrom(null)}
                onClick={() => {
                  if (moving) {
                    if (canReceive(n, moving)) { moveSoul(moving, n.id); setSelected(n.id); }
                    setMoving(null);
                    return;
                  }
                  if (!soul) toggleOpen(n.id); // empty node: open/close (manual unlock)
                  setSelected(n.id);
                }}
                onDoubleClick={() => { setSelected(n.id); setEditing(n.id); }}
              >
                <img className="tnode-frame" src={nodeFrameSrc(n.type, n.rarity, n.pvpKind)} alt="" />
                <div className="tnode-content">
                  {soul ? (
                    <SoulIcon soul={soul} size={NODE * 0.56} />
                  ) : (
                    // defensive PvP node: shield icon (the ✚ is the offensive one)
                    <img
                      className="tnode-type"
                      src={n.pvpKind === 'def' ? NODE_TYPE_ICON.def : NODE_TYPE_ICON[n.type]}
                      alt={TYPE_LABEL[n.type]}
                    />
                  )}
                </div>
                {soul &&
                  [1, 2, 3].map((lv) => (
                    <button
                      key={lv}
                      className={`pip p${lv} ${slot.soulLevel >= lv ? 'on' : ''}`}
                      title={t('st.pip', { n: lv })}
                      onClick={(e) => { e.stopPropagation(); setSlot(n.id, { soulLevel: lv as 1 | 2 | 3 }); }}
                      onDoubleClick={(e) => e.stopPropagation()}
                    />
                  ))}
                {soul && (selected === n.id ? (
                  <span className="tnode-lvl ctrl" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <button className={`lvl-adj mv ${moving === n.id ? 'on' : ''}`} title={t('st.node.move')} onClick={(e) => { e.stopPropagation(); setMoving(moving === n.id ? null : n.id); }}>⇄</button>
                    <button className="lvl-adj" title={t('st.node.lvldown')} disabled={slot.nodeLevel <= 1} onClick={(e) => { e.stopPropagation(); setSlot(n.id, { nodeLevel: Math.max(1, slot.nodeLevel - 1) }); }}>−</button>
                    <span className="lvl-num">{slot.nodeLevel}</span>
                    <button className="lvl-adj" title={t('st.node.lvlup')} disabled={spent + RARITY_POINT_COST[n.rarity] > budget} onClick={(e) => { e.stopPropagation(); setSlot(n.id, { nodeLevel: slot.nodeLevel + 1 }); }}>+</button>
                  </span>
                ) : (
                  <span className="tnode-lvl">{slot.nodeLevel}</span>
                ))}
                {/* Node vazio ABERTO: mostra os pontos investidos (como no jogo)
                    e, selecionado, deixa distribuir pontos sem precisar de soul. */}
                {!soul && (activeBuild.opened ?? []).includes(n.id) && (selected === n.id ? (
                  <span className="tnode-lvl ctrl" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <button className="lvl-adj wide" title={t('st.node.addsoul')} onClick={(e) => { e.stopPropagation(); setSelected(n.id); setEditing(n.id); }}>+ soul</button>
                    <button className="lvl-adj" title={t('st.node.lvldown')} disabled={slot.nodeLevel <= 1} onClick={(e) => { e.stopPropagation(); setSlot(n.id, { nodeLevel: Math.max(1, slot.nodeLevel - 1) }); }}>−</button>
                    <span className="lvl-num">{slot.nodeLevel}</span>
                    <button className="lvl-adj" title={t('st.node.lvlup')} disabled={spent + RARITY_POINT_COST[n.rarity] > budget} onClick={(e) => { e.stopPropagation(); setSlot(n.id, { nodeLevel: slot.nodeLevel + 1 }); }}>+</button>
                  </span>
                ) : (
                  <span className="tnode-lvl">{slot.nodeLevel}</span>
                ))}
                {soul && (
                  <div className={`node-tip r-${soul.rarity} ${n.col >= 4 ? 'left' : 'right'}`}>
                    <div className="node-tip-head"><SoulIcon soul={soul} size={24} /><span>{soul.name}</span></div>
                    <div className="node-tip-body">
                      <div className="node-tip-sub">{t('st.rarity.' + soul.rarity)} {SOUL_CAT_LABEL[soul.category]} Soul</div>
                      {soul.stats.map((st) => (
                        <div key={st.stat} className="node-tip-stat">
                          {[1, 2, 3].map((lv) => (
                            <div key={lv} className="node-tip-line">Level {lv} - {st.statLabel} + {fmt(st.ranks[lv - 1], st.unit)}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
          onPlaced={(id) => {
            if (!rapid) return;
            const nx = nextEmpty(id);
            setEditing(nx);
            setSelected(nx);
          }}
        />
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        {t('st.planner.note', { atk: CATEGORY_LABEL.attack, def: CATEGORY_LABEL.defense, sup: CATEGORY_LABEL.support })}
      </p>
    </div>
  );
}
