// My Characters: every character of the player with their own level, EXP, bonuses, quest progress and saved plans.
import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { MAX_CHARACTERS } from '../../lib/quest/characters';
import { useQuest } from './QuestContext';
import { fmtPct } from './format';

const TXT = {
  title: { pt: 'Meus personagens', en: 'My characters' },
  newName: { pt: 'Nome do novo personagem (opcional)', en: 'New character name (optional)' },
  add: { pt: 'Criar personagem', en: 'Create character' },
  limit: { pt: 'Limite de personagens atingido.', en: 'Character limit reached.' },
  active: { pt: 'Ativo', en: 'Active' },
  use: { pt: 'Usar este', en: 'Use this one' },
  name: { pt: 'Nome', en: 'Name' },
  del: { pt: 'Excluir', en: 'Delete' },
  delAsk: { pt: 'Excluir este personagem e todo o progresso dele?', en: 'Delete this character and all its progress?' },
  yes: { pt: 'Sim', en: 'Yes' },
  no: { pt: 'Não', en: 'No' },
  onlyOne: { pt: 'Você precisa manter ao menos um personagem.', en: 'You must keep at least one character.' },
  plans: { pt: 'planejamentos salvos', en: 'saved plans' },
  done: { pt: 'quests entregues', en: 'quests delivered' },
  history: { pt: 'Histórico de entregas do personagem ativo', en: 'Delivery history of the active character' },
  noHistory: { pt: 'Nenhuma entrega registrada ainda.', en: 'No delivery recorded yet.' },
  quest: { pt: 'Quest', en: 'Quest' },
  times: { pt: 'Entregas', en: 'Deliveries' },
  removed: { pt: '(quest que não existe mais)', en: '(quest that no longer exists)' },
  storageAccount: { pt: 'Seus personagens ficam salvos na sua conta do PristonZONE.', en: 'Your characters are saved in your PristonZONE account.' },
  storageLocal: { pt: 'Seus personagens ficam salvos neste navegador. Entre na sua conta para guardá-los nela e usar em outros aparelhos.', en: 'Your characters are saved in this browser. Sign in to keep them in your account and use them on other devices.' },
  realVsSim: { pt: 'O level e a EXP aqui são os reais. Simulações na Calculadora e no Planejador nunca alteram esses valores.', en: 'The level and EXP here are the real ones. Simulations in the Calculator and the Planner never change them.' },
} as const;

export function MyCharacters() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const { chars, active, setActiveId, create, remove, update, data, storage } = useQuest();
  const [newName, setNewName] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (!active) return null;

  const delivered = Object.entries(active.progress).filter(([, p]) => p.deliveries.length > 0)
    .map(([id, p]) => ({ id, quest: data?.quests.find((q) => q.id === id), dates: [...p.deliveries].sort((a, b) => b - a) }))
    .sort((a, b) => (b.dates[0] ?? 0) - (a.dates[0] ?? 0));

  return (
    <div className="qt-section">
      <section className="sr-card cl-box">
        <h3>{T('title')} <small>· {chars.length}/{MAX_CHARACTERS}</small></h3>
        <p className="mk-muted">{storage === 'account' ? T('storageAccount') : T('storageLocal')}</p>
        <p className="mk-muted">{T('realVsSim')}</p>
        <form className="cl-form" onSubmit={(e) => { e.preventDefault(); create(newName.trim()); setNewName(''); }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={T('newName')} maxLength={40} aria-label={T('newName')} />
          <button type="submit" className="mk-btn primary" disabled={chars.length >= MAX_CHARACTERS}>{T('add')}</button>
        </form>
        {chars.length >= MAX_CHARACTERS && <p className="mk-muted">{T('limit')}</p>}
        <ul className="qt-chars">
          {chars.map((c) => {
            const isActive = c.id === active.id;
            const doneCount = Object.values(c.progress).filter((p) => p.deliveries.length > 0).length;
            return (
              <li key={c.id} className={isActive ? 'on' : ''}>
                <div className="qt-char-head">
                  <b>{c.name || '—'}</b> {isActive && <span className="qt-pill st-available">{T('active')}</span>}
                </div>
                <div className="mk-muted">Level {c.level} · {fmtPct(c.expPct, lang)} · {doneCount} {T('done')} · {c.plans.length} {T('plans')}</div>
                <div className="qt-bar"><i style={{ width: `${Math.min(100, c.expPct)}%` }} /></div>
                <div className="qt-actions">
                  {!isActive && <button type="button" className="mk-btn primary" onClick={() => setActiveId(c.id)}>{T('use')}</button>}
                  {confirmId === c.id ? (
                    <span className="cl-confirm">{T('delAsk')}
                      <button type="button" className="mk-btn cl-danger" onClick={() => { remove(c.id); setConfirmId(null); }}>{T('yes')}</button>
                      <button type="button" className="mk-btn" onClick={() => setConfirmId(null)}>{T('no')}</button>
                    </span>
                  ) : <button type="button" className="mk-btn" disabled={chars.length <= 1} title={chars.length <= 1 ? T('onlyOne') : ''} onClick={() => setConfirmId(c.id)}>{T('del')}</button>}
                </div>
              </li>
            );
          })}
        </ul>
        <label className="mk-field qt-f qt-wide"><span>{T('name')}</span>
          <input value={active.name} maxLength={40} onChange={(e) => update({ name: e.target.value })} />
        </label>
      </section>

      <section className="sr-card cl-box">
        <h3>{T('history')}</h3>
        {delivered.length === 0 ? <p className="mk-muted">{T('noHistory')}</p> : (
          <div className="qt-scroll">
            <table className="ag-table qt-table">
              <thead><tr><th>{T('quest')}</th><th>{T('times')}</th></tr></thead>
              <tbody>
                {delivered.map(({ id, quest, dates }) => (
                  <tr key={id}>
                    <td><b>{quest?.name ?? id}</b> {!quest && <small className="mk-muted">{T('removed')}</small>}</td>
                    <td><small>{dates.length > 1 ? `${dates.length}× · ` : ''}{dates.slice(0, 5).map((d) => new Date(d).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')).join(' · ')}{dates.length > 5 ? ' …' : ''}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
