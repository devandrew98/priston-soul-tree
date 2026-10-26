import { useI18n } from '../lib/i18n';

/** The site's "loading" indicator: a small gold ring that turns, plus the usual text. */
export function Loading({ inline = false, className = '' }: { inline?: boolean; className?: string }) {
  const { t } = useI18n();
  const Tag = inline ? 'span' : 'p';
  return (
    <Tag className={`mk-loading ${className}`.trim()} role="status">
      <span className="mk-spinner" aria-hidden="true" />
      {t('mk.loading')}
    </Tag>
  );
}
