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
import { Streamers } from './components/Streamers';
import { Guides } from './components/Guides';
import { Mixing } from './components/Mixing';
import { ResetPasswordModal } from './components/market/ResetPasswordModal';
import { useI18n } from './lib/i18n';

export type Section = 'home' | 'timers' | 'market' | 'streamers' | 'guides' | 'tools';
type Tab = 'planner' | 'inventory' | 'optimizer';
type TimerTab = 'boss' | 'fury';
type ToolTab = 'soultree' | 'mixing' | 'sod';

const SECTIONS: Section[] = ['home', 'timers', 'market', 'streamers', 'guides', 'tools'];

interface SubTab { id: string; icon: string; key: string }
interface NavItem { id: Section; icon: string; key: string; tabs?: SubTab[] }

const TIMER_TABS: { id: TimerTab; icon: string; key: string }[] = [
  { id: 'boss', icon: '🕐', key: 'nav.timeboss' },
  { id: 'fury', icon: '🔥', key: 'nav.timerfury' },
];

const TOOL_TABS: { id: ToolTab; icon: string; key: string }[] = [
  { id: 'soultree', icon: '🌳', key: 'nav.soultree' },
  { id: 'mixing', icon: '⚗️', key: 'nav.mixing' },
  { id: 'sod', icon: '🎯', key: 'nav.sod' },
];

// Tabs with `tabs` open a dropdown (cascade) instead of navigating directly.
const NAV: NavItem[] = [
  { id: 'home', icon: '🏠', key: 'nav.home' },
  { id: 'timers', icon: '⏱️', key: 'nav.timers', tabs: TIMER_TABS },
  { id: 'tools', icon: '🧰', key: 'nav.tools', tabs: TOOL_TABS },
  { id: 'market', icon: '🏰', key: 'nav.market' },
  { id: 'guides', icon: '🎬', key: 'nav.guides' },
  { id: 'streamers', icon: '📺', key: 'nav.streamers' },
];

/** Old top-level sections that are now sub-tabs — keep returning visitors put. */
const LEGACY: Record<string, { section: Section; timer?: TimerTab; tool?: ToolTab }> = {
  timeboss: { section: 'timers', timer: 'boss' },
  timerfury: { section: 'timers', timer: 'fury' },
  soultree: { section: 'tools', tool: 'soultree' },
  mixing: { section: 'tools', tool: 'mixing' },
  sod: { section: 'tools', tool: 'sod' },
};

function initialNav(): { section: Section; timerTab: TimerTab; toolTab: ToolTab } {
  let timerTab = (localStorage.getItem('timers-tab') as TimerTab) || 'boss';
  let toolTab = (localStorage.getItem('tools-tab') as ToolTab) || 'soultree';
  // A shared listing/seller link (#item-… / #seller-…) opens the Marketplace.
  const h = window.location.hash;
  if (h.startsWith('#item-') || h.startsWith('#seller-')) return { section: 'market', timerTab, toolTab };

  const saved = localStorage.getItem('site-section') ?? '';
  if (SECTIONS.includes(saved as Section)) return { section: saved as Section, timerTab, toolTab };
  const legacy = LEGACY[saved];
  if (legacy) {
    if (legacy.timer) timerTab = legacy.timer;
    if (legacy.tool) toolTab = legacy.tool;
    return { section: legacy.section, timerTab, toolTab };
  }
  return { section: 'home', timerTab, toolTab };
}

const INIT = initialNav();

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [section, setSection] = useState<Section>(INIT.section);
  const [timerTab, setTimerTab] = useState<TimerTab>(INIT.timerTab);
  const [toolTab, setToolTab] = useState<ToolTab>(INIT.toolTab);
  const [openMenu, setOpenMenu] = useState<Section | null>(null);

  const go = (s: Section) => {
    setSection(s);
    localStorage.setItem('site-section', s);
    window.scrollTo({ top: 0 });
  };
  const goTimer = (tb: TimerTab) => { setTimerTab(tb); localStorage.setItem('timers-tab', tb); window.scrollTo({ top: 0 }); };
  const goTool = (tb: ToolTab) => { setToolTab(tb); localStorage.setItem('tools-tab', tb); window.scrollTo({ top: 0 }); };

  // Navigate to a dropdown item (section + its sub-tab), then close the menu.
  const pickSub = (sectionId: Section, subId: string) => {
    go(sectionId);
    if (sectionId === 'timers') goTimer(subId as TimerTab);
    else if (sectionId === 'tools') goTool(subId as ToolTab);
    setOpenMenu(null);
  };
  const currentSub = (sectionId: Section) => (sectionId === 'timers' ? timerTab : sectionId === 'tools' ? toolTab : '');

  // Close the open dropdown on outside click or Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.topnav-item')) setOpenMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openMenu]);

  return (
    <div className="shell">
      <nav className="topnav">
        <button className="topnav-brand" onClick={() => { setOpenMenu(null); go('home'); }}>
          ⚔️ <span>PristonZONE</span>
        </button>
        <div className="topnav-tabs">
          {NAV.map((n) => n.tabs ? (
            <div key={n.id} className="topnav-item">
              <button
                className={`topnav-tab has-menu ${section === n.id ? 'active' : ''} ${openMenu === n.id ? 'open' : ''}`}
                onClick={() => setOpenMenu(openMenu === n.id ? null : n.id)}
                aria-haspopup="true"
                aria-expanded={openMenu === n.id}
              >
                {n.icon} {t(n.key)} <span className="topnav-caret">▾</span>
              </button>
              {openMenu === n.id && (
                <div className="topnav-menu">
                  {n.tabs.map((sub) => (
                    <button
                      key={sub.id}
                      className={`topnav-menu-item ${section === n.id && currentSub(n.id) === sub.id ? 'active' : ''}`}
                      onClick={() => pickSub(n.id, sub.id)}
                    >
                      {sub.icon} {t(sub.key)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={n.id} className="topnav-item">
              <button
                className={`topnav-tab ${section === n.id ? 'active' : ''}`}
                onClick={() => { setOpenMenu(null); go(n.id); }}
              >
                {n.icon} {t(n.key)}
              </button>
            </div>
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
        <Home />
      ) : section === 'timers' ? (
        timerTab === 'boss' ? <TimeBoss /> : <TimerFury />
      ) : section === 'market' ? (
        <Marketplace />
      ) : section === 'streamers' ? (
        <Streamers />
      ) : section === 'guides' ? (
        <Guides />
      ) : (
        toolTab === 'soultree' ? <SoulTree /> : toolTab === 'mixing' ? <Mixing /> : <SoD />
      )}

      <ResetPasswordModal />
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

      {/* All tabs stay MOUNTED (hidden with CSS) so their state survives
          switching — e.g. the Generator's deep-search results and sliders
          are still there when the player comes back from the tree. */}
      <div className="layout" style={{ display: tab === 'planner' ? undefined : 'none' }}>
        <div className="panel">
          <Planner />
        </div>
        <TotalsPanel />
      </div>

      <div className="layout" style={{ display: tab === 'inventory' ? undefined : 'none' }}>
        <Inventory />
        <TotalsPanel />
      </div>

      <div className="layout" style={{ display: tab === 'optimizer' ? undefined : 'none' }}>
        <Optimizer />
        <TotalsPanel />
      </div>

      {showTour && <Tour setTab={setTab} onClose={closeTour} />}
    </div>
  );
}
