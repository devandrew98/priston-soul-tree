import { useState } from 'react';
import { BuildBar } from './components/BuildBar';
import { CloudSync } from './components/CloudSync';
import { Planner } from './components/Planner';
import { TotalsPanel } from './components/TotalsPanel';
import { Inventory } from './components/Inventory';
import { Optimizer } from './components/Optimizer';

type Tab = 'planner' | 'inventory' | 'optimizer';

export default function App() {
  const [tab, setTab] = useState<Tab>('planner');

  return (
    <div className="app">
      <div className="header">
        <div
          className="title"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
          title="Voltar ao topo da página"
        >
          Priston Tale EU — Soul Tree
          <span>Fusion Tier · planejador de builds & gerador inteligente</span>
        </div>
        <div className="header-right">
          <BuildBar />
          <CloudSync />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'planner' ? 'active' : ''}`} onClick={() => setTab('planner')}>🌳 Árvore</button>
        <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>🎒 Inventário</button>
        <button className={`tab ${tab === 'optimizer' ? 'active' : ''}`} onClick={() => setTab('optimizer')}>🤖 Gerador (IA)</button>
      </div>

      {tab === 'planner' && (
        <div className="layout">
          <div className="panel">
            <Planner />
          </div>
          <TotalsPanel />
        </div>
      )}

      {tab === 'inventory' && (
        <div className="layout">
          <Inventory />
          <TotalsPanel />
        </div>
      )}

      {tab === 'optimizer' && (
        <div className="layout">
          <Optimizer />
          <TotalsPanel />
        </div>
      )}
    </div>
  );
}
