import { useMemo, useState } from 'react';
import type { Category, Rarity } from '../lib/types';
import { SOULS, CATEGORY_LABEL } from '../lib/souls';
import { fmt, RARITY_LABEL } from '../lib/formula';
import { acceptsSoul } from '../lib/tree';
import { useStore } from '../store';
import { SoulIcon } from './SoulIcon';

interface Props {
  accepts: Category | 'wildcard';
  nodeRarity: Rarity;
  onPick: (soulId: string, soulLevel: 1 | 2 | 3) => void;
  onClose: () => void;
}

export function SoulPicker({ accepts, nodeRarity, onPick, onClose }: Props) {
  const { inventory } = useStore();
  const [q, setQ] = useState('');
  const [onlyOwned, setOnlyOwned] = useState(false);

  const list = useMemo(() => {
    return SOULS.filter((s) => acceptsSoul(accepts, nodeRarity, s.category, s.rarity))
      .filter((s) => (onlyOwned ? !!inventory[s.id] : true))
      .filter((s) => (q ? (s.name + ' ' + s.statLabel).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.statLabel.localeCompare(b.statLabel) || a.name.localeCompare(b.name));
  }, [accepts, nodeRarity, q, onlyOwned, inventory]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            Escolher Soul {accepts !== 'wildcard' ? `— ${CATEGORY_LABEL[accepts]}` : '(Wildcard)'}{' '}
            <span className={`rarity-tag ${nodeRarity}`}>node {RARITY_LABEL[nodeRarity]}</span>
          </h3>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '10px 16px 0' }} className="row">
          <input className="input" placeholder="Buscar soul ou atributo..." value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} autoFocus />
          <label className="row" style={{ gap: 4 }}>
            <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> Só que tenho
          </label>
        </div>
        <div className="modal-body">
          {list.length === 0 && <p className="muted">Nenhuma soul encontrada.</p>}
          {list.map((s) => {
            const owned = inventory[s.id];
            return (
              <div key={s.id} className="pick-row">
                <div className="row" style={{ gap: 10 }}>
                  <SoulIcon soul={s} size={36} />
                  <div>
                    <div className="pick-name">{s.name} <span className={`chip ${s.category}`}>{CATEGORY_LABEL[s.category]}</span> <span className={`rarity-tag ${s.rarity}`}>{RARITY_LABEL[s.rarity]}</span></div>
                    <div className="pick-meta">
                      {s.statLabel} · base {fmt(s.ranks[0], s.unit)} / {fmt(s.ranks[1], s.unit)} / {fmt(s.ranks[2], s.unit)}
                      {s.mapLevel != null ? ` · map ${s.mapLevel}` : ''}
                      {owned ? ` · tenho Lv${owned}` : ''}
                    </div>
                  </div>
                </div>
                <div className="lvl-btns">
                  {[1, 2, 3].map((lv) => (
                    <button key={lv} className="lvl-btn" title={`Usar no nível ${lv} (base ${fmt(s.ranks[lv - 1], s.unit)})`} onClick={() => onPick(s.id, lv as 1 | 2 | 3)}>
                      {lv}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
