// In-game shop location: the create-form field (question → city → map pin →
// confirm) and the read-only viewer modal shown on the item page.
import { useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n';
import { SHOP_CITIES, shopCity, shopCoord } from '../../lib/market/shops';
import type { ShopCity, ShopLocation } from '../../lib/market/types';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function Pin() {
  return (
    <svg className="shopmap-pin-svg" width="30" height="40" viewBox="0 0 24 32" aria-hidden="true">
      <path d="M12 0C6.2 0 1.5 4.7 1.5 10.5 1.5 18 12 32 12 32s10.5-14 10.5-21.5C22.5 4.7 17.8 0 12 0z" fill="#e11d1d" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="10.5" r="4" fill="#fff" />
    </svg>
  );
}

/** Map image with an optional pin; interactive maps report clicks as x,y (0..1). */
function ShopMap({ city, point, onPick }: {
  city: ShopCity;
  point: { x: number; y: number } | null;
  onPick?: (p: { x: number; y: number }) => void;
}) {
  const def = shopCity(city);
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    onPick({ x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) });
  };
  return (
    <div className={`shopmap ${onPick ? 'interactive' : ''}`} onClick={click}>
      <img src={def.img} alt={def.name} draggable={false} />
      {point && (
        <span className="shopmap-pin" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}><Pin /></span>
      )}
    </div>
  );
}

/** Full-screen picker modal: click the map, confirm the coordinate. */
function PickerModal({ city, initial, onConfirm, onClose }: {
  city: ShopCity; initial: { x: number; y: number } | null;
  onConfirm: (p: { x: number; y: number }) => void; onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(initial);
  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="shop-picker" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h3 className="shop-picker-title">📍 {shopCity(city).name} — {t('mk.shop.clickmap')}</h3>
        <ShopMap city={city} point={draft} onPick={setDraft} />
        <div className="shop-picker-foot">
          {draft ? (
            <>
              <span className="shop-picker-coord">{t('mk.shop.willmark')} <b>{shopCity(city).name} — {shopCoord(draft)}</b></span>
              <span className="shop-picker-acts">
                <button className="mk-btn" onClick={() => setDraft(null)}>{t('mk.shop.chooseagain')}</button>
                <button className="mk-btn primary" onClick={() => onConfirm(draft)}>✓ {t('mk.shop.confirm')}</button>
              </span>
            </>
          ) : (
            <span className="mk-muted">{t('mk.shop.clickhint')}</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Create-form field: the whole optional shop-location flow. */
export function ShopLocationField({ value, onChange }: { value: ShopLocation | null; onChange: (v: ShopLocation | null) => void }) {
  const { t } = useI18n();
  const [wantShop, setWantShop] = useState<boolean>(!!value);
  const [picking, setPicking] = useState<ShopCity | null>(null);

  const setNo = () => { setWantShop(false); onChange(null); };
  const setYes = () => setWantShop(true);

  return (
    <div className="mk-field span2 shop-field">
      <span>📍 {t('mk.shop.question')}</span>
      <div className="mk-seg">
        <button type="button" className={wantShop ? '' : 'on'} onClick={setNo}>{t('mk.shop.no')}</button>
        <button type="button" className={wantShop ? 'on' : ''} onClick={setYes}>{t('mk.shop.yes')}</button>
      </div>

      {wantShop && (
        <div className="shop-field-body">
          {value ? (
            <div className="shop-summary">
              <span className="shop-summary-label">📍 <b>{shopCity(value.city).name}</b> — {shopCoord(value)}</span>
              <span className="shop-summary-acts">
                <button type="button" className="mk-btn sm" onClick={() => setPicking(value.city)}>{t('mk.shop.change')}</button>
                <button type="button" className="mk-btn sm danger" onClick={() => onChange(null)}>{t('mk.shop.remove')}</button>
              </span>
            </div>
          ) : (
            <>
              <span className="mk-muted shop-field-q">{t('mk.shop.whichcity')}</span>
              <div className="shop-city-pick">
                {SHOP_CITIES.map((c) => (
                  <button type="button" key={c.id} className="shop-city-btn" onClick={() => setPicking(c.id)}>{c.name}</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {picking && (
        <PickerModal
          city={picking}
          initial={value && value.city === picking ? { x: value.x, y: value.y } : null}
          onClose={() => setPicking(null)}
          onConfirm={(p) => { onChange({ city: picking, x: p.x, y: p.y }); setPicking(null); }}
        />
      )}
    </div>
  );
}

/** Read-only viewer modal for the item page. */
export function ShopLocationModal({ shop, onClose }: { shop: ShopLocation; onClose: () => void }) {
  const { t } = useI18n();
  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="shop-picker" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h3 className="shop-picker-title">📍 {t('mk.shop.viewtitle')}</h3>
        <ShopMap city={shop.city} point={{ x: shop.x, y: shop.y }} />
        <div className="shop-picker-foot">
          <span className="shop-picker-coord">
            {t('mk.shop.city')}: <b>{shopCity(shop.city).name}</b> · {t('mk.shop.coord')}: <b>{shopCoord(shop)}</b>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
