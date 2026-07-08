// Admin CRUD for reputation categories (Hopy, Bargon, ...). Admin-only via RLS.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import type { RepLevel } from '../../lib/market/types';
import {
  BASE_PRESETS, type RepTierDef,
  deleteTier, fetchRepTiers, loadRepTiers, newTierKey, saveTier,
} from '../../lib/market/repTiers';

const BASES: RepLevel[] = ['bronze', 'silver', 'gold', 'diamond', 'legendary'];

export function RepTiersAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<RepTierDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => fetchRepTiers().then(setRows).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  const addNew = async () => {
    const sort = rows.length ? Math.max(...rows.map((r) => r.sort)) + 1 : 0;
    await saveTier({ key: newTierKey(), label: t('mk.admin.tier.new'), base: 'bronze', icon: '🥉', color: '#cd7f32', min: 0, sort }).catch(() => {});
    await loadRepTiers();
    reload();
  };

  return (
    <div className="mk-tiers-admin">
      <p className="mk-muted">{t('mk.admin.tier.hint')}</p>
      <div className="mk-tiers-head">
        <span></span><span>{t('mk.admin.tier.label')}</span><span>{t('mk.admin.tier.base')}</span>
        <span>{t('mk.admin.tier.color')}</span><span>{t('mk.admin.tier.min')}</span><span>{t('mk.admin.strm.order')}</span><span></span>
      </div>
      {loading && <p className="mk-muted">⏳ {t('mk.loading')}</p>}
      {rows.map((r) => <TierRow key={r.key} tier={r} onChange={() => { loadRepTiers(); reload(); }} />)}
      <button className="mk-btn primary mk-tiers-add" onClick={addNew}>➕ {t('mk.admin.tier.add')}</button>
    </div>
  );
}

function TierRow({ tier, onChange }: { tier: RepTierDef; onChange: () => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<RepTierDef>(tier);
  const [busy, setBusy] = useState(false);
  const dirty = d.label !== tier.label || d.base !== tier.base || d.icon !== tier.icon || d.color !== tier.color || d.min !== tier.min || d.sort !== tier.sort;

  const pickBase = (base: RepLevel) => setD({ ...d, base, icon: BASE_PRESETS[base].icon, color: BASE_PRESETS[base].color });
  const save = async () => { setBusy(true); try { await saveTier(d); onChange(); } finally { setBusy(false); } };
  const remove = async () => { await deleteTier(tier.key).catch(() => {}); onChange(); };

  return (
    <div className="mk-tier-row">
      <span className="mk-tier-badge" style={{ color: d.color, borderColor: d.color }}>{d.icon}</span>
      <input className="mk-tier-icon" value={d.icon} maxLength={4} onChange={(e) => setD({ ...d, icon: e.target.value })} title={t('mk.admin.tier.icon')} />
      <input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
      <select value={d.base} onChange={(e) => pickBase(e.target.value as RepLevel)}>
        {BASES.map((b) => <option key={b} value={b}>{t(`mk.admin.tier.base.${b}`)}</option>)}
      </select>
      <input type="color" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
      <input className="mk-tier-num" type="number" min={0} value={d.min} onChange={(e) => setD({ ...d, min: Number(e.target.value) || 0 })} title={t('mk.admin.tier.min.hint')} />
      <input className="mk-tier-num" type="number" value={d.sort} onChange={(e) => setD({ ...d, sort: Number(e.target.value) || 0 })} />
      <span className="mk-tier-acts">
        <button className="mk-btn sm primary" onClick={save} disabled={!dirty || busy}>{busy ? '⏳' : t('mk.edit.save')}</button>
        <button className="mk-btn sm danger" onClick={remove}>{t('mk.delete')}</button>
      </span>
    </div>
  );
}
