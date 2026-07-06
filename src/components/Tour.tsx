import { useLayoutEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

type Tab = 'planner' | 'inventory' | 'optimizer';

interface TourStep {
  tKey: string; // title key
  bKey: string; // body key
  selector?: string; // element to spotlight
  tab?: Tab; // switch to this tab first
}

const STEPS: TourStep[] = [
  { tKey: 'st.tour.s1.t', bKey: 'st.tour.s1.b' },
  { tKey: 'st.tour.s2.t', bKey: 'st.tour.s2.b', selector: '.tabs' },
  { tKey: 'st.tour.s3.t', bKey: 'st.tour.s3.b', selector: '.tree-wrap', tab: 'planner' },
  { tKey: 'st.tour.s4.t', bKey: 'st.tour.s4.b', selector: '.tree-wrap', tab: 'planner' },
  { tKey: 'st.tour.s5.t', bKey: 'st.tour.s5.b', selector: '.tree-legend', tab: 'planner' },
  { tKey: 'st.tour.s6.t', bKey: 'st.tour.s6.b', selector: '.souls-stats', tab: 'planner' },
  { tKey: 'st.tour.s7.t', bKey: 'st.tour.s7.b', selector: '.inv-controls', tab: 'inventory' },
  { tKey: 'st.tour.s8.t', bKey: 'st.tour.s8.b', selector: '.opt-grid', tab: 'optimizer' },
  { tKey: 'st.tour.s9.t', bKey: 'st.tour.s9.b', selector: '.cloudsync', tab: 'planner' },
  { tKey: 'st.tour.s10.t', bKey: 'st.tour.s10.b' },
];

export function Tour({ setTab, onClose }: { setTab: (t: Tab) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  useLayoutEffect(() => {
    if (s.tab) setTab(s.tab);
    const id = setTimeout(() => {
      const el = s.selector ? (document.querySelector(s.selector) as HTMLElement | null) : null;
      if (el) {
        el.scrollIntoView({ block: 'center' });
        requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
      } else {
        setRect(null);
      }
    }, 90);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // If the target is in the top half, put the card at the bottom (and vice-versa).
  const cardPos = !rect ? 'center' : rect.top < window.innerHeight / 2 ? 'bottom' : 'top';

  return (
    <div className="tour">
      <div className="tour-backdrop" />
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : (
        <div className="tour-spot full" />
      )}
      <div className={`tour-card ${cardPos}`}>
        <div className="tour-step-n">{t('st.tour.step', { n: step + 1, total: STEPS.length })}</div>
        <h3>{t(s.tKey)}</h3>
        <p>{t(s.bKey)}</p>
        <div className="tour-nav">
          <button className="btn sm" onClick={onClose}>{t('st.tour.skip')}</button>
          <span className="spacer" />
          {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>{t('st.tour.prev')}</button>}
          <button className="btn sm primary" onClick={() => (last ? onClose() : setStep(step + 1))}>
            {last ? t('st.tour.finish') : t('st.tour.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
