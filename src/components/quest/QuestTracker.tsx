// Quest Tracker: follow quests, calculate the EXP they give with the active bonuses and plan the deliveries to reach a level.
// Four sections: Quest Database, EXP Calculator, Leveling Planner and My Characters. Official data comes from the administrator.
import { useI18n } from '../../lib/i18n';
import { QUEST_FAKE } from '../../lib/quest/repo';
import { SAMPLE_BANNER } from '../../lib/quest/devSample';
import { Loading } from '../Loading';
import { ExpCalculator } from './ExpCalculator';
import { LevelingPlanner } from './LevelingPlanner';
import { MyCharacters } from './MyCharacters';
import { ProfileBar } from './ProfileBar';
import { QuestDatabase } from './QuestDatabase';
import { QuestProvider, useQuest, type QuestTab } from './QuestContext';

const TXT = {
  title: { pt: 'Quest Tracker', en: 'Quest Tracker' },
  intro: { pt: 'Acompanhe suas quests, veja quanta EXP cada uma dá com os seus bônus e planeje as entregas para chegar ao level que você quer.', en: 'Follow your quests, see how much EXP each gives with your bonuses and plan the deliveries to reach the level you want.' },
  unavailable: { pt: 'O Quest Tracker ainda não foi ativado no banco de dados.', en: 'The Quest Tracker is not enabled in the database yet.' },
  error: { pt: 'Não foi possível carregar os dados. Tente de novo.', en: 'Could not load the data. Try again.' },
  retry: { pt: 'Tentar de novo', en: 'Try again' },
  noData: { pt: 'Ainda não há quests nem tabela de EXP cadastradas. Quando o administrador importar os dados oficiais, tudo aparece aqui.', en: 'There are no quests or EXP table yet. When the administrator imports the official data, everything shows up here.' },
  tabs: {
    pt: { database: 'Banco de Quests', calculator: 'Calculadora de EXP', planner: 'Planejador de Leveling', characters: 'Meus Personagens' },
    en: { database: 'Quest Database', calculator: 'EXP Calculator', planner: 'Leveling Planner', characters: 'My Characters' },
  },
} as const;

const TABS: { id: QuestTab; icon: string }[] = [
  { id: 'database', icon: '📜' },
  { id: 'calculator', icon: '🧮' },
  { id: 'planner', icon: '🗺' },
  { id: 'characters', icon: '👤' },
];

function Inner() {
  const { lang } = useI18n();
  const T = (k: 'title' | 'intro' | 'unavailable' | 'error' | 'retry' | 'noData') => TXT[k][lang];
  const { status, data, tab, setTab, reload } = useQuest();

  const header = (
    <header className="sk-head">
      <h1 className="mk-h1">📜 {T('title')}</h1>
      <p className="mk-muted">{T('intro')}</p>
    </header>
  );
  if (status === 'loading') return <div className="qt-tool">{header}<Loading /></div>;
  if (status === 'unavailable') return <div className="qt-tool">{header}<p className="sk-notice">{T('unavailable')}</p></div>;
  if (status === 'error') return <div className="qt-tool">{header}<p className="ag-warning" role="alert">{T('error')} <button type="button" className="mk-btn" onClick={reload}>{T('retry')}</button></p></div>;

  const empty = !!data && data.quests.length === 0 && data.expLevels.length === 0;
  return (
    <div className="qt-tool">
      {header}
      {QUEST_FAKE && <p className="qt-fake" role="note">⚠ {SAMPLE_BANNER}</p>}
      {empty && <p className="sk-notice">{T('noData')}</p>}
      <ProfileBar />
      <nav className="qt-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden="true">{t.icon}</span> {TXT.tabs[lang][t.id]}
          </button>
        ))}
      </nav>
      {tab === 'database' && <QuestDatabase />}
      {tab === 'calculator' && <ExpCalculator />}
      {tab === 'planner' && <LevelingPlanner />}
      {tab === 'characters' && <MyCharacters />}
    </div>
  );
}

export function QuestTracker() {
  return <QuestProvider><Inner /></QuestProvider>;
}
