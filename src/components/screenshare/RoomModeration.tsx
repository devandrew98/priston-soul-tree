import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import {
  REPORT_DETAILS_MAX, REPORT_REASONS, closeRoom, dismissReports, fetchReports, markReported, reportOnCooldown, reportRoom,
  type ReportReason, type RoomReport,
} from '../../lib/screenshare/moderation';

/** Small form a viewer fills to flag a room to the admins. */
export function ReportBox({ code, onDone }: { code: string; onDone: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'again' | 'fail'>(() => (reportOnCooldown(code) ? 'again' : 'idle'));

  const send = async () => {
    setState('sending');
    const ok = await reportRoom(code, reason, details);
    if (ok) markReported(code);
    setState(ok ? 'sent' : 'fail');
  };

  return (
    <div className="sr-card sr-report">
      <h3 className="sr-h3">{t('sc.report.title')}</h3>
      {state === 'sent' && <p className="mk-muted">{t('sc.report.sent')}</p>}
      {state === 'again' && <p className="mk-muted">{t('sc.report.again')}</p>}
      {(state === 'idle' || state === 'sending' || state === 'fail') && (
        <>
          <label className="mk-field">
            <span>{t('sc.report.reason')}</span>
            <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`sc.report.reason.${r}`)}</option>)}
            </select>
          </label>
          <label className="mk-field">
            <span>{t('sc.report.details')}</span>
            <textarea value={details} maxLength={REPORT_DETAILS_MAX} rows={3} onChange={(e) => setDetails(e.target.value)} />
          </label>
          {state === 'fail' && <p className="sk-notice">{t('sc.report.fail')}</p>}
          <button type="button" className="mk-btn primary" disabled={state === 'sending'} onClick={send}>🚩 {t('sc.report.send')}</button>
        </>
      )}
      <button type="button" className="mk-btn sm" onClick={onDone}>{t('sc.report.close')}</button>
    </div>
  );
}

interface Group { code: string; count: number; latest: number; items: RoomReport[] }

/** Admin-only list of reported rooms, with "close room" and "dismiss". */
export function ModerationPanel({ onClosed }: { onClosed: () => void }) {
  const { t, lang } = useI18n();
  const [reports, setReports] = useState<RoomReport[] | null>(null);
  const [notice, setNotice] = useState('');

  const load = () => { void fetchReports().then(setReports); };
  useEffect(load, []);

  const groups: Group[] = [];
  for (const r of reports ?? []) {
    let g = groups.find((x) => x.code === r.roomCode);
    if (!g) { g = { code: r.roomCode, count: 0, latest: 0, items: [] }; groups.push(g); }
    g.count += 1; g.latest = Math.max(g.latest, r.createdAt); g.items.push(r);
  }
  groups.sort((a, b) => b.count - a.count || b.latest - a.latest);

  const close = async (code: string) => {
    const ok = await closeRoom(code, 'reported');
    setNotice(ok ? t('sc.mod.closed') : t('sc.mod.closeFail'));
    if (ok) { await dismissReports(code); onClosed(); load(); }
  };
  const dismiss = async (code: string) => { await dismissReports(code); load(); };
  const fmt = (ms: number) => new Date(ms).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <section className="sr-mod">
      <h2 className="mk-h2">🛡 {t('sc.mod.title')} <button type="button" className="mk-btn sm" onClick={load}>↻ {t('sc.mod.refresh')}</button></h2>
      {notice && <p className="sk-notice">{notice}</p>}
      {reports === null ? <p className="mk-muted">{t('sc.list.loading')}</p> : groups.length === 0 ? <p className="mk-muted">{t('sc.mod.empty')}</p> : (
        <ul className="sr-mod-list">
          {groups.map((g) => (
            <li key={g.code} className="sr-card">
              <div className="sr-mod-head">
                <code>{g.code}</code>
                <span>{t('sc.mod.reports', { n: g.count })} · {fmt(g.latest)}</span>
              </div>
              <ul className="sr-mod-items">
                {g.items.slice(0, 5).map((r) => (
                  <li key={r.id}><b>{t(`sc.report.reason.${r.reason}`)}</b>{r.details && <span> — {r.details}</span>}</li>
                ))}
              </ul>
              <div className="sk-actions">
                <button type="button" className="mk-btn primary" onClick={() => close(g.code)}>⛔ {t('sc.mod.close')}</button>
                <button type="button" className="mk-btn" onClick={() => dismiss(g.code)}>{t('sc.mod.dismiss')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
