import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useRepTiers } from '../../lib/market/repTiers';
import { useAdminModel } from './useAdminModel';
import { useAuth } from './store';
import { StreamersAdmin } from './StreamersAdmin';
import { RepTiersAdmin } from './RepTiersAdmin';
import { NewsAdmin } from './NewsAdmin';
import { MarketCategoriesAdmin } from './MarketCategoriesAdmin';
import { GuidesAdmin } from './GuidesAdmin';
import { DownloadAdmin } from './DownloadAdmin';
import { QuestManagerAdmin } from '../quest/QuestManagerAdmin';
import { ExpTableAdmin } from '../quest/ExpTableAdmin';
import { ExpBuffAdmin } from '../quest/ExpBuffAdmin';
import { ImageOptimizer } from './ImageOptimizer';
import { SiteStatsAdmin } from './SiteStatsAdmin';
import { MarketplaceToggle } from './MarketplaceToggle';
import type { ListingKind } from '../../lib/market/types';
import { Avatar, KindTag, PriceTag, Since, StatusPill } from './parts';
import { Loading } from '../Loading';

type Section = 'listings' | 'users' | 'tiers' | 'itemcats' | 'reports' | 'streamers' | 'news' | 'guides' | 'download' | 'questmgr' | 'exptable' | 'expbuffs' | 'imgopt' | 'global' | 'logs' | 'sitestats';

const SECTIONS: { id: Section; icon: string; key: string }[] = [
  { id: 'sitestats', icon: '📊', key: 'mk.admin.sitestats' },
  { id: 'listings', icon: '📦', key: 'mk.admin.listings' },
  { id: 'users', icon: '👤', key: 'mk.admin.users' },
  { id: 'tiers', icon: '🏅', key: 'mk.admin.tiers' },
  { id: 'itemcats', icon: '🗂', key: 'mk.admin.itemcats' },
  { id: 'reports', icon: '⚑', key: 'mk.admin.reports' },
  { id: 'streamers', icon: '📺', key: 'mk.admin.streamers' },
  { id: 'news', icon: '📰', key: 'mk.admin.news' },
  { id: 'guides', icon: '🎬', key: 'mk.admin.guides' },
  { id: 'download', icon: '📥', key: 'mk.admin.download' },
  { id: 'questmgr', icon: '📜', key: 'mk.admin.questmgr' },
  { id: 'exptable', icon: '📈', key: 'mk.admin.exptable' },
  { id: 'expbuffs', icon: '✨', key: 'mk.admin.expbuffs' },
  { id: 'imgopt', icon: '🗜', key: 'mk.admin.imgopt' },
  { id: 'global', icon: '📢', key: 'mk.admin.global' },
  { id: 'logs', icon: '📜', key: 'mk.admin.logs' },
];

// The panel opens on a home of big buttons, one per function, grouped by area; picking one opens it (no sub-tabs).
const GROUPS: { id: string; icon: string; key: string; sections: Section[] }[] = [
  { id: 'overview', icon: '📊', key: 'mk.admin.grp.overview', sections: ['sitestats'] },
  { id: 'market', icon: '🏰', key: 'mk.admin.grp.market', sections: ['listings', 'users', 'reports', 'tiers', 'itemcats', 'global', 'logs'] },
  { id: 'site', icon: '🌐', key: 'mk.admin.grp.site', sections: ['streamers', 'news', 'guides', 'download'] },
  { id: 'quests', icon: '📜', key: 'mk.admin.grp.quests', sections: ['questmgr', 'exptable', 'expbuffs'] },
  { id: 'tools', icon: '🧰', key: 'mk.admin.grp.tools', sections: ['imgopt'] },
];

export function Admin({ onOpen, onSeller, onBack }: { onOpen: (id: string) => void; onSeller: (id: string) => void; onBack?: () => void }) {
  const { t } = useI18n();
  const m = useAdminModel();
  const { userId: myId } = useAuth();
  const tiers = useRepTiers();
  const [sec, setSec] = useState<Section | null>(null); // null = the home with all the functions
  const current = SECTIONS.find((x) => x.id === sec);
  const [q, setQ] = useState('');
  const [uq, setUq] = useState('');
  const [uFilter, setUFilter] = useState<'all' | 'banned' | 'suspended' | 'contributors' | 'reported'>('all');
  const [globalText, setGlobalText] = useState('');
  // Account deletion asks for confirmation inside the row (window.confirm is not reliable in every browser).
  const [delId, setDelId] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');
  const nickKey = (n: string) => n.trim().toLowerCase();
  const nickCount = new Map<string, number>();
  for (const u of m.users) nickCount.set(nickKey(u.nick), (nickCount.get(nickKey(u.nick)) ?? 0) + 1);
  const deleteAccount = (u: { id: string }) => {
    setDelBusy(true); setDelErr('');
    m.deleteUser(u.id)
      .then(() => setDelId(null))
      .catch((e: unknown) => setDelErr(t('mk.admin.deleteacc.fail', { err: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) })))
      .finally(() => setDelBusy(false));
  };

  const filtered = m.listings.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  const usersFiltered = m.users.filter((u) =>
    u.nick.toLowerCase().includes(uq.toLowerCase()) &&
    (uFilter === 'all' || (uFilter === 'banned' && u.banned) || (uFilter === 'suspended' && u.suspended) ||
      (uFilter === 'contributors' && u.contributor) || (uFilter === 'reported' && u.reports > 0)));
  const USER_FILTERS: typeof uFilter[] = ['all', 'reported', 'contributors', 'suspended', 'banned'];
  const reasonLabel = (r: string) => { const k = `mk.report.reason.${r}`; const v = t(k); return v === k ? r : v; };
  const banUser = (u: { id: string; nick: string; banned: boolean }) => {
    if (u.banned) { m.toggleBan(u.id, u.nick, false); return; }
    const reason = window.prompt(t('mk.admin.banreason.ask'), '') ?? '';
    m.toggleBan(u.id, u.nick, true, reason);
  };

  return (
    <div className="mk-admin">
      <div className="mk-admin-head">
        <h1 className="mk-h1">🛡 {t('mk.admin.title')}</h1>
        <span className="mk-admin-badge">ADMIN</span>
        {m.loading && <Loading inline />}
        {sec !== null
          ? <button type="button" className="mk-btn sm mk-admin-back" onClick={() => setSec(null)}>← {t('mk.admin.home')}</button>
          : onBack && <button type="button" className="mk-btn sm mk-admin-back" onClick={onBack}>← {t('mk.admin.back')}</button>}
      </div>

      {sec === null && (
        <div className="mk-admin-home">
          {GROUPS.map((g) => (
            <section key={g.id} className="mk-admin-area">
              <h2 className="mk-admin-area-title">{g.icon} {t(g.key)}</h2>
              <div className="mk-admin-tiles">
                {g.sections.map((id) => SECTIONS.find((x) => x.id === id)!).map((x) => (
                  <button key={x.id} type="button" className="mk-admin-tile" onClick={() => { setSec(x.id); window.scrollTo({ top: 0 }); }}>
                    <span className="mk-admin-tile-ico">{x.icon}</span>
                    <b>{t(x.key)}</b>
                    {x.id === 'reports' && m.reports.length > 0 && <span className="mk-chat-badge sm">{m.reports.length}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {current && <h2 className="mk-admin-sec-title">{current.icon} {t(current.key)}</h2>}

      {/* LISTINGS */}
      {sec === 'listings' && (
        <>
          <input className="mk-admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mk.admin.searchitem')} />
          <div className="mk-admin-table">
            {filtered.map((l) => (
              <div key={l.id} className={`mk-admin-row ${l.removed ? 'removed' : ''}`}>
                <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{l.image ? <img src={l.image} alt="" className="mk-icon-img" /> : l.icon}</span>
                <KindTag kind={l.kind as ListingKind} />
                <button className="mk-admin-name" onClick={() => onOpen(l.id)}>{l.name}</button>
                <button className="mk-admin-sub" onClick={() => onSeller(l.sellerId)}>{l.sellerNick}</button>
                <PriceTag value={l.price} currency={l.currency as 'gold' | 'coins'} />
                <StatusPill status={l.status as 'available' | 'reserved' | 'sold'} />
                <span className="mk-admin-acts">
                  <button className={`mk-btn sm ${l.featured ? 'active' : ''}`} onClick={() => m.toggleFeatured(l.id, l.name, !l.featured)}>★</button>
                  {l.removed ? (
                    <button className="mk-btn sm" onClick={() => m.restoreListing(l.id, l.name)}>{t('mk.admin.restore')}</button>
                  ) : (
                    <button className="mk-btn sm danger" onClick={() => m.removeListing(l.id, l.name)}>{t('mk.delete')}</button>
                  )}
                </span>
              </div>
            ))}
            {!m.loading && filtered.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
          </div>
        </>
      )}

      {/* USERS */}
      {sec === 'users' && (
        <>
          <input className="mk-admin-search" value={uq} onChange={(e) => setUq(e.target.value)} placeholder={t('mk.admin.usersearch')} />
          <div className="mk-admin-userfilters">
            {USER_FILTERS.map((f) => (
              <button key={f} className={uFilter === f ? 'on' : ''} onClick={() => setUFilter(f)}>{t(`mk.admin.ufilter.${f}`)}</button>
            ))}
            <span className="mk-muted mk-admin-usercount">{usersFiltered.length}</span>
          </div>
          <div className="mk-admin-table">
          {usersFiltered.map((u) => (
            <div key={u.id} className={`mk-admin-row ${u.banned ? 'removed' : ''}`}>
              <Avatar value={u.avatar} />
              <span className="mk-admin-userid">
                <button className="mk-admin-name" onClick={() => onSeller(u.id)}>{u.nick}</button>
                <span className="mk-admin-sub">{u.className} · {t('mk.lvl')} {u.level} · {t('mk.member')} <Since at={u.createdAt} /> · {t('mk.lastseen')} <Since at={u.lastSeen} /></span>
                {u.banned && u.banReason && <span className="mk-admin-banreason">🚫 {u.banReason}</span>}
              </span>
              <span className="mk-admin-flags">
                {(nickCount.get(nickKey(u.nick)) ?? 0) > 1 && <span className="mk-flag bad">⚠ {t('mk.admin.dupnick')}</span>}
                {u.contributor && <span className="mk-flag contrib">⭐ {t('mk.contrib')}</span>}
                {u.reports > 0 && <span className={`mk-flag ${u.reports >= 3 ? 'bad' : ''}`}>⚑ {u.reports}</span>}
                {u.banned && <span className="mk-flag bad">{t('mk.admin.banned')}</span>}
                {u.suspended && <span className="mk-flag warn">{t('mk.admin.suspended')}</span>}
              </span>
              <span className="mk-admin-acts">
                <select
                  className="mk-admin-tiersel"
                  value={u.repTierOverride ?? ''}
                  title={t('mk.admin.tier.assign')}
                  onChange={(e) => { const key = e.target.value || null; const lbl = key ? (tiers.find((tt) => tt.key === key)?.label ?? key) : t('mk.admin.tier.auto'); m.setMemberTier(u.id, u.nick, key, lbl); }}
                >
                  <option value="">{t('mk.admin.tier.auto')}</option>
                  {tiers.map((tt) => <option key={tt.key} value={tt.key}>{tt.icon} {tt.label}</option>)}
                </select>
                <button className={`mk-btn sm ${u.contributor ? 'active' : ''}`} onClick={() => m.toggleContributor(u.id, u.nick, !u.contributor)} title={t('mk.contrib.hint')}>⭐ {t('mk.contrib')}</button>
                <button className={`mk-btn sm ${u.suspended ? 'active' : ''}`} onClick={() => m.toggleSuspend(u.id, u.nick, !u.suspended)}>{u.suspended ? t('mk.admin.reactivate') : t('mk.admin.suspend')}</button>
                <button className={`mk-btn sm ${u.banned ? 'active' : 'danger'}`} onClick={() => banUser(u)}>{u.banned ? t('mk.admin.unban') : t('mk.admin.ban')}</button>
                {!u.isAdmin && u.id !== myId && (
                  <button className="mk-btn sm danger" onClick={() => { setDelId(u.id); setDelErr(''); }}>🗑 {t('mk.admin.deleteacc')}</button>
                )}
              </span>
              {delId === u.id && (
                <div className="mk-admin-delask" role="alert">
                  <span>{t('mk.admin.deleteacc.ask', { nick: u.nick })}</span>
                  <button className="mk-btn sm danger" disabled={delBusy} onClick={() => deleteAccount(u)}>{t('mk.admin.deleteacc.yes')}</button>
                  <button className="mk-btn sm" disabled={delBusy} onClick={() => setDelId(null)}>{t('mk.admin.deleteacc.no')}</button>
                  {delErr && <span className="mk-admin-delerr">{delErr}</span>}
                </div>
              )}
            </div>
          ))}
          {!m.loading && usersFiltered.length === 0 && <p className="mk-muted">{t('mk.dash.empty')}</p>}
          </div>
        </>
      )}

      {/* REPORTS */}
      {sec === 'reports' && (
        <div className="mk-admin-reports">
          {!m.loading && m.reports.length === 0 && <p className="mk-muted">{t('mk.admin.noreports')}</p>}
          {m.reports.map((r) => (
            <div key={r.id} className="mk-report">
              <div className="mk-report-head">
                <span className="mk-flag bad">{reasonLabel(r.reason)}</span>
                <b>{r.targetType === 'item' ? '📦' : '👤'} {r.targetName}</b>
                <span className="mk-muted">· {t('mk.admin.by')} {r.reporterNick} · <Since at={r.at} /></span>
              </div>
              {r.note && <p className="mk-report-note">{r.note}</p>}
              <div className="mk-report-acts">
                <button className="mk-btn sm" onClick={() => (r.targetType === 'item' ? onOpen(r.targetId) : onSeller(r.targetId))}>{t('mk.admin.view')}</button>
                <button className="mk-btn sm primary" onClick={() => m.resolveReport(r.id, 'resolved', t('mk.admin.actioned'))}>{t('mk.admin.resolve')}</button>
                <button className="mk-btn sm" onClick={() => m.resolveReport(r.id, 'dismissed', t('mk.admin.dismissed'))}>{t('mk.admin.dismiss')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CATEGORIES (reputation tiers) */}
      {sec === 'tiers' && <RepTiersAdmin />}

      {/* ITEM CATEGORIES */}
      {sec === 'itemcats' && <MarketCategoriesAdmin />}

      {/* STREAMERS */}
      {sec === 'streamers' && <StreamersAdmin />}

      {/* NEWS / EVENTS */}
      {sec === 'news' && <NewsAdmin />}

      {/* SITE STATISTICS */}
      {sec === 'sitestats' && <SiteStatsAdmin />}

      {/* GUIDES */}
      {sec === 'guides' && <GuidesAdmin />}

      {/* APP DOWNLOAD */}
      {sec === 'download' && <DownloadAdmin />}

      {/* QUEST TRACKER: quests, EXP table, EXP bonuses */}
      {sec === 'questmgr' && <QuestManagerAdmin />}
      {sec === 'exptable' && <ExpTableAdmin />}
      {sec === 'expbuffs' && <ExpBuffAdmin />}

      {/* IMAGE OPTIMIZER */}
      {sec === 'imgopt' && <ImageOptimizer />}

      {/* GLOBAL NOTIFICATION */}
      {sec === 'global' && (
        <div className="mk-admin-global">
          <MarketplaceToggle />
          <p className="mk-muted">{t('mk.admin.globalhint')}</p>
          <textarea value={globalText} onChange={(e) => setGlobalText(e.target.value)} rows={3} placeholder={t('mk.admin.globalph')} />
          <button className="mk-btn primary" disabled={!globalText.trim()} onClick={() => { m.sendGlobal(globalText.trim()); setGlobalText(''); }}>📢 {t('mk.admin.send')}</button>
        </div>
      )}

      {/* LOGS */}
      {sec === 'logs' && (
        <div className="mk-admin-logs">
          {!m.loading && m.logs.length === 0 && <p className="mk-muted">{t('mk.admin.nologs')}</p>}
          {m.logs.map((log) => (
            <div key={log.id} className="mk-log">
              <span className="mk-log-time"><Since at={log.at} /></span>
              <span>{log.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
