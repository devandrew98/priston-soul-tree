import { useMemo, useState } from 'react';
import { LISTINGS, LISTING_BY_ID, REPORTS, SELLERS, SELLER_BY_ID } from '../../lib/market/data';
import { useI18n } from '../../lib/i18n';
import { useAdmin, useMyListings } from './store';
import { Avatar, PriceTag, Since, StatusPill } from './parts';

type Section = 'listings' | 'users' | 'reports' | 'global' | 'logs';

const SECTIONS: { id: Section; icon: string; key: string }[] = [
  { id: 'listings', icon: '📦', key: 'mk.admin.listings' },
  { id: 'users', icon: '👤', key: 'mk.admin.users' },
  { id: 'reports', icon: '⚑', key: 'mk.admin.reports' },
  { id: 'global', icon: '📢', key: 'mk.admin.global' },
  { id: 'logs', icon: '📜', key: 'mk.admin.logs' },
];

export function Admin({ onOpen, onSeller }: { onOpen: (id: string) => void; onSeller: (id: string) => void }) {
  const { t } = useI18n();
  const [sec, setSec] = useState<Section>('listings');
  const admin = useAdmin();
  const { myListings } = useMyListings();
  const [q, setQ] = useState('');
  const [globalText, setGlobalText] = useState('');

  const allListings = useMemo(() => [...myListings, ...LISTINGS], [myListings]);
  const filtered = allListings.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()));
  const openReports = REPORTS.filter((r) => !admin.resolvedReports.includes(r.id));

  return (
    <div className="mk-admin">
      <div className="mk-admin-head">
        <h1 className="mk-h1">🛡️ {t('mk.admin.title')}</h1>
        <span className="mk-admin-badge">ADMIN</span>
      </div>

      <div className="mk-dash-tabs">
        {SECTIONS.map((s) => (
          <button key={s.id} className={sec === s.id ? 'on' : ''} onClick={() => setSec(s.id)}>
            {s.icon} {t(s.key)}
            {s.id === 'reports' && openReports.length > 0 && <span className="mk-chat-badge sm">{openReports.length}</span>}
          </button>
        ))}
      </div>

      {/* LISTINGS */}
      {sec === 'listings' && (
        <>
          <input className="mk-admin-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mk.admin.searchitem')} />
          <div className="mk-admin-table">
            {filtered.map((l) => {
              const removed = admin.adminRemoved.includes(l.id);
              const featured = admin.adminFeatured[l.id] ?? l.highlighted;
              return (
                <div key={l.id} className={`mk-admin-row ${removed ? 'removed' : ''}`}>
                  <span className="mk-icon sm" style={{ ['--rar' as string]: 'var(--gold)' }}>{l.image ? <img src={l.image} alt="" className="mk-icon-img" /> : l.icon}</span>
                  <button className="mk-admin-name" onClick={() => onOpen(l.id)}>{l.name}</button>
                  <button className="mk-admin-sub" onClick={() => onSeller(l.sellerId)}>{SELLER_BY_ID[l.sellerId]?.nick}</button>
                  <PriceTag value={l.price} currency={l.currency} />
                  <StatusPill status={l.status} />
                  <span className="mk-admin-acts">
                    <button className={`mk-btn sm ${featured ? 'active' : ''}`} onClick={() => admin.toggleFeatured(l.id, l.name, !featured)}>★</button>
                    {removed ? (
                      <button className="mk-btn sm" onClick={() => admin.restoreListing(l.id)}>{t('mk.admin.restore')}</button>
                    ) : (
                      <button className="mk-btn sm danger" onClick={() => admin.removeListing(l.id, l.name)}>{t('mk.delete')}</button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* USERS */}
      {sec === 'users' && (
        <div className="mk-admin-table">
          {SELLERS.map((u) => {
            const banned = admin.bannedUsers.includes(u.id);
            const suspended = admin.suspendedUsers.includes(u.id);
            const contributor = admin.contributors.includes(u.id);
            return (
              <div key={u.id} className={`mk-admin-row ${banned ? 'removed' : ''}`}>
                <Avatar value={u.avatar} />
                <button className="mk-admin-name" onClick={() => onSeller(u.id)}>{u.nick}</button>
                <span className="mk-admin-sub">{u.className} · {t('mk.lvl')} {u.level}</span>
                <span className="mk-muted">{u.itemsSold} {t('mk.itemssold')}</span>
                <span className="mk-admin-flags">
                  {contributor && <span className="mk-flag contrib">⭐ {t('mk.contrib')}</span>}
                  {u.reports > 0 && <span className={`mk-flag ${u.reports >= 3 ? 'bad' : ''}`}>⚑ {u.reports}</span>}
                  {banned && <span className="mk-flag bad">{t('mk.admin.banned')}</span>}
                  {suspended && <span className="mk-flag warn">{t('mk.admin.suspended')}</span>}
                </span>
                <span className="mk-admin-acts">
                  <button className={`mk-btn sm ${contributor ? 'active' : ''}`} onClick={() => admin.toggleContributor(u.id, u.nick)} title={t('mk.contrib.hint')}>⭐ {t('mk.contrib')}</button>
                  <button className={`mk-btn sm ${suspended ? 'active' : ''}`} onClick={() => admin.toggleSuspend(u.id, u.nick)}>{suspended ? t('mk.admin.reactivate') : t('mk.admin.suspend')}</button>
                  <button className={`mk-btn sm ${banned ? 'active' : 'danger'}`} onClick={() => admin.toggleBan(u.id, u.nick)}>{banned ? t('mk.admin.unban') : t('mk.admin.ban')}</button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* REPORTS */}
      {sec === 'reports' && (
        <div className="mk-admin-reports">
          {openReports.length === 0 && <p className="mk-muted">{t('mk.admin.noreports')}</p>}
          {openReports.map((r) => {
            const targetName = r.targetType === 'item' ? LISTING_BY_ID[r.targetId]?.name : SELLER_BY_ID[r.targetId]?.nick;
            return (
              <div key={r.id} className="mk-report">
                <div className="mk-report-head">
                  <span className="mk-flag bad">{t(`mk.report.reason.${r.reason}`)}</span>
                  <b>{r.targetType === 'item' ? '📦' : '👤'} {targetName ?? r.targetId}</b>
                  <span className="mk-muted">· {t('mk.admin.by')} {r.reporter} · <Since at={r.at} /></span>
                </div>
                <p className="mk-report-note">{r.note}</p>
                <div className="mk-report-acts">
                  <button className="mk-btn sm" onClick={() => (r.targetType === 'item' ? onOpen(r.targetId) : onSeller(r.targetId))}>{t('mk.admin.view')}</button>
                  <button className="mk-btn sm primary" onClick={() => admin.resolveReport(r.id, t('mk.admin.actioned'))}>{t('mk.admin.resolve')}</button>
                  <button className="mk-btn sm" onClick={() => admin.resolveReport(r.id, t('mk.admin.dismissed'))}>{t('mk.admin.dismiss')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GLOBAL NOTIFICATION */}
      {sec === 'global' && (
        <div className="mk-admin-global">
          <p className="mk-muted">{t('mk.admin.globalhint')}</p>
          <textarea value={globalText} onChange={(e) => setGlobalText(e.target.value)} rows={3} placeholder={t('mk.admin.globalph')} />
          <button className="mk-btn primary" disabled={!globalText.trim()} onClick={() => { admin.sendGlobal(globalText.trim()); setGlobalText(''); }}>📢 {t('mk.admin.send')}</button>
        </div>
      )}

      {/* LOGS */}
      {sec === 'logs' && (
        <div className="mk-admin-logs">
          {admin.logs.length === 0 && <p className="mk-muted">{t('mk.admin.nologs')}</p>}
          {admin.logs.map((log) => (
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
