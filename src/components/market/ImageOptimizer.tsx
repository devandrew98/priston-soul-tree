// Admin: one-time batch recompression of images uploaded before client-side
// compression existed (see lib/market/imageOptimize.ts). Overwrites in place.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { listAllImages, optimizeImage, type OptimizeItem, type OptimizeResult } from '../../lib/market/imageOptimize';

const fmt = (bytes: number): string => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;

export function ImageOptimizer() {
  const { t } = useI18n();
  const [items, setItems] = useState<OptimizeItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<OptimizeResult[]>([]);

  useEffect(() => { listAllImages().then(setItems).catch(() => setItems([])); }, []);

  const totalBefore = items?.reduce((a, i) => a + i.beforeSize, 0) ?? 0;
  const afterSoFar = results.reduce((a, r) => a + r.afterSize, 0);
  const beforeSoFar = results.reduce((a, r) => a + r.beforeSize, 0);
  const errors = results.filter((r) => r.error).length;
  const finished = items !== null && done === items.length && items.length > 0;

  const start = async () => {
    if (!items) return;
    setRunning(true); setResults([]); setDone(0);
    const acc: OptimizeResult[] = [];
    for (const item of items) {
      const r = await optimizeImage(item);
      if (r.error) console.error('[imgopt]', r.bucket, r.path, r.error);
      acc.push(r);
      setResults([...acc]);
      setDone(acc.length);
    }
    setRunning(false);
  };

  const pct = beforeSoFar > 0 ? Math.round((1 - afterSoFar / beforeSoFar) * 100) : 0;

  return (
    <div className="mk-imgopt">
      <p className="mk-muted">{t('mk.admin.imgopt.hint')}</p>

      {items === null ? (
        <p className="mk-muted">⏳ {t('mk.admin.imgopt.scan')}</p>
      ) : (
        <>
          <p className="mk-imgopt-found">{t('mk.admin.imgopt.found', { n: items.length, size: fmt(totalBefore) })}</p>

          {!running && !finished && (
            <button className="mk-btn primary" onClick={start} disabled={items.length === 0}>{t('mk.admin.imgopt.start')}</button>
          )}

          {running && (
            <div className="mk-imgopt-progress">
              <div className="mk-imgopt-bar"><div style={{ width: `${(done / items.length) * 100}%` }} /></div>
              <p className="mk-muted">{t('mk.admin.imgopt.running', { done, total: items.length })}</p>
            </div>
          )}

          {finished && (
            <div className="mk-dl-ok">
              ✅ {t('mk.admin.imgopt.done', { before: fmt(beforeSoFar), after: fmt(afterSoFar), pct })}
              {errors > 0 && <div className="mk-auth-err">✕ {t('mk.admin.imgopt.errors', { n: errors })}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
