// Read-only character summary — used both as the builder's live preview and
// as the body of the public share page (`full` adds notes/price/contact/listed).
import { useI18n } from '../../lib/i18n';
import { SOULS_BY_ID, CATEGORY_ICON, CATEGORY_LABEL } from '../../lib/souls';
import { SoulIcon } from '../SoulIcon';
import { CLASS_PORTRAIT, fmtWardrobeNumber, type WardrobeCharacter, type WardrobeItem } from '../../lib/wardrobe/types';
import { EquipmentDoll } from './EquipmentDoll';

export function CharacterSummary({ character, itemsById, full }: { character: WardrobeCharacter; itemsById: Map<number, WardrobeItem>; full?: boolean }) {
  const { t, lang } = useI18n();
  const souls = character.souls.map((cs) => ({ soul: SOULS_BY_ID[cs.id], level: cs.level })).filter((x) => x.soul);
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US');

  return (
    <div className={`wd-summary ${full ? 'full' : ''}`}>
      <div className="wd-summary-body">
        <img className="wd-summary-portrait" src={CLASS_PORTRAIT[character.class]} alt={t(`wd.class.${character.class}`)} />

        <div className="wd-summary-content">
          <div className="wd-summary-head">
            <div>
              <h1 className="wd-summary-nick">{character.nick}</h1>
              <span className="wd-summary-class">{t(`wd.class.${character.class}`)}</span>
              {full && (
                <span className={`mk-status ${character.listedOnMarketplace ? 'available' : 'reserved'}`}>
                  {character.listedOnMarketplace ? t('wd.sale.listed.yes') : t('wd.sale.listed.no')}
                </span>
              )}
            </div>
            <div className="wd-summary-level">
              <span>{t('wd.info.level')} {character.level}</span>
              <div className="wd-expbar"><div style={{ width: `${character.expPct}%` }} /></div>
              <span className="mk-muted">{character.expPct.toFixed(2).replace('.', ',')}%</span>
            </div>
          </div>

          <EquipmentDoll equipment={character.equipment} itemsById={itemsById} readOnly />

          {souls.length > 0 && (
            <div className="wd-summary-souls">
              <h2 className="mk-h2">✨ {t('wd.souls.title')}</h2>
              <div className="wd-souls-grid">
                {souls.map(({ soul: s, level }) => (
                  <div key={s.id} className="wd-soul-chip" title={s.name}>
                    <SoulIcon soul={s} size={32} />
                    <span>{s.name}</span>
                    <span className="mk-muted">{CATEGORY_ICON[s.category]} {CATEGORY_LABEL[s.category]} · Lv{level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {full && character.notes && (
            <div className="wd-summary-notes">
              <h2 className="mk-h2">{t('wd.info.notes')}</h2>
              <p>{character.notes}</p>
            </div>
          )}

          {full && (character.priceCoins != null || character.priceGold != null) && (
            <div className="wd-summary-price">
              {character.priceGold != null && <span className="mk-price"><span className="mk-price-coin">🪙</span>{fmtWardrobeNumber(character.priceGold)} Gold</span>}
              {character.priceCoins != null && <span className="mk-price"><span className="mk-price-coin">💰</span>{fmtWardrobeNumber(character.priceCoins)} Coins</span>}
            </div>
          )}

          {full && (character.contactWhatsapp || character.contactDiscord) && (
            <div className="wd-summary-contact">
              {character.contactWhatsapp && <span>💚 WhatsApp: {character.contactWhatsapp}</span>}
              {character.contactDiscord && <span>🎮 Discord: {character.contactDiscord}</span>}
            </div>
          )}

          {full && (
            <p className="mk-muted wd-summary-updated">{t('wd.updated')} {fmtDate(character.updatedAt)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
