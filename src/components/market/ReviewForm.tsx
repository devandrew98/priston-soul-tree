import { useState } from 'react';
import { REVIEW_TAGS } from '../../lib/market/data';
import { submitReview } from '../../lib/market/social';
import { useI18n } from '../../lib/i18n';

export function ReviewForm({ sellerId, authorId, onDone }: { sellerId: string; authorId: string; onDone: () => void }) {
  const { t } = useI18n();
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => setTags((p) => (p.includes(tag) ? p.filter((x) => x !== tag) : [...p, tag]));

  const submit = async () => {
    setError(''); setBusy(true);
    try {
      await submitReview(sellerId, authorId, stars, tags, comment.trim());
      setSent(true);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <div className="mk-note">✓ {t('mk.review.thanks')}</div>;

  return (
    <div className="mk-reviewform">
      <div className="mk-reviewform-top">
        <span className="mk-reviewform-lbl">{t('mk.review.yours')}</span>
        <span className="mk-starpick">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`mk-starbtn ${n <= stars ? 'on' : ''}`} onClick={() => setStars(n)} aria-label={`${n}★`}>★</button>
          ))}
        </span>
      </div>
      <div className="mk-review-tags pick">
        {REVIEW_TAGS.map((tag) => (
          <button key={tag} className={`mk-tag pick ${tags.includes(tag) ? 'on' : ''}`} onClick={() => toggleTag(tag)}>
            {t(`mk.revtag.${tag}`)}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t('mk.review.ph')} />
      {error && <p className="mk-auth-err">✕ {error}</p>}
      <button className="mk-btn primary sm" onClick={submit} disabled={busy}>{busy ? '…' : t('mk.review.submit')}</button>
    </div>
  );
}
