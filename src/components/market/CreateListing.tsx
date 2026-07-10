import { useEffect, useRef, useState } from 'react';
import { RARITIES } from '../../lib/market/data';
import { useCategories } from '../../lib/market/marketCategories';
import type { Currency, Listing, Rarity, ShopLocation } from '../../lib/market/types';
import { BACKEND_ENABLED } from '../../lib/market/supabase';
import { limitErrorKey } from '../../lib/market/helpers';
import { createListing, updateListing } from '../../lib/market/listings';
import { useI18n } from '../../lib/i18n';
import { useAuth, useMyListings } from './store';
import { useListing } from './useMarketData';
import { ShopLocationField } from './ShopLocation';
import { LoginPrompt } from './LoginPrompt';

const CURRENCIES: Currency[] = ['gold', 'coins'];

export function CreateListing({ editId, onDone, onLogin }: { editId?: string; onDone: () => void; onLogin: () => void }) {
  const { t, lang } = useI18n();
  const { userId, isContributor } = useAuth();
  const { addListing } = useMyListings();
  const categories = useCategories();
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!editId;
  const { listing: editListing } = useListing(editId || '');

  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0].key);
  const [subcategory, setSubcategory] = useState(categories[0].subs[0] ?? '');
  const [rarity, setRarity] = useState<Rarity>('rare');
  const [itemLevel, setItemLevel] = useState(90);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState<Currency>('gold');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const [shop, setShop] = useState<ShopLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  // Prefill the form once when editing an existing listing.
  useEffect(() => {
    if (!editing || prefilled || !editListing) return;
    setName(editListing.name);
    setCategory(editListing.category);
    setSubcategory(editListing.subcategory);
    setRarity(editListing.rarity);
    setItemLevel(editListing.itemLevel);
    setQuantity(editListing.quantity);
    setPrice(editListing.price);
    setCurrency(editListing.currency);
    setDescription(editListing.description);
    setImage(editListing.image || '');
    setHighlighted(editListing.highlighted);
    setShop(editListing.shop ?? null);
    setPrefilled(true);
  }, [editing, prefilled, editListing]);

  const canContribute = isContributor;
  const cat = categories.find((c) => c.key === category) ?? categories[0];

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!userId || !image) return;
    setError('');
    const fields = {
      name: name.trim() || t('mk.create.untitled'),
      itemLevel, category, subcategory, rarity, quantity, price, currency,
      description: description.trim(), highlighted: canContribute && highlighted, shop,
    };
    if (BACKEND_ENABLED) {
      if (!editing && !imageFile) return; // new listing requires an image
      setBusy(true);
      try {
        if (editing) await updateListing(editId!, userId, fields, imageFile);
        else await createListing(userId, { ...fields, imageFile: imageFile! });
        onDone();
      } catch (e) {
        const key = limitErrorKey(e);
        setError(key ? t(key) : errText(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const listing: Listing = {
      id: editId || `my-${Date.now()}`,
      icon: cat.icon, image, tier: 0, sockets: 0, classReq: 'Todas', stats: [],
      status: 'available', sellerId: userId, views: 0, createdAt: Date.now(),
      ...fields,
    };
    addListing(listing);
    onDone();
  };

  if (!userId) return <LoginPrompt onLogin={onLogin} />;

  return (
    <div className="mk-create">
      <button className="mk-back" onClick={onDone}>← {t('mk.back')}</button>
      <h1 className="mk-h1">📦 {editing ? t('mk.edit.title') : t('mk.create.title')}</h1>

      <div className="mk-form">
        {/* in-game shop location (optional) — asked first */}
        <ShopLocationField value={shop} onChange={setShop} />

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
                <button className="mk-imgdrop-remove" onClick={(e) => { e.stopPropagation(); setImage(''); setImageFile(null); }}>✕</button>
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
          <select value={category} onChange={(e) => { setCategory(e.target.value); const c = categories.find((x) => x.key === e.target.value); setSubcategory(c?.subs[0] ?? ''); }}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label[lang]}</option>)}
          </select>
        </label>
        {cat.subs.length > 0 && (
          <label className="mk-field">
            <span>{t('mk.subcategory')}</span>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
              {cat.subs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}

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
          <button className="mk-btn primary" onClick={submit} disabled={!image || busy}>
            {busy ? `⏳ ${t('mk.loading')}` : editing ? `✓ ${t('mk.edit.save')}` : `✓ ${t('mk.create.publish')}`}
          </button>
          <button className="mk-btn" onClick={onDone} disabled={busy}>{t('mk.cancel')}</button>
        </div>
        {!image && !editing && <p className="mk-muted mk-create-imgreq">⚠ {t('mk.create.imagereq')}</p>}
        {error && <p className="mk-auth-err">✕ {error}</p>}
      </div>
    </div>
  );
}

function clamp(raw: string, lo: number, hi: number): number {
  const n = Number(raw);
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

/** Readable message from any thrown value (Error or a Supabase error object). */
function errText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
