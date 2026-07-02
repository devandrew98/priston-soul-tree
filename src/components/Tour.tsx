import { useLayoutEffect, useState } from 'react';

type Tab = 'planner' | 'inventory' | 'optimizer';

interface TourStep {
  title: string;
  body: string;
  selector?: string; // element to spotlight
  tab?: Tab; // switch to this tab first
}

const STEPS: TourStep[] = [
  {
    title: '👋 Bem-vindo!',
    body: 'Este é o planejador da Soul Tree (Fusion Tier) do Priston Tale EU. Vou te mostrar o básico rapidinho — pode pular quando quiser.',
  },
  {
    title: '🗂️ As abas',
    body: 'Você alterna entre: 🌳 Árvore (montar a build), 🎒 Inventário (marcar as souls que você tem) e 🤖 Gerador (a IA monta pra você).',
    selector: '.tabs',
  },
  {
    title: '🌳 Abrindo os nós',
    body: 'Os nós começam bloqueados. Comece pelo topo: clique num nó vazio pra ABRIR (cada nó custa pontos). Clique de novo — ou Backspace — pra fechar.',
    selector: '.tree-wrap',
    tab: 'planner',
  },
  {
    title: '✨ Colocando souls',
    body: 'Duplo-clique num nó (ou o botão "+ soul") pra escolher a soul — é só digitar o nome. Clique = selecionar · Backspace = remover · Ctrl+Z = desfazer · ⇄ = mover a soul de lugar · +/− = nível do nó.',
    selector: '.tree-wrap',
    tab: 'planner',
  },
  {
    title: '🔨 Montagem rápida',
    body: 'Ligue aqui pra montar em sequência: ao adicionar uma soul, o próximo nó abre sozinho. Clique em Finalizar pra parar.',
    selector: '.tree-legend',
    tab: 'planner',
  },
  {
    title: '📊 Atributos & pontos',
    body: 'Este painel mostra os atributos totais da build (PvE/PvP) e seus Pontos de Fusão: quanto já gastou e quanto ainda sobra.',
    selector: '.souls-stats',
    tab: 'planner',
  },
  {
    title: '🎒 Inventário',
    body: 'Marque as souls que você tem e em qual nível (1/2/3). O Gerador usa isso pra montar a melhor build com o que você possui. (As souls que você põe na árvore entram aqui sozinhas.)',
    selector: '.inv-controls',
    tab: 'inventory',
  },
  {
    title: '🤖 Gerador (IA)',
    body: 'Escolha um objetivo — Ataque, Farm, PvP... — e a IA monta a melhor árvore possível. Marque "Considerar todas as souls" pra ver a build ideal e descobrir souls que valem a pena conseguir.',
    selector: '.opt-grid',
    tab: 'optimizer',
  },
  {
    title: '☁️ Salvar & sincronizar',
    body: 'Ative a sincronização pra ganhar um código de jogador e acessar seu inventário e builds em qualquer aparelho. O botão 💾 Salvar guarda tudo, e 🔗 Compartilhar gera um link/código da build.',
    selector: '.cloudsync',
    tab: 'planner',
  },
  {
    title: '✅ Pronto!',
    body: 'É só isso pra começar. Explore à vontade — e pra rever este tutorial é só clicar em "❓ Tutorial" lá no topo.',
  },
];

export function Tour({ setTab, onClose }: { setTab: (t: Tab) => void; onClose: () => void }) {
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
        <div className="tour-step-n">Passo {step + 1} de {STEPS.length}</div>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="tour-nav">
          <button className="btn sm" onClick={onClose}>Pular</button>
          <span className="spacer" />
          {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>← Anterior</button>}
          <button className="btn sm primary" onClick={() => (last ? onClose() : setStep(step + 1))}>
            {last ? 'Concluir ✓' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  );
}
