import { useEffect, useMemo, useState } from 'react';
import type { NodeType } from '../lib/tree';
import { NODE_CATEGORY, RARITY_POINT_COST, TREE_NODE_BY_ID, acceptsSoul, pvpSoulKind } from '../lib/tree';
import { SOULS, SOULS_BY_ID, CATEGORY_LABEL } from '../lib/souls';
import { slotStatValues, nodePointCost, pointsSpent } from '../lib/calc';
import { fmt, RARITY_LABEL } from '../lib/formula';
import { useStore, totalFusionPoints } from '../store';
import { useI18n } from '../lib/i18n';
import { SoulIcon } from './SoulIcon';

export function NodeEditor({ nodeId, type, onClose, onPlaced }: { nodeId: string; type: NodeType; onClose: () => void; onPlaced?: (nodeId: string) => void }) {
  const { activeBuild, inventory, setSlot, clearSlot, fusionLevel } = useStore();
  const { t } = useI18n();
  const [q, setQ] = useState('');

  const node = TREE_NODE_BY_ID[nodeId];
  const rarity = node.rarity;
  const slot = activeBuild.slots[nodeId];
  const soul = slot.soulId ? SOULS_BY_ID[slot.soulId] : null;
  const accepts = NODE_CATEGORY[type];
  const svs = slotStatValues(slot, rarity);
  const cost = nodePointCost(slot, rarity);
  // Node level is capped only by your total fusion points (rare ×2, legendary ×3).
  const budget = totalFusionPoints(fusionLevel);
  const spentElsewhere = pointsSpent(activeBuild) - cost;
  const maxNodeLevel = Math.max(1, Math.floor((budget - spentElsewhere) / RARITY_POINT_COST[rarity]));

  // Souls this node accepts, filtered live by the search box.
  const list = useMemo(() => {
    return SOULS.filter((s) => acceptsSoul(accepts, rarity, s.category, s.rarity, node.pvpKind, pvpSoulKind(s)))
      .filter((s) => (q ? (s.name + ' ' + s.stats.map((st) => st.statLabel).join(' ')).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.stats[0].statLabel.localeCompare(b.stats[0].statLabel) || a.name.localeCompare(b.name));
  }, [accepts, rarity, q, node.pvpKind]);

  // Souls já colocadas em OUTROS nodes — cada soul é única, não pode repetir.
  const usedElsewhere = useMemo(() => {
    const set = new Set<string>();
    for (const [id, sl] of Object.entries(activeBuild.slots)) {
      if (id !== nodeId && sl.soulId) set.add(sl.soulId);
    }
    return set;
  }, [activeBuild, nodeId]);

  // Esc fecha o editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(460px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            Node {accepts === 'wildcard' ? 'Wildcard' : CATEGORY_LABEL[accepts]}{' '}
            <span className={`rarity-tag ${rarity}`}>{RARITY_LABEL[rarity]}</span>
          </h3>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {soul && (
            <div className="ne-soul">
              <SoulIcon soul={soul} size={48} />
              <div style={{ flex: 1 }}>
                <div className="pick-name">{soul.name}</div>
                <div className="pick-meta">{soul.stats.map((st) => `${st.statLabel} (base ${fmt(st.ranks[slot.soulLevel - 1], st.unit)})`).join(' · ')} · SL{slot.soulLevel}</div>
              </div>
              <div className="soul-val">{svs.map((sv) => `+${fmt(sv.value, sv.unit)}`).join(' / ')}</div>
            </div>
          )}

          {/* Busca de soul inline — digite e escolha ali mesmo */}
          <div className="ne-picker">
            <label className="ne-picker-label">{soul ? t('st.ne.swap') : t('st.ne.choose')}</label>
            <input
              className="input"
              placeholder={t('st.ne.searchph')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: '100%' }}
              autoFocus={!soul}
            />
            <div className="ne-picker-list">
              {list.length === 0 && <div className="muted" style={{ padding: 8 }}>{t('st.ne.none')}</div>}
              {list.map((s) => {
                const owned = inventory[s.id];
                const used = usedElsewhere.has(s.id);
                return (
                  <button
                    key={s.id}
                    className={`ne-pick-item ${soul?.id === s.id ? 'active' : ''}`}
                    disabled={used}
                    title={used ? t('st.ne.unique') : undefined}
                    onClick={() => { setSlot(nodeId, { soulId: s.id, soulLevel: 1 }); onPlaced?.(nodeId); }}
                  >
                    <SoulIcon soul={s} size={26} />
                    <span className="ne-pick-name">
                      {s.name} <span className={`rarity-tag ${s.rarity}`}>{RARITY_LABEL[s.rarity]}</span>
                      {used ? <span className="muted">{t('st.ne.intree')}</span> : owned ? <span className="muted">{t('st.ne.have', { lv: owned })}</span> : null}
                    </span>
                    <span className="ne-pick-meta">{s.stats.map((st) => st.statLabel).join(' + ')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {soul && (
            <div className="ne-ctrl">
              <label>{t('st.ne.soullvl')}</label>
              <div className="lvl-btns">
                {[1, 2, 3].map((lv) => (
                  <button key={lv} className={`lvl-btn ${slot.soulLevel === lv ? 'active' : ''}`} onClick={() => setSlot(nodeId, { soulLevel: lv as 1 | 2 | 3 })}>{lv}</button>
                ))}
              </div>
            </div>
          )}

          <div className="ne-ctrl">
            <label>{t('st.ne.nodelvl', { max: maxNodeLevel })}</label>
            <div className="lvl-stepper">
              <button className="btn sm" disabled={slot.nodeLevel <= 1} onClick={() => setSlot(nodeId, { nodeLevel: Math.max(1, slot.nodeLevel - 1) })}>−</button>
              <input
                className="input"
                type="number"
                min={1}
                max={maxNodeLevel}
                value={slot.nodeLevel}
                onChange={(e) => setSlot(nodeId, { nodeLevel: Math.min(maxNodeLevel, Math.max(1, Math.floor(Number(e.target.value) || 1))) })}
                style={{ width: 70, textAlign: 'center' }}
              />
              <button className="btn sm" disabled={slot.nodeLevel >= maxNodeLevel} onClick={() => setSlot(nodeId, { nodeLevel: Math.min(maxNodeLevel, slot.nodeLevel + 1) })}>+</button>
            </div>
          </div>

          <div className="ne-cost">
            {t('st.ne.cost', { cost, rarity: RARITY_LABEL[rarity], mult: RARITY_POINT_COST[rarity], lvl: slot.nodeLevel })}
          </div>

          {soul && (
            <button className="btn danger" style={{ width: '100%', marginTop: 10 }} onClick={() => { clearSlot(nodeId); onClose(); }}>
              {t('st.ne.remove')}
            </button>
          )}
          <button className="btn primary" style={{ width: '100%', marginTop: 10 }} onClick={onClose}>
            {t('st.ne.finish')}
          </button>
        </div>
      </div>
    </div>
  );
}
