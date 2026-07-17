// "Tenho interesse" flow: pick a reason + optional message, record the interest
// server-side (RPC), then open WhatsApp with a ready-made message. The seller's
// number is only fetched here (authenticated) — never in the public page data.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n';
import { fmtPrice } from '../../lib/market/helpers';
import type { Listing } from '../../lib/market/types';
import { type InterestReason, buildWhatsappUrl, whatsappContact } from '../../lib/market/whatsapp';

const REASONS: InterestReason[] = ['buy', 'offer', 'question', 'trade'];
const MAX = 250;

function waErr(e: unknown, t: (k: string) => string): string {
  const m = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));
  if (/not_authenticated/.test(m)) return t('mk.wa.err.login');
  if (/\bsold\b/.test(m)) return t('mk.wa.err.sold');
  if (/own_listing/.test(m)) return t('mk.wa.err.own');
  if (/unavailable/.test(m)) return t('mk.wa.err.unavailable');
  if (/no_whatsapp/.test(m)) return t('mk.wa.err.nowa');
  if (/blocked/.test(m)) return t('mk.wa.err.blocked');
  if (/limit_rate_contacts/.test(m)) return t('mk.wa.err.rate');
  return m;
}

export function InterestModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<InterestReason>('buy');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const proceed = async () => {
    setError(''); setBusy(true);
    try {
      const number = await whatsappContact(listing.id, reason, message.trim());
      const price = fmtPrice(listing.price, listing.currency);
      const url = `${location.origin}/#item-${listing.id}`;
      const body = t(`mk.wa.msg.${reason}`, { item: listing.name, price, msg: message.trim() }).replace(/\s+$/, '');
      const full = `${body}\n\n${t('mk.wa.msg.link', { url })}`;
      window.open(buildWhatsappUrl(number, full), '_blank', 'noopener,noreferrer');
      onClose();
    } catch (e) {
      setError(waErr(e, t));
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="mk-modal-backdrop" onClick={onClose}>
      <div className="mk-modal wa-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mk-modal-close" onClick={onClose} aria-label={t('mk.close')}>✕</button>
        <h2 className="mk-modal-title">💚 {t('mk.wa.modal.title')}</h2>
        <p className="mk-muted wa-modal-item">{listing.name} · {fmtPrice(listing.price, listing.currency)}</p>

        <div className="wa-reasons">
          {REASONS.map((r) => (
            <button key={r} type="button" className={`wa-reason ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>
              {t(`mk.wa.reason.${r}`)}
            </button>
          ))}
        </div>

        <label className="mk-field">
          <span>{t('mk.wa.modal.msglabel')} {reason !== 'buy' && <em className="mk-muted">({t('mk.wa.modal.optional')})</em>}</span>
          <textarea value={message} maxLength={MAX} rows={3} placeholder={t('mk.wa.modal.msgph')} onChange={(e) => setMessage(e.target.value)} />
          <span className="wa-charcount">{message.length}/{MAX}</span>
        </label>

        {error && <p className="mk-auth-err">✕ {error}</p>}

        <div className="wa-modal-actions">
          <button className="mk-btn" onClick={onClose} disabled={busy}>{t('mk.cancel')}</button>
          <button className="mk-btn wa-btn" onClick={proceed} disabled={busy}>{busy ? '…' : `💚 ${t('mk.wa.modal.continue')}`}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
