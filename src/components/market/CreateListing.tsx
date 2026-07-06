import { useMemo, useState } from 'react';
import { CATEGORIES, CLASSES, RARITIES } from '../../lib/market/data';
import { fmtPrice, suggestPrice } from '../../lib/market/helpers';
import type { Currency, Listing, Rarity, Stat } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { useAuth, useMyListings } from './store';
import { LoginPrompt } from './LoginPrompt';

const CURRENCIES: Currency[] = ['gold', 'silver', 'premium'];

export function CreateListing({ onDone, onLogin }: { onDone: () => void; onLogin: () => void }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { addListing } = useMyListings();

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [subcategory, setSubcategory] = useState(CATEGORIES[0].subs[0]);
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [tier, setTier] = useState(3);
  const [itemLevel, setItemLevel] = useState(90);
  const [sockets, setSockets] = useState(0);
  const [classReq, setClassReq] = useState('Todas');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<number>(500_000_000);
  const [currency, setCurrency] = useState<Currency>('gold');
  const [description, setDescription] = useState('');
  const [highlighted, setHighlighted] = useState(false);
  const [stats, setStats] = useState<Stat[]>([{ label: '', value: '' }]);

  const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  const suggested = useMemo(() => {
    const synthetic: Listing = {
      id: 'draft', name, itemLevel, icon: cat.icon, category, subcategory, rarity, tier, sockets,
      classReq, stats, quantity, price, currency, description, status: 'available', highlighted,
      sellerId: userId ?? 'draft', views: 0, createdAt: Date.now(),
    };
    return suggestPrice(synthetic);
  }, [name, itemLevel, category, subcategory, rarity, tier, sockets, classReq, stats, quantity, price, currency, description, highlighted, cat.icon]);

  const setStat = (i: number, k: keyof Stat, v: string) =>
    setStats((prev) => prev.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const addStat = () => setStats((prev) => [...prev, { label: '', value: '' }]);
  const removeStat = (i: number) => setStats((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!userId) return;
    const listing: Listing = {
      id: `my-${Date.now()}`,
      name: name.trim() || t('mk.create.untitled'),
      itemLevel, icon: cat.icon, category, subcategory, rarity, tier, sockets, classReq,
      stats: stats.filter((s) => s.label.trim()),
      quantity, price, currency, description: description.trim(),
      status: 'available', highlighted, sellerId: userId, views: 0, createdAt: Date.now(),
    };
    addListing(listing);
    onDone();
  };

  if (!userId) return <LoginPrompt onLogin={onLogin} />;

  return (
    <div className="mk-create">
      <button className="mk-back" onClick={onDone}>← {t('mk.back')}</button>
      <h1 className="mk-h1">📦 {t('mk.create.title')}</h1>

      <div className="mk-form">
        <label className="mk-field span2">
          <span>{t('mk.create.name')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Murky Sword +25" />
        </label>

        <label className="mk-field">
          <span>{t('mk.category')}</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); const c = CATEGORIES.find((x) => x.id === e.target.value); setSubcategory(c?.subs[0] ?? ''); }}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {t(`mk.cat.${c.id}`)}</option>)}
          </select>
        </label>
        <label className="mk-field">
          <span>{t('mk.subcategory')}</span>
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            {cat.subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="mk-field">
          <span>{t('mk.rarity.label')}</span>
          <select value={rarity} onChange={(e) => setRarity(e.target.value as Rarity)}>
            {RARITIES.map((r) => <option key={r} value={r}>{t(`mk.rarity.${r}`)}</option>)}
          </select>
        </label>
        <label className="mk-field">
          <span>Tier</span>
          <input type="number" min={1} max={5} value={tier} onChange={(e) => setTier(clamp(e.target.value, 1, 5))} />
        </label>
        <label className="mk-field">
          <span>{t('mk.itemlevel')}</span>
          <input type="number" min={1} value={itemLevel} onChange={(e) => setItemLevel(clamp(e.target.value, 1, 400))} />
        </label>
        <label className="mk-field">
          <span>{t('mk.sockets')}</span>
          <input type="number" min={0} max={5} value={sockets} onChange={(e) => setSockets(clamp(e.target.value, 0, 5))} />
        </label>

        <label className="mk-field">
          <span>{t('mk.class')}</span>
          <select value={classReq} onChange={(e) => setClassReq(e.target.value)}>
            <option value="Todas">Todas</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="mk-field">
          <span>{t('mk.quantity')}</span>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(clamp(e.target.value, 1, 9999))} />
        </label>

        <label className="mk-field">
          <span>{t('mk.price')}</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className="mk-field">
          <span>{t('mk.currency')}</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{t(`mk.currency.${c}`)}</option>)}
          </select>
        </label>

        <div className="mk-field span2 mk-suggest">
          💡 {t('mk.create.suggest')}: <b>{fmtPrice(suggested, currency)}</b>
          <button type="button" className="mk-btn sm" onClick={() => setPrice(suggested)}>{t('mk.create.usesuggest')}</button>
        </div>

        <div className="mk-field span2">
          <span>{t('mk.attributes')}</span>
          <div className="mk-statrows">
            {stats.map((s, i) => (
              <div key={i} className="mk-statrow">
                <input value={s.label} onChange={(e) => setStat(i, 'label', e.target.value)} placeholder={t('mk.create.statlabel')} />
                <input value={s.value} onChange={(e) => setStat(i, 'value', e.target.value)} placeholder={t('mk.create.statvalue')} />
                <button type="button" className="mk-btn sm danger" onClick={() => removeStat(i)}>✕</button>
              </div>
            ))}
            <button type="button" className="mk-btn sm" onClick={addStat}>+ {t('mk.create.addstat')}</button>
          </div>
        </div>

        <label className="mk-field span2">
          <span>{t('mk.description')}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t('mk.create.descph')} />
        </label>

        <label className="mk-field span2 mk-check">
          <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} />
          <span>★ {t('mk.create.highlight')}</span>
        </label>

        <div className="mk-field span2 mk-form-actions">
          <button className="mk-btn primary" onClick={submit}>✓ {t('mk.create.publish')}</button>
          <button className="mk-btn" onClick={onDone}>{t('mk.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function clamp(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
