// Create / edit a character sheet: info form, clickable equipment doll, Souls,
// preview and (once saved) the public share link.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../market/store';
import {
  createCharacter, deleteCharacter, fetchCharacter, updateCharacter, type CharacterInput,
} from '../../lib/wardrobe/characters';
import { fetchWardrobeItems } from '../../lib/wardrobe/items';
import { applyEquip, patchEquipped } from '../../lib/wardrobe/logic';
import {
  EMPTY_EQUIPMENT, SLOT_TO_ITEM_SLOT, WARDROBE_CLASSES,
  type CharacterSoul, type Equipment, type EquipSlotKey, type ItemSlot, type WardrobeCharacter,
  type WardrobeClass, type WardrobeItem,
} from '../../lib/wardrobe/types';
import { EquipmentDoll } from './EquipmentDoll';
import { ItemPicker } from './ItemPicker';
import { SoulsPicker } from './SoulsPicker';
import { CharacterSummary } from './CharacterSummary';

const pickerSlotsFor = (key: EquipSlotKey): ItemSlot[] => (key === 'offhand' ? ['orb', 'shield'] : [SLOT_TO_ITEM_SLOT[key] as ItemSlot]);

export function WardrobeBuilder({ editId, onDone }: { editId?: string; onDone: () => void }) {
  const { t } = useI18n();
  const { userId } = useAuth();
  const editing = !!editId;

  const [itemsById, setItemsById] = useState<Map<number, WardrobeItem>>(new Map());
  const [nick, setNick] = useState('');
  const [charClass, setCharClass] = useState<WardrobeClass>('fighter');
  const [level, setLevel] = useState(1);
  const [expPct, setExpPct] = useState(0);
  const [notes, setNotes] = useState('');
  const [priceCoins, setPriceCoins] = useState<string>('');
  const [priceGold, setPriceGold] = useState<string>('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [contactDiscord, setContactDiscord] = useState('');
  const [listedOnMarketplace, setListedOnMarketplace] = useState(false);
  const [equipment, setEquipment] = useState<Equipment>(EMPTY_EQUIPMENT);
  const [souls, setSouls] = useState<CharacterSoul[]>([]);
  const [pickerSlot, setPickerSlot] = useState<EquipSlotKey | null>(null);
  const [showSouls, setShowSouls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<WardrobeCharacter | null>(null);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => { fetchWardrobeItems().then((items) => setItemsById(new Map(items.map((i) => [i.id, i])))).catch(() => {}); }, []);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    fetchCharacter(editId!).then((c) => {
      if (cancelled || !c) return;
      setNick(c.nick); setCharClass(c.class); setLevel(c.level); setExpPct(c.expPct); setNotes(c.notes);
      setPriceCoins(c.priceCoins != null ? String(c.priceCoins) : ''); setPriceGold(c.priceGold != null ? String(c.priceGold) : '');
      setContactWhatsapp(c.contactWhatsapp); setContactDiscord(c.contactDiscord); setListedOnMarketplace(c.listedOnMarketplace);
      setEquipment(c.equipment); setSouls(c.souls); setSaved(c);
    }).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [editing, editId]);

  if (!userId) return null; // caller (Wardrobe.tsx) shows LoginPrompt instead

  const pick = (item: WardrobeItem) => {
    if (pickerSlot) setEquipment((eq) => applyEquip(eq, pickerSlot, { itemId: item.id, rarity: item.rarity, aging: null, mix: null, affix: null }));
    setPickerSlot(null);
  };

  const buildInput = (): CharacterInput => ({
    nick: nick.trim() || t('wd.untitled'), class: charClass, level, expPct, notes: notes.trim(),
    priceCoins: priceCoins.trim() ? Number(priceCoins) : null, priceGold: priceGold.trim() ? Number(priceGold) : null,
    contactWhatsapp: contactWhatsapp.trim(), contactDiscord: contactDiscord.trim(), listedOnMarketplace,
    equipment, souls,
  });

  // Once created, keep behaving like an edit for the rest of this session —
  // otherwise a second click on "Salvar" would create a duplicate character.
  const isEditing = editing || !!saved;

  const save = async () => {
    setError(''); setBusy(true);
    try {
      if (saved) { await updateCharacter(saved.id, buildInput()); setSaved({ ...saved, ...buildInput(), updatedAt: Date.now() } as WardrobeCharacter); }
      else { const created = await createCharacter(userId, buildInput()); setSaved(created); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!saved || !window.confirm(t('wd.confirmdelete'))) return;
    setBusy(true);
    try { await deleteCharacter(saved.id); onDone(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const shareUrl = saved ? `${location.origin}/char/${saved.slug}` : '';
  const [copied, setCopied] = useState(false);
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };

  if (!loaded) return <p className="mk-empty">⏳ {t('mk.loading')}</p>;

  return (
    <div className="wd-builder">
      <button className="mk-back" onClick={onDone}>← {t('mk.back')}</button>
      <h1 className="mk-h1">🧥 {isEditing ? t('wd.edit.title') : t('wd.create.title')}</h1>

      <div className="wd-builder-grid">
        <div className="wd-builder-form">
          <h2 className="mk-h2">{t('wd.info.title')}</h2>
          <label className="mk-field"><span>{t('wd.info.nick')}</span>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder={t('wd.info.nickph')} />
          </label>
          <label className="mk-field"><span>{t('wd.info.class')}</span>
            <select value={charClass} onChange={(e) => setCharClass(e.target.value as WardrobeClass)}>
              {WARDROBE_CLASSES.map((c) => <option key={c} value={c}>{t(`wd.class.${c}`)}</option>)}
            </select>
          </label>
          <label className="mk-field"><span>{t('wd.info.level')}</span>
            <input type="number" min={1} max={400} value={level} onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="mk-field"><span>{t('wd.info.exp')}</span>
            <input type="number" min={0} max={100} step={0.01} value={expPct} onChange={(e) => setExpPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
          </label>
          <div className="wd-expbar"><div style={{ width: `${expPct}%` }} /></div>

          <label className="mk-field span2"><span>{t('wd.info.notes')}</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('wd.info.notesph')} />
          </label>

          <h2 className="mk-h2">{t('wd.sale.title')}</h2>
          <label className="mk-field"><span>{t('wd.sale.pricecoins')}</span>
            <input type="number" min={0} value={priceCoins} onChange={(e) => setPriceCoins(e.target.value)} placeholder="0" />
          </label>
          <label className="mk-field"><span>{t('wd.sale.pricegold')}</span>
            <input type="number" min={0} value={priceGold} onChange={(e) => setPriceGold(e.target.value)} placeholder="0" />
          </label>
          <label className="mk-field"><span>{t('wd.sale.contactwhatsapp')}</span>
            <input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} placeholder={t('wd.sale.contactwhatsappph')} />
          </label>
          <label className="mk-field"><span>{t('wd.sale.contactdiscord')}</span>
            <input value={contactDiscord} onChange={(e) => setContactDiscord(e.target.value)} placeholder={t('wd.sale.contactdiscordph')} />
          </label>
          <label className="mk-field span2 mk-check">
            <input type="checkbox" checked={listedOnMarketplace} onChange={(e) => setListedOnMarketplace(e.target.checked)} />
            <span>{t('wd.sale.listed')}</span>
          </label>
        </div>

        <div className="wd-builder-doll">
          <h2 className="mk-h2">{t('wd.equip.title')}</h2>
          <EquipmentDoll
            equipment={equipment} itemsById={itemsById}
            onSlotClick={(slot) => setPickerSlot(slot)}
            onPatch={(slot, patch) => setEquipment((eq) => patchEquipped(eq, slot, patch))}
            onClear={(slot) => setEquipment((eq) => applyEquip(eq, slot, null))}
          />

          <div className="wd-souls-block">
            <h2 className="mk-h2">✨ {t('wd.souls.title')}</h2>
            <p className="mk-muted">{t('wd.souls.count', { n: souls.length })}</p>
            <button className="mk-btn sm" onClick={() => setShowSouls(true)}>+ {t('wd.souls.manage')}</button>
          </div>
        </div>
      </div>

      <h2 className="mk-h2">👁 {t('wd.preview.title')}</h2>
      <CharacterSummary
        character={{
          nick: nick || t('wd.untitled'), class: charClass, level, expPct, notes, listedOnMarketplace, equipment, souls,
        } as unknown as WardrobeCharacter}
        itemsById={itemsById}
      />

      <div className="wd-builder-actions">
        <button className="mk-btn primary" onClick={save} disabled={busy}>{busy ? `⏳ ${t('mk.loading')}` : `✓ ${isEditing ? t('wd.save') : t('wd.publish')}`}</button>
        {isEditing && <button className="mk-btn danger" onClick={remove} disabled={busy}>{t('mk.delete')}</button>}
      </div>
      {error && <p className="mk-auth-err">✕ {error}</p>}

      {saved && (
        <div className="wd-sharebox">
          <p className="mk-muted">{t('wd.share.hint')}</p>
          <div className="wd-sharebox-row">
            <input readOnly value={shareUrl} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button className="mk-btn" onClick={copyLink}>{copied ? `✅ ${t('wd.share.copied')}` : `🔗 ${t('wd.share.copy')}`}</button>
          </div>
          <div className="wd-sharebox-row">
            <a className="mk-btn wa-btn" target="_blank" rel="noopener noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(t('wd.share.waMsg', { nick: nick || t('wd.untitled'), url: shareUrl }))}`}>
              💚 WhatsApp
            </a>
            <button className="mk-btn" onClick={() => { navigator.clipboard?.writeText(shareUrl); copyLink(); }}>
              🎮 Discord ({t('wd.share.copylinkfirst')})
            </button>
          </div>
        </div>
      )}

      {pickerSlot && (
        <ItemPicker
          slots={pickerSlotsFor(pickerSlot)}
          title={`${t('wd.picker.title')} — ${t(`wd.slot.${pickerSlot}`)}`}
          onPick={pick}
          onClose={() => setPickerSlot(null)}
        />
      )}
      {showSouls && <SoulsPicker selected={souls} onChange={setSouls} onClose={() => setShowSouls(false)} />}
    </div>
  );
}
