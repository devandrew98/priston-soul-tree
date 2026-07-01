import { useMemo, useState } from 'react';
import type { Category } from '../lib/types';
import { SOULS, CATEGORY_LABEL, ALL_STATS } from '../lib/souls';
import { fmt } from '../lib/formula';
import { useStore } from '../store';
import { SoulIcon } from './SoulIcon';

const CATS: (Category | 'all')[] = ['all', 'attack', 'defense', 'support', 'pvp'];

export function Inventory() {
  const { inventory, setOwned } = useStore();
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [stat, setStat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [onlyOwned, setOnlyOwned] = useState(false);

  const list = useMemo(() => {
    return SOULS.filter((s) => (cat === 'all' ? true : s.category === cat))
      .filter((s) => (stat === 'all' ? true : s.stats.some((st) => st.stat === stat)))
      .filter((s) => (onlyOwned ? !!inventory[s.id] : true))
      .filter((s) => (q ? (s.name + ' ' + s.stats.map((st) => st.statLabel).join(' ')).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.stats[0].statLabel.localeCompare(b.stats[0].statLabel) || (b.stats[0].ranks[2] - a.stats[0].ranks[2]));
  }, [cat, stat, q, onlyOwned, inventory]);

  const ownedCount = Object.keys(inventory).length;

  return (
    <div className="panel">
      <div className="inv-controls">
        <strong style={{ color: 'var(--gold-bright)' }}>Inventário de Souls</strong>
        <span className="muted">({ownedCount} possuídas)</span>
        <span className="spacer" />
        <input className="input" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value as Category | 'all')}>
          {CATS.map((c) => <option key={c} value={c}>{c === 'all' ? 'Todas categorias' : CATEGORY_LABEL[c as Category]}</option>)}
        </select>
        <select className="input" value={stat} onChange={(e) => setStat(e.target.value)}>
          <option value="all">Todos atributos</option>
          {ALL_STATS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <label className="row" style={{ gap: 4 }}>
          <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} /> Só possuídas
        </label>
      </div>

      <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Soul</th>
              <th>Categoria</th>
              <th>Atributo</th>
              <th>L1 / L2 / L3</th>
              <th>Tenho (nível)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const owned: number = inventory[s.id] ?? 0;
              return (
                <tr key={s.id} className={owned ? 'owned' : ''}>
                  <td className="inv-row-name">
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <SoulIcon soul={s} size={28} />
                      <span>{s.name}{s.mapLevel != null && <span className="muted" style={{ fontWeight: 400 }}> · map {s.mapLevel}</span>}</span>
                    </span>
                  </td>
                  <td><span className={`chip ${s.category}`}>{CATEGORY_LABEL[s.category]}</span></td>
                  <td>{s.stats.map((st) => st.statLabel).join(' + ')}</td>
                  <td className="muted">{s.stats.map((st) => `${fmt(st.ranks[0], st.unit)} / ${fmt(st.ranks[1], st.unit)} / ${fmt(st.ranks[2], st.unit)}`).join('  ·  ')}</td>
                  <td>
                    <div className="lvl-btns">
                      <button className={`lvl-btn off ${owned === 0 ? 'active' : ''}`} onClick={() => setOwned(s.id, 0)} title="Não tenho">—</button>
                      {[1, 2, 3].map((lv) => (
                        <button key={lv} className={`lvl-btn ${owned === lv ? 'active' : ''}`} onClick={() => setOwned(s.id, lv as 1 | 2 | 3)}>{lv}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
