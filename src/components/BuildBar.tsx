import { useState } from 'react';
import { useStore } from '../store';
import { ShareModal } from './ShareModal';

export function BuildBar() {
  const { builds, activeBuild, selectBuild, createBuild, duplicateBuild, renameBuild, deleteBuild, clearBuild } = useStore();
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
        title="Renomear build atual"
      />
      <button className="btn sm" onClick={() => createBuild(prompt('Nome da nova build:', 'Nova Build') || 'Nova Build')}>+ Nova</button>
      <button className="btn sm" onClick={duplicateBuild}>⧉ Duplicar</button>
      <button className="btn sm" onClick={() => { if (confirm('Limpar todos os slots desta build?')) clearBuild(); }}>Limpar</button>
      <button className="btn sm" onClick={() => setSharing(true)} title="Compartilhar por código ou link">🔗 Compartilhar</button>
      <button className="btn sm danger" disabled={builds.length <= 1} onClick={() => { if (confirm('Excluir esta build?')) deleteBuild(); }}>Excluir</button>

      {sharing && <ShareModal onClose={() => setSharing(false)} />}
    </div>
  );
}
