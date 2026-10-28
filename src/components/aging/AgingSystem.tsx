// Aging system shell: the cost calculator and the item comparison, as two tabs of the same tool.
import { useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { AgingCalculator } from './AgingCalculator';
import { ItemCompare } from './ItemCompare';

const TABS = [
  { id: 'calc', pt: '⚒ Calculadora de Aging', en: '⚒ Aging calculator' },
  { id: 'compare', pt: '⚖ Comparar itens', en: '⚖ Compare items' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function AgingSystem() {
  const { lang } = useI18n();
  const [tab, setTab] = useState<TabId>('calc');
  return (
    <>
      <nav className="qt-tabs ag-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t[lang]}</button>
        ))}
      </nav>
      {tab === 'calc' ? <AgingCalculator /> : <ItemCompare />}
    </>
  );
}
