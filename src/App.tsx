import { useEffect, useState } from 'react';
import { BuildBar } from './components/BuildBar';
import { CloudSync } from './components/CloudSync';
import { Planner } from './components/Planner';
import { TotalsPanel } from './components/TotalsPanel';
import { Inventory } from './components/Inventory';
import { Optimizer } from './components/Optimizer';
import { Tour } from './components/Tour';
import { TimeBoss } from './components/TimeBoss';
import { useI18n } from './lib/i18n';

type Section = 'timeboss' | 'soultree';
type Tab = 'planner' | 'inventory' | 'optimizer';

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [section, setSection] = useState<Section>(() =>
    localStorage.getItem('site-section') === 'soultree' ? 'soultree' : 'timeboss',
  );

  const go = (s: Section) => {
    setSection(s);
    localStorage.setItem('site-section', s);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="shell">
      <nav className="topnav">
        <button className="topnav-brand" onClick={() => go('timeboss')}>
          ⚔️ <span>Priston Tale EU</span>
        </button>
        <div className="topnav-tabs">
          <button
            className={`topnav-tab ${section === 'timeboss' ? 'active' : ''}`}
            onClick={() => go('timeboss')}
          >
            🕐 {t('nav.timeboss')}
          </button>
          <button
            className={`topnav-tab ${section === 'soultree' ? 'active' : ''}`}
            onClick={() => go('soultree')}
          >
            🌳 {t('nav.soultree')}
          </button>
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

      {section === 'timeboss' ? <TimeBoss /> : <SoulTree />}
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
