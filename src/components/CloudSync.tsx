import { useState } from 'react';
import { useStore } from '../store';
import { HelpTip } from './HelpTip';

export function CloudSync() {
  const { playerCode, syncStatus, startSync, syncWithCode, stopSync } = useStore();
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
      <HelpTip text="Sincronização: ative pra ganhar um código de jogador. Com ele, seu inventário e builds ficam salvos na nuvem e acessíveis em qualquer aparelho — é só usar 'Entrar com código' em outro navegador. Sem senha." />
      {playerCode ? (
        <>
          <span className="cs-code" title="Seu código de jogador — guarde para acessar seu inventário e builds em outro dispositivo">
            ☁ {playerCode}
          </span>
          <button className="btn sm" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</button>
          <button className="btn sm" onClick={stopSync} title="Desligar a sincronização neste navegador">Sair</button>
        </>
      ) : (
        <>
          <button className="btn sm primary" onClick={startSync} title="Salvar seu inventário e builds na nuvem e receber um código">
            ☁ Ativar sincronização
          </button>
          {entering ? (
            <span className="row" style={{ gap: 4 }}>
              <input
                className="input"
                style={{ width: 96, textTransform: 'uppercase', letterSpacing: 1 }}
                placeholder="CÓDIGO"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                maxLength={8}
                onKeyDown={(e) => { if (e.key === 'Enter') syncWithCode(codeInput); }}
              />
              <button className="btn sm" onClick={() => syncWithCode(codeInput)}>Entrar</button>
            </span>
          ) : (
            <button className="btn sm" onClick={() => setEntering(true)}>Entrar com código</button>
          )}
        </>
      )}
      {syncStatus && <span className="cs-status muted">{syncStatus}</span>}
    </div>
  );
}
