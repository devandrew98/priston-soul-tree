import { useState } from 'react';
import { useStore } from '../store';
import { useI18n } from '../lib/i18n';
import { ShareModal } from './ShareModal';

export function BuildBar() {
  const { builds, activeBuild, selectBuild, createBuild, duplicateBuild, renameBuild, deleteBuild, clearBuild, saveNow } = useStore();
  const { t } = useI18n();
  const [sharing, setSharing] = useState(false);

  return (
    <div className="buildbar">
      <span className="muted">Build:</span>
      <select value={activeBuild.id} onChange={(e) => selectBuild(e.target.value)}>
        {builds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <input
        value={activeBuild.name}
        onChange={(e) => renameBuild(e.target.value)}
        style={{ width: 160 }}
        title={t('st.bb.rename')}
      />
      <button className="btn sm" onClick={() => createBuild(prompt(t('st.bb.newprompt'), t('st.bb.newdefault')) || t('st.bb.newdefault'))}>{t('st.bb.new')}</button>
      <button className="btn sm" onClick={duplicateBuild}>{t('st.bb.dup')}</button>
      <button className="btn sm" onClick={() => { if (confirm(t('st.bb.clearconfirm'))) clearBuild(); }}>{t('st.bb.clear')}</button>
      <button className="btn sm" onClick={saveNow} title={t('st.bb.save.title')}>{t('st.bb.save')}</button>
      <button className="btn sm" onClick={() => setSharing(true)} title={t('st.bb.share.title')}>{t('st.bb.share')}</button>
      <button className="btn sm danger" disabled={builds.length <= 1} onClick={() => { if (confirm(t('st.bb.deleteconfirm'))) deleteBuild(); }}>{t('st.bb.delete')}</button>

      {sharing && <ShareModal onClose={() => setSharing(false)} />}
    </div>
  );
}
