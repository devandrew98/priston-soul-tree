import { useRef, useState } from 'react';
import { CATEGORIES, RARITIES } from '../../lib/market/data';
import type { Currency, Listing, Rarity } from '../../lib/market/types';
import { useI18n } from '../../lib/i18n';
import { useAuth, useContributors, useMyListings } from './store';
import { LoginPrompt } from './LoginPrompt';

const CURRENCIES: Currency[] = ['gold', 'coins'];

export function CreateListing({ onDone, onLogin }: { onDone: () => void; onLogin: () => void }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const { isContributor } = useContributors();
  const { addListing } = useMyListings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [subcategory, setSubcategory] = useState(CATEGORIES[0].subs[0]);
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [itemLevel, setItemLevel] = useState(90);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<number>(500_000_000);
  const [currency, setCurrency] = useState<Currency>('gold');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string>('');
  const [highlighted, setHighlighted] = useState(false);

  const canContribute = isContributor(userId);
  const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!userId || !image) return;
    const listing: Listing = {
      id: `my-${Date.now()}`,
      name: name.trim() || t('mk.create.untitled'),
      itemLevel, icon: cat.icon, image, category, subcategory, rarity,
      tier: 0, sockets: 0, classReq: 'Todas', stats: [],
      quantity, price, currency, description: description.trim(),
      status: 'available', highlighted: canContribute && highlighted, sellerId: userId, views: 0, createdAt: Date.now(),
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
        {/* image (required) */}
        <div className="mk-field span2">
          <span>{t('mk.create.image')} *</span>
          <div
            className={`mk-imgdrop ${image ? 'has' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
          >
            {image ? (
              <>
                <img src={image} alt="preview" className="mk-imgdrop-preview" />
                <button className="mk-imgdrop-remove" onClick={(e) => { e.stopPropagation(); setImage(''); }}>✕</button>
              </>
            ) : (
              <span className="mk-imgdrop-hint">🖼️ {t('mk.create.imagehint')}</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>

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
          <span>{t('mk.itemlevel')}</span>
          <input type="number" min={1} value={itemLevel} onChange={(e) => setItemLevel(clamp(e.target.value, 1, 400))} />
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

        <label className="mk-field span2">
          <span>{t('mk.description')}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t('mk.create.descph')} />
        </label>

        {canContribute && (
          <label className="mk-field span2 mk-check">
            <input type="checkbox" checked={highlighted} onChange={(e) => setHighlighted(e.target.checked)} />
            <span>⭐ {t('mk.create.highlight')} <em className="mk-muted">({t('mk.contrib')})</em></span>
          </label>
        )}

        <div className="mk-field span2 mk-form-actions">
          <button className="mk-btn primary" onClick={submit} disabled={!image}>✓ {t('mk.create.publish')}</button>
          <button className="mk-btn" onClick={onDone}>{t('mk.cancel')}</button>
        </div>
        {!image && <p className="mk-muted mk-create-imgreq">⚠ {t('mk.create.imagereq')}</p>}
      </div>
    </div>
  );
}

function clamp(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}
