import { useState } from 'react';
import { useStore } from '../store';
import { useI18n } from '../lib/i18n';
import { HelpTip } from './HelpTip';

export function CloudSync() {
  const { playerCode, syncStatus, startSync, syncWithCode, stopSync } = useStore();
  const { t } = useI18n();
  const [entering, setEntering] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!playerCode) return;
    navigator.clipboard?.writeText(playerCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="cloudsync">
      <HelpTip text={t('st.cs.help')} />
      {playerCode ? (
        <>
          <span className="cs-code" title={t('st.cs.codetitle')}>
            ☁ {playerCode}
          </span>
          <button className="btn sm" onClick={copy}>{copied ? t('st.cs.copied') : t('st.cs.copy')}</button>
          <button className="btn sm" onClick={stopSync} title={t('st.cs.leave.title')}>{t('st.cs.leave')}</button>
        </>
      ) : (
        <>
          <button className="btn sm primary" onClick={startSync} title={t('st.cs.activate.title')}>
            {t('st.cs.activate')}
          </button>
          {entering ? (
            <span className="row" style={{ gap: 4 }}>
              <input
                className="input"
                style={{ width: 96, textTransform: 'uppercase', letterSpacing: 1 }}
                placeholder={t('st.cs.codeph')}
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                maxLength={8}
                onKeyDown={(e) => { if (e.key === 'Enter') syncWithCode(codeInput); }}
              />
              <button className="btn sm" onClick={() => syncWithCode(codeInput)}>{t('st.cs.enter')}</button>
            </span>
          ) : (
            <button className="btn sm" onClick={() => setEntering(true)}>{t('st.cs.entercode')}</button>
          )}
        </>
      )}
      {syncStatus && <span className="cs-status muted">{t(syncStatus)}</span>}
    </div>
  );
}
