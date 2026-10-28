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
import { Wardrobe } from './components/wardrobe/Wardrobe';
import { CharacterPublicPage } from './components/wardrobe/CharacterPublicPage';
import { SkillTree as SkillTreeTool } from './components/skilltree/SkillTree';
import { ScreenRooms } from './components/screenshare/ScreenRooms';
import { AgingSystem } from './components/aging/AgingSystem';
import { ClanFormation } from './components/clan/ClanFormation';
import { QuestTracker } from './components/quest/QuestTracker';
import { ClanSharePage } from './components/clan/ClanSharePage';
import { PersonalPage } from './components/personal/PersonalPage';
import { useClanAccess } from './components/clan/useClanAccess';
import { Builds } from './components/builds/Builds';
import { LOGIN_EVENT } from './lib/builds/account';
import { ResetPasswordModal } from './components/market/ResetPasswordModal';
import { AuthModal } from './components/market/AuthModal';
import { useAuth } from './components/market/store';
import { BACKEND_ENABLED } from './lib/market/supabase';
import { fetchSiteFlag } from './lib/market/siteSettings';
import { useI18n } from './lib/i18n';
import { initVisits } from './lib/visits';
import { DEFAULT_ROUTE, pathFor, routeFromPath, type Route, type Section, type TimerTab, type ToolTab } from './lib/routes';

type Tab = 'planner' | 'inventory' | 'optimizer';

interface SubTab { id: string; icon: string; key: string; /** Reachable by its link but not listed in the menu. */ hidden?: boolean }
interface NavItem { id: Section; icon: string; key: string; tabs?: SubTab[] }

const TIMER_TABS: { id: TimerTab; icon: string; key: string }[] = [
  { id: 'boss', icon: '🕐', key: 'nav.timeboss' },
  { id: 'fury', icon: '🔥', key: 'nav.timerfury' },
];

const TOOL_TABS: { id: ToolTab; icon: string; key: string; hidden?: boolean }[] = [
  { id: 'soultree', icon: '🌳', key: 'nav.soultree' },
  { id: 'skilltree', icon: '🌟', key: 'nav.skilltree' },
  { id: 'mixing', icon: '⚗', key: 'nav.mixing' },
  { id: 'sod', icon: '🎯', key: 'nav.sod' },
  { id: 'wardrobe', icon: '🧥', key: 'nav.wardrobe' },
  { id: 'builds', icon: '🏆', key: 'nav.builds' },
  { id: 'screenshare', icon: '🖥', key: 'nav.screenshare' },
  { id: 'aging', icon: '⚒', key: 'nav.aging' },
  { id: 'quests', icon: '📜', key: 'nav.quests', hidden: true }, // /quests works by link; remove `hidden` to list it in the menu
  { id: 'clan', icon: '🏰', key: 'nav.clan' }, // only shown to the admin and to clan leaders/vices
];

// Tabs with `tabs` open a dropdown (cascade) instead of navigating directly.
const NAV: NavItem[] = [
  { id: 'home', icon: '🏠', key: 'nav.home' },
  { id: 'timers', icon: '⏱', key: 'nav.timers', tabs: TIMER_TABS },
  { id: 'tools', icon: '🧰', key: 'nav.tools', tabs: TOOL_TABS },
  { id: 'market', icon: '🏰', key: 'nav.market' },
  { id: 'guides', icon: '🎬', key: 'nav.guides' },
  { id: 'streamers', icon: '📺', key: 'nav.streamers' },
];

/** The page the URL points at. The address is the only thing remembered: typing the bare
 *  domain is Home, while F5 / a shared link / Back land on the page in the address bar. */
function initialRoute(): Route {
  const { pathname, search, hash } = window.location;
  const fromPath = routeFromPath(pathname);
  // Older share links put their data in the hash of "/": send them to the page that reads it.
  if (!fromPath || fromPath.section === 'home') {
    if (hash.startsWith('#item-') || hash.startsWith('#seller-')) {
      window.history.replaceState(null, '', `/marketplace${search}${hash}`);
      return { ...DEFAULT_ROUTE, section: 'market' };
    }
    if (/^#[bc]=/.test(hash)) {
      window.history.replaceState(null, '', `/souls${search}${hash}`);
      return { ...DEFAULT_ROUTE, section: 'tools', toolTab: 'soultree' };
    }
  }
  return fromPath ?? DEFAULT_ROUTE;
}

const INIT = initialRoute();

export default function App() {
  // Public character page (pristonzone.com/char/<slug>) is a standalone page,
  // no topnav/shell — matches its own share-link URL, not a client-side route.
  if (window.location.pathname.startsWith('/char/')) {
    const slug = decodeURIComponent(window.location.pathname.slice('/char/'.length).replace(/\/$/, ''));
    return <CharacterPublicPage slug={slug} />;
  }

  // Read-only clan formation link (pristonzone.com/formacao/<token>): standalone page too.
  if (window.location.pathname.startsWith('/formacao/')) {
    return <ClanSharePage token={decodeURIComponent(window.location.pathname.slice('/formacao/'.length).replace(/\/$/, ''))} />;
  }

  // Personal guide (pristonzone.com/pessoalhadder): standalone page, not in any menu. Only the administrator can edit it.
  if (window.location.pathname.toLowerCase().replace(/\/+$/, '') === '/pessoalhadder') return <PersonalPage />;

  const { t, lang, setLang } = useI18n();
  const { isAdmin, isLoggedIn, user, logout } = useAuth();
  const [route, setRoute] = useState<Route>(INIT);
  const { section, timerTab, toolTab } = route;
  const [openMenu, setOpenMenu] = useState<Section | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false); // the phone-sized menu drawer
  const [accountOpen, setAccountOpen] = useState(false); // the signed-in user's little menu
  const [openAdminAt, setOpenAdminAt] = useState(0);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [visits, setVisits] = useState<number | null>(null); // null = counter unavailable -> hidden
  useEffect(() => {
    let cancelled = false;
    initVisits().then((n) => { if (!cancelled) setVisits(n); });
    return () => { cancelled = true; };
  }, []);

  // Hides the Marketplace nav entry entirely while it's disabled (Admin -> Global) —
  // even for admins; getting back in to re-enable it goes through the 🔒 icon instead.
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    fetchSiteFlag('marketplace').then(setMarketplaceEnabled).catch(() => {});
  }, []);

  const clanAccess = useClanAccess();
  const nav = NAV.filter((n) => n.id !== 'market' || marketplaceEnabled)
    .map((n) => (n.id === 'tools' && n.tabs ? { ...n, tabs: n.tabs.filter((x) => !x.hidden && (x.id !== 'clan' || clanAccess.allowed)) } : n));

  // Every page change also changes the address bar (so F5 and Back stay on the page).
  const navigate = (patch: Partial<Route>) => {
    const next = { ...route, ...patch };
    setRoute(next);
    setMobileOpen(false);
    const path = pathFor(next);
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
      window.history.pushState(null, '', path);
    }
    window.scrollTo({ top: 0 });
  };
  const go = (s: Section) => navigate({ section: s });

  // The Back/Forward buttons: show whatever page the address bar now says.
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname) ?? DEFAULT_ROUTE);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Browser tab title follows the page (and the language).
  useEffect(() => {
    const labelKey = section === 'timers' ? TIMER_TABS.find((x) => x.id === timerTab)?.key
      : section === 'tools' ? TOOL_TABS.find((x) => x.id === toolTab)?.key
      : section === 'home' ? undefined
      : NAV.find((x) => x.id === section)?.key;
    document.title = labelKey ? `${t(labelKey)} — PristonZONE` : 'PristonZONE';
  }, [section, timerTab, toolTab, lang, t]);

  // Navigate to a dropdown item (section + its sub-tab), then close the menu.
  const pickSub = (sectionId: Section, subId: string) => {
    if (sectionId === 'timers') navigate({ section: sectionId, timerTab: subId as TimerTab });
    else if (sectionId === 'tools') navigate({ section: sectionId, toolTab: subId as ToolTab });
    else go(sectionId);
    setOpenMenu(null);
  };
  const currentSub = (sectionId: Section) => (sectionId === 'timers' ? timerTab : sectionId === 'tools' ? toolTab : '');

  // Discreet admin entry (top-right, near the language toggle) instead of a Marketplace tab.
  const openAdmin = () => { setOpenMenu(null); setOpenAdminAt((n) => n + 1); go('market'); };

  // Other parts of the site (e.g. "save build") can ask for the login window.
  useEffect(() => {
    const open = () => setShowAuth(true);
    window.addEventListener(LOGIN_EVENT, open);
    return () => window.removeEventListener(LOGIN_EVENT, open);
  }, []);

  // The account menu closes on outside click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.topnav-account')) setAccountOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [accountOpen]);

  // Escape closes the phone menu too.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

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
          ⚔ <span>PristonZONE</span>
        </button>
        <div className="topnav-tabs">
          {nav.map((n) => n.tabs ? (
            <div key={n.id} className="topnav-item">
              <button
                className={`topnav-tab has-menu ${section === n.id ? 'active' : ''} ${openMenu === n.id ? 'open' : ''}`}
                onClick={() => setOpenMenu(openMenu === n.id ? null : n.id)}
                aria-haspopup="true"
                aria-expanded={openMenu === n.id}
              >
                <span className="topnav-ico">{n.icon}</span> {t(n.key)} <span className="topnav-caret">▾</span>
              </button>
              {openMenu === n.id && (
                <div className="topnav-menu">
                  {n.tabs.map((sub) => (
                    <button
                      key={sub.id}
                      className={`topnav-menu-item ${section === n.id && currentSub(n.id) === sub.id ? 'active' : ''}`}
                      onClick={() => pickSub(n.id, sub.id)}
                    >
                      <span className="topnav-ico">{sub.icon}</span> {t(sub.key)}
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
                <span className="topnav-ico">{n.icon}</span> {t(n.key)}
              </button>
            </div>
          ))}
        </div>
        <span className="spacer" />
        {visits !== null && (
          <div className="topnav-stat" title={t('home.visits', { n: visits.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US') })}>
            <span className="topnav-stat-label">👁 {t('nav.visits')}</span>
            <b className="topnav-stat-num">{visits.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</b>
          </div>
        )}
        {!isLoggedIn ? (
          <button type="button" className="topnav-login" onClick={() => setShowAuth(true)}>
            <span className="topnav-login-ico">👤</span> {t('mk.auth.login')}
          </button>
        ) : (
          <div className="topnav-item topnav-account">
            <button
              type="button"
              className="topnav-login in"
              aria-haspopup="true"
              aria-expanded={accountOpen}
              onClick={() => { setOpenMenu(null); setAccountOpen((v) => !v); }}
            >
              <span className="topnav-login-ico">👤</span> <span className="topnav-login-name">{user?.nick || t('mk.auth.login')}</span> <span className="topnav-caret">▾</span>
            </button>
            {accountOpen && (
              <div className="topnav-menu right">
                <button type="button" className="topnav-menu-item" onClick={() => { setAccountOpen(false); logout(); }}>
                  🚪 {t('mk.auth.logout')}
                </button>
              </div>
            )}
          </div>
        )}
        {isAdmin && (
          <button className="topnav-admin" title={t('nav.admin')} onClick={openAdmin}>
            🔒
          </button>
        )}
        <div className="lang-toggle" title={t('lang.switch')}>
          <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')}>
            🇧🇷 PT
          </button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
            🇬🇧 EN
          </button>
        </div>
        <button
          type="button"
          className={`topnav-burger${mobileOpen ? ' open' : ''}`}
          aria-label={t('nav.menu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => { setOpenMenu(null); setMobileOpen((v) => !v); }}
        >
          <span /><span /><span />
        </button>
        {mobileOpen && (
          <div id="mobile-menu" className="topnav-drawer">
            {nav.map((n) => (
              <div key={n.id} className="topnav-drawer-group">
                {n.tabs ? (
                  <>
                    <span className="topnav-drawer-title"><span className="topnav-ico">{n.icon}</span> {t(n.key)}</span>
                    {n.tabs.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className={`topnav-drawer-item sub${section === n.id && currentSub(n.id) === sub.id ? ' active' : ''}`}
                        onClick={() => pickSub(n.id, sub.id)}
                      >
                        <span className="topnav-ico">{sub.icon}</span> {t(sub.key)}
                      </button>
                    ))}
                  </>
                ) : (
                  <button type="button" className={`topnav-drawer-item${section === n.id ? ' active' : ''}`} onClick={() => go(n.id)}>
                    <span className="topnav-ico">{n.icon}</span> {t(n.key)}
                  </button>
                )}
              </div>
            ))}
            <div className="topnav-drawer-foot">
              <div className="lang-toggle" title={t('lang.switch')}>
                <button className={lang === 'pt' ? 'on' : ''} onClick={() => setLang('pt')}>🇧🇷 PT</button>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>🇬🇧 EN</button>
              </div>
              {!isLoggedIn && (
                <button type="button" className="topnav-drawer-login" onClick={() => { setMobileOpen(false); setShowAuth(true); }}>
                  👤 {t('mk.auth.login')}
                </button>
              )}
              {isAdmin && (
                <button type="button" className="topnav-drawer-login" onClick={() => { setMobileOpen(false); openAdmin(); }}>
                  🔒 {t('nav.admin')}
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {section === 'home' ? (
        <Home />
      ) : section === 'timers' ? (
        timerTab === 'boss' ? <TimeBoss /> : <TimerFury />
      ) : section === 'market' ? (
        <Marketplace openAdminAt={openAdminAt} onAdminOpened={() => setOpenAdminAt(0)} />
      ) : section === 'streamers' ? (
        <Streamers />
      ) : section === 'guides' ? (
        <Guides />
      ) : (
        toolTab === 'soultree' ? <SoulTree />
          : toolTab === 'skilltree' ? <SkillTreeTool />
          : toolTab === 'aging' ? <AgingSystem />
          : toolTab === 'clan' ? <ClanFormation />
          : toolTab === 'quests' ? <QuestTracker />
          : toolTab === 'screenshare' ? <ScreenRooms />
          : toolTab === 'builds' ? <Builds />
          : toolTab === 'mixing' ? <Mixing />
          : toolTab === 'sod' ? <SoD />
          : <Wardrobe onLogin={() => setShowAuth(true)} />
      )}

      <ResetPasswordModal />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
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
