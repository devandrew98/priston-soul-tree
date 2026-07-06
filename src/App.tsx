import { useEffect, useState } from 'react';
import { BuildBar } from './components/BuildBar';
import { CloudSync } from './components/CloudSync';
import { Planner } from './components/Planner';
import { TotalsPanel } from './components/TotalsPanel';
import { Inventory } from './components/Inventory';
import { Optimizer } from './components/Optimizer';
import { Tour } from './components/Tour';
import { TimeBoss } from './components/TimeBoss';
import { TimerFury } from './components/TimerFury';
import { Home } from './components/Home';
import { SoD } from './components/SoD';
import { Marketplace } from './components/market/Marketplace';
import { useI18n } from './lib/i18n';

export type Section = 'home' | 'timeboss' | 'timerfury' | 'sod' | 'market' | 'soultree';
type Tab = 'planner' | 'inventory' | 'optimizer';

const SECTIONS: Section[] = ['home', 'timeboss', 'timerfury', 'sod', 'market', 'soultree'];

const NAV: { id: Section; icon: string; key: string }[] = [
  { id: 'home', icon: '🏠', key: 'nav.home' },
  { id: 'timeboss', icon: '🕐', key: 'nav.timeboss' },
  { id: 'timerfury', icon: '🔥', key: 'nav.timerfury' },
  { id: 'sod', icon: '🎯', key: 'nav.sod' },
  { id: 'market', icon: '🏰', key: 'nav.market' },
  { id: 'soultree', icon: '🌳', key: 'nav.soultree' },
];

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [section, setSection] = useState<Section>(() => {
    const saved = localStorage.getItem('site-section');
    return saved && SECTIONS.includes(saved as Section) ? (saved as Section) : 'home';
  });

  const go = (s: Section) => {
    setSection(s);
    localStorage.setItem('site-section', s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="shell">
      <nav className="topnav">
        <button className="topnav-brand" onClick={() => go('home')}>
          ⚔️ <span>Priston Tale EU</span>
        </button>
        <div className="topnav-tabs">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`topnav-tab ${section === n.id ? 'active' : ''}`}
              onClick={() => go(n.id)}
            >
              {n.icon} {t(n.key)}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="lang-toggle" title={t('lang.switch')}>
          <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')}>
            🇧🇷 PT
          </button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
            🇬🇧 EN
          </button>
        </div>
      </nav>

      {section === 'home' ? (
        <Home go={go} />
      ) : section === 'timeboss' ? (
        <TimeBoss />
      ) : section === 'timerfury' ? (
        <TimerFury />
      ) : section === 'sod' ? (
        <SoD />
      ) : section === 'market' ? (
        <Marketplace />
      ) : (
        <SoulTree />
      )}
    </div>
  );
}

function SoulTree() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('planner');
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('priston-tour-done')) setShowTour(true);
  }, []);

  const closeTour = () => {
    setShowTour(false);
    localStorage.setItem('priston-tour-done', '1');
  };

  return (
    <div className="app">
      <div className="header">
        <div
          className="title"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
          title={t('st.backtop')}
        >
          {t('st.title')}
          <span>{t('st.subtitle')}</span>
        </div>
        <div className="header-right">
          <BuildBar />
          <CloudSync />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'planner' ? 'active' : ''}`} onClick={() => setTab('planner')}>
          {t('st.tab.tree')}
        </button>
        <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          {t('st.tab.inventory')}
        </button>
        <button className={`tab ${tab === 'optimizer' ? 'active' : ''}`} onClick={() => setTab('optimizer')}>
          {t('st.tab.optimizer')}
        </button>
        <span className="spacer" />
        <button className="btn sm" onClick={() => setShowTour(true)} title={t('st.tutorial.tip')}>
          {t('st.tutorial')}
        </button>
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

      {showTour && <Tour setTab={setTab} onClose={closeTour} />}
    </div>
  );
}
