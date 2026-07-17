// Create/edit-form section: opt into WhatsApp contact, enter/pick the number
// and give consent. The number stays private (protected table); only the flag
// is public. Value is a WhatsappDraft owned by the parent form.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  type WhatsappDraft, type WhatsappInfo,
  fetchListingWhatsapp, fetchMyWhatsapp, isValidBR, maskBR, maskPartial, onlyDigits,
} from '../../lib/market/whatsapp';

export function WhatsappField({ userId, editId, value, onChange }: {
  userId: string; editId?: string;
  value: WhatsappDraft; onChange: (v: WhatsappDraft) => void;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState<WhatsappInfo | null>(null);
  const [numberText, setNumberText] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyWhatsapp(userId).then((s) => { if (!cancelled) setSaved(s); }).catch(() => {});
    if (editId && !loaded.current) {
      loaded.current = true;
      fetchListingWhatsapp(editId).then((info) => {
        if (cancelled || !info) return;
        setNumberText(maskBR(info.number));
        onChange({ enabled: true, info: { ...info, consent: info.consent }, saveToProfile: false });
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [userId, editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = value.info;
  const setEnabled = (en: boolean) => onChange(en ? { ...value, enabled: true } : { enabled: false, info: null, saveToProfile: value.saveToProfile });
  const setNumberDigits = (digits: string) => onChange({ ...value, enabled: true, info: { number: digits, countryCode: '55', consent: info?.consent ?? false } });
  const setNumber = (raw: string) => { const m = maskBR(raw); setNumberText(m); setNumberDigits(onlyDigits(m)); };
  const setConsent = (c: boolean) => onChange({ ...value, info: { number: info?.number ?? '', countryCode: info?.countryCode ?? '55', consent: c } });
  const useSaved = () => { if (!saved) return; setNumberText(maskBR(saved.number)); setNumberDigits(saved.number); };

  const badNumber = value.enabled && !!info && info.number.length > 0 && !isValidBR(info.number);

  return (
    <div className="mk-field span2 wa-field">
      <span>💬 {t('mk.wa.question')}</span>
      <div className="mk-seg">
        <button type="button" className={value.enabled ? '' : 'on'} onClick={() => setEnabled(false)}>{t('mk.wa.no')}</button>
        <button type="button" className={value.enabled ? 'on' : ''} onClick={() => setEnabled(true)}>{t('mk.wa.yes')}</button>
      </div>

      {value.enabled && (
        <div className="wa-body">
          {saved && (
            <button type="button" className="wa-use-saved" onClick={useSaved}>
              📱 {t('mk.wa.usesaved', { num: maskPartial(saved.number) })}
            </button>
          )}
          <label className="mk-field">
            <span>{t('mk.wa.numberlabel')}</span>
            <input value={numberText} onChange={(e) => setNumber(e.target.value)} placeholder="(11) 99999-9999" inputMode="numeric" />
          </label>
          {badNumber && <p className="mk-auth-err">✕ {t('mk.wa.badnumber')}</p>}
          <p className="mk-muted wa-privacy">{t('mk.wa.privacy')}</p>
          <label className="mk-check wa-consent">
            <input type="checkbox" checked={!!info?.consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t('mk.wa.consent')}</span>
          </label>
          <label className="mk-check wa-saveprofile">
            <input type="checkbox" checked={value.saveToProfile} onChange={(e) => onChange({ ...value, saveToProfile: e.target.checked })} />
            <span>{t('mk.wa.saveprofile')}</span>
          </label>
        </div>
      )}
    </div>
  );
}
