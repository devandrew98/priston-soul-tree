// Admin: whole-Marketplace kill switch — lets the site owner temporarily hide
// the Marketplace from the public without losing any data, and turn it back
// on later from here.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { fetchSiteFlag, setSiteFlag } from '../../lib/market/siteSettings';

export function MarketplaceToggle() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetchSiteFlag('marketplace').then(setEnabled).catch(() => {}).finally(() => setLoading(false)); }, []);

  const toggle = async () => {
    const next = !enabled;
    setBusy(true);
    try {
      await setSiteFlag('marketplace', next);
      setEnabled(next);
    } catch { /* keep previous state on failure */ }
    finally { setBusy(false); }
  };

  return (
    <div className="mk-mktoggle">
      <div className="mk-mktoggle-info">
        <b>🏰 {t('mk.admin.mktoggle.title')}</b>
        <p className="mk-muted">{t('mk.admin.mktoggle.hint')}</p>
        {!loading && (
          <span className={`mk-mktoggle-status ${enabled ? 'on' : 'off'}`}>
            {enabled ? `✅ ${t('mk.admin.mktoggle.status.on')}` : `⛔ ${t('mk.admin.mktoggle.status.off')}`}
          </span>
        )}
      </div>
      {loading ? (
        <span className="mk-muted">⏳ {t('mk.loading')}</span>
      ) : (
        <button className={`mk-btn ${enabled ? 'danger' : 'primary'}`} onClick={toggle} disabled={busy}>
          {enabled ? `⛔ ${t('mk.admin.mktoggle.off')}` : `✅ ${t('mk.admin.mktoggle.on')}`}
        </button>
      )}
    </div>
  );
}
