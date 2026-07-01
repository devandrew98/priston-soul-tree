import { useState } from 'react';
import type { NodeType } from '../lib/tree';
import { NODE_CATEGORY, RARITY_POINT_COST, TREE_NODE_BY_ID } from '../lib/tree';
import { SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { slotStatValues, nodePointCost } from '../lib/calc';
import { fmt, RARITY_LABEL } from '../lib/formula';
import { useStore } from '../store';
import { SoulPicker } from './SoulPicker';
import { SoulIcon } from './SoulIcon';

export function NodeEditor({ nodeId, type, onClose }: { nodeId: string; type: NodeType; onClose: () => void }) {
  const { activeBuild, setSlot, clearSlot } = useStore();
  const [picking, setPicking] = useState(false);

  const node = TREE_NODE_BY_ID[nodeId];
  const rarity = node.rarity;
  const slot = activeBuild.slots[nodeId];
  const soul = slot.soulId ? SOULS_BY_ID[slot.soulId] : null;
  const accepts = NODE_CATEGORY[type];
  const svs = slotStatValues(slot, rarity);
  const cost = nodePointCost(slot, rarity);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(440px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            Node {accepts === 'wildcard' ? 'Wildcard' : CATEGORY_LABEL[accepts]}{' '}
            <span className={`rarity-tag ${rarity}`}>{RARITY_LABEL[rarity]}</span>
          </h3>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="ne-soul">
            {soul ? (
              <>
                <SoulIcon soul={soul} size={48} />
                <div style={{ flex: 1 }}>
                  <div className="pick-name">{soul.name}</div>
                  <div className="pick-meta">{soul.stats.map((st) => `${st.statLabel} (base ${fmt(st.ranks[slot.soulLevel - 1], st.unit)})`).join(' · ')} · SL{slot.soulLevel}</div>
                </div>
                <div className="soul-val">{svs.map((sv) => `+${fmt(sv.value, sv.unit)}`).join(' / ')}</div>
              </>
            ) : (
              <div className="muted" style={{ padding: '8px 0' }}>Nenhuma soul neste node.</div>
            )}
          </div>

          <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setPicking(true)}>
            {soul ? 'Trocar soul' : '+ Escolher soul'}
          </button>

          {soul && (
            <div className="ne-ctrl">
              <label>Nível da soul</label>
              <div className="lvl-btns">
                {[1, 2, 3].map((lv) => (
                  <button key={lv} className={`lvl-btn ${slot.soulLevel === lv ? 'active' : ''}`} onClick={() => setSlot(nodeId, { soulLevel: lv as 1 | 2 | 3 })}>{lv}</button>
                ))}
              </div>
            </div>
          )}

          <div className="ne-ctrl">
            <label>Raridade do node (fixa)</label>
            <div className={`rarity-tag ${rarity}`} title={`${RARITY_POINT_COST[rarity]} pt por nível`}>
              {RARITY_LABEL[rarity]}
            </div>
          </div>

          <div className="ne-ctrl">
            <label>Nível do node (ilimitado)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={slot.nodeLevel}
              onChange={(e) => setSlot(nodeId, { nodeLevel: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              style={{ width: 110 }}
            />
          </div>

          <div className="ne-cost">
            Custo: <b>{cost}</b> pontos de fusão ({RARITY_LABEL[rarity]} {RARITY_POINT_COST[rarity]} × Lv{slot.nodeLevel})
          </div>

          {soul && (
            <button className="btn danger" style={{ width: '100%', marginTop: 10 }} onClick={() => { clearSlot(nodeId); onClose(); }}>
              Remover soul
            </button>
          )}
        </div>
      </div>

      {picking && (
        <SoulPicker
          accepts={accepts}
          nodeRarity={rarity}
          onClose={() => setPicking(false)}
          onPick={(soulId, soulLevel) => {
            setSlot(nodeId, { soulId, soulLevel });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
