// The active character at the top of the tool: level, EXP percentage (with decimals), the progress bar and the bonuses panel.
import { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { configuredTotal } from '../../lib/quest/bonus';
import { useQuest } from './QuestContext';
import { fmtPct, parseDecimal } from './format';

const TXT = {
  character: { pt: 'Personagem', en: 'Character' },
  level: { pt: 'Level atual', en: 'Current level' },
  exp: { pt: 'EXP atual (%)', en: 'Current EXP (%)' },
  progress: { pt: 'Progresso no level', en: 'Level progress' },
  expHint: { pt: 'Pode usar decimais, ex.: 72,5', en: 'Decimals allowed, e.g. 72.5' },
  badPct: { pt: 'Use um valor de 0 a menos de 100.', en: 'Use a value from 0 to under 100.' },
  noLevel: { pt: 'A tabela de EXP ainda não tem o level', en: 'The EXP table does not have level' },
  saved: { pt: 'Salvo', en: 'Saved' },
  saving: { pt: 'Salvando…', en: 'Saving…' },
  saveError: { pt: 'Não foi possível salvar', en: 'Could not save' },
  where: { pt: 'na sua conta', en: 'in your account' },
  whereLocal: { pt: 'neste navegador (entre na conta para salvar nela)', en: 'in this browser (sign in to save in your account)' },
  bonuses: { pt: 'Bônus de EXP ativos', en: 'Active EXP bonuses' },
  bonusTotal: { pt: 'Total configurado', en: 'Configured total' },
  additive: { pt: 'fórmula aditiva', en: 'additive formula' },
  multiplicative: { pt: 'fórmula multiplicativa', en: 'multiplicative formula' },
  appliesTo: { pt: 'Vale para', en: 'Applies to' },
  yourPct: { pt: 'Seu percentual (%)', en: 'Your percentage (%)' },
  noBonuses: { pt: 'Nenhum bônus configurado pelo administrador.', en: 'No bonuses set up by the administrator.' },
  all: { pt: 'todas as categorias', en: 'every category' },
  simNote: { pt: 'Simulações nunca alteram o seu personagem real.', en: 'Simulations never change your real character.' },
} as const;

export function ProfileBar() {
  const { lang } = useI18n();
  const T = (k: keyof typeof TXT) => TXT[k][lang];
  const { active, update, data, table, saveState, storage, settings } = useQuest();
  const [lvl, setLvl] = useState('');
  const [pct, setPct] = useState('');
  // What the player is typing in the manual bonus fields: keeps "21," and "21,50" as typed while the number is saved on every key.
  const [manualText, setManualText] = useState<Record<string, string>>({});
  useEffect(() => { if (active) { setLvl(String(active.level)); setPct(String(active.expPct).replace('.', lang === 'pt' ? ',' : '.')); setManualText({}); } }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!active) return null;

  const pctNum = parseDecimal(pct);
  const pctOk = pct.trim() !== '' && Number.isFinite(pctNum) && pctNum >= 0 && pctNum < 100;
  const levelMissing = !!table && table.levels.length > 0 && table.needed(active.level) === null;
  const catName = (id: string) => data?.categories.find((c) => c.id === id)?.name ?? id;
  const bonuses = [...(data?.bonuses ?? [])].filter((b) => b.enabled).sort((a, b) => a.sort - b.sort);
  const total = configuredTotal(bonuses, active.bonuses, settings.combineMode);

  return (
    <section className="sr-card qt-profile">
      <div className="qt-profile-row qt-top">
        <label className="mk-field qt-f"><span>{T('level')}</span>
          <input type="text" inputMode="numeric" value={lvl} onFocus={(e) => e.target.select()}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); setLvl(v); const n = Number(v); if (n >= 1 && n <= 999) update({ level: n }); }} />
        </label>
        <label className="mk-field qt-f"><span>{T('exp')}</span>
          <input type="text" inputMode="decimal" value={pct} aria-invalid={!pctOk} onFocus={(e) => e.target.select()}
            onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, '').slice(0, 10); setPct(v); const n = parseDecimal(v); if (v.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 100) update({ expPct: n }); }} />
          <small>{pctOk ? T('expHint') : T('badPct')}</small>
        </label>
        <div className="mk-field qt-bar-wrap"><span>{T('progress')}</span>
          <div className="qt-barbox"><div className="qt-bar" role="img" aria-label={fmtPct(active.expPct, lang)}><i style={{ width: `${Math.min(100, active.expPct)}%` }} /></div></div>
          <small className="mk-muted">Level {active.level} · {fmtPct(active.expPct, lang)}</small>
        </div>
        <small className={`qt-save ${saveState}`}>
          {saveState === 'saving' ? T('saving') : saveState === 'saved' ? `✔ ${T('saved')}` : saveState === 'error' ? T('saveError') : ''} {saveState === 'idle' ? '' : `· ${storage === 'account' ? T('where') : T('whereLocal')}`}
        </small>
      </div>
      {levelMissing && <p className="sk-notice">{T('noLevel')} {active.level}.</p>}

      <details className="qt-bonus" open>
        <summary>{T('bonuses')} <b className="qt-bonus-total">{total > 0 ? `+${fmtPct(total, lang)}` : '—'}</b></summary>
        {bonuses.length === 0 ? <p className="mk-muted">{T('noBonuses')}</p> : (
          <>
            <ul className="qt-bonus-list">
              {bonuses.map((b) => {
                const choice = active.bonuses[b.id];
                const scope = b.appliesTo.length ? b.appliesTo.map(catName).join(', ') : T('all');
                return (
                  <li key={b.id} title={`${T('appliesTo')}: ${scope}`}>
                    {b.kind === 'toggle' ? (
                      <label className="qt-check">
                        <input type="checkbox" checked={!!choice?.on} onChange={(e) => update((c) => ({ bonuses: { ...c.bonuses, [b.id]: { on: e.target.checked } } }))} />
                        <span>{b.name} <em>(+{fmtPct(b.percent, lang)})</em></span>
                      </label>
                    ) : (
                      <label className="qt-check">
                        <span>{b.name}</span>
                        <input className="qt-pct" type="text" inputMode="decimal" placeholder="0" aria-label={`${b.name}: ${T('yourPct')}`}
                          value={manualText[b.id] ?? (choice?.percent === undefined ? '' : String(choice.percent).replace('.', lang === 'pt' ? ',' : '.'))} onFocus={(e) => e.target.select()}
                          onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*?)[.,]/g, '$1').slice(0, 9); setManualText((m) => ({ ...m, [b.id]: v })); const n = parseDecimal(v); update((c) => ({ bonuses: { ...c.bonuses, [b.id]: { on: Number.isFinite(n) && n > 0, percent: Number.isFinite(n) ? n : 0 } } })); }} />
                        <em>%</em>
                      </label>
                    )}
                    <small className="mk-muted">{scope}</small>
                  </li>
                );
              })}
            </ul>
            <p className="mk-muted">{T('bonusTotal')}: <b>{total > 0 ? `+${fmtPct(total, lang)}` : '0%'}</b> · {settings.combineMode === 'additive' ? T('additive') : T('multiplicative')}. {T('simNote')}</p>
          </>
        )}
      </details>
    </section>
  );
}
