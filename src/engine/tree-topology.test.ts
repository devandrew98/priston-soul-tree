// Trava a topologia da árvore conforme o JOGO: a barra de baixo é PARTIDA —
// esquerda (ataque) e direita (defesa) não se conectam à coluna do meio
// embaixo. Antes existiam arestas h2_2—h2_3 e h2_3—h2_4 que deixavam a IA
// "atravessar por baixo", criando builds impossíveis no jogo.
import { describe, it, expect } from 'vitest';
import { TREE_EDGES } from '../lib/tree';
import { unlockedFor } from '../lib/graph';

const hasEdge = (a: string, b: string) =>
  TREE_EDGES.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));

describe('Topologia da árvore (barra de baixo partida, como no jogo)', () => {
  it('a coluna do meio NÃO se liga aos lados na barra de baixo', () => {
    expect(hasEdge('h2_2', 'h2_3')).toBe(false);
    expect(hasEdge('h2_3', 'h2_4')).toBe(false);
  });

  it('os segmentos laterais da barra de baixo continuam existindo', () => {
    expect(hasEdge('h2_0', 'h2_1')).toBe(true);
    expect(hasEdge('h2_1', 'h2_2')).toBe(true);
    expect(hasEdge('h2_4', 'h2_5')).toBe(true);
    expect(hasEdge('h2_5', 'h2_6')).toBe(true);
  });

  it('o meio de baixo só é alcançável pela espinha vertical', () => {
    // Abrir só bv3_9 (pvp lendária do fundo) força o caminho todo pela espinha.
    const open = unlockedFor(['bv3_9']);
    for (const id of ['t1', 't2', 'h1_3', 'cv_3', 'cv_4', 'cv_5', 'cv_6', 'h2_3', 'bv3_8', 'bv3_9']) {
      expect(open.has(id)).toBe(true);
    }
    // ...e NÃO passa pelos lados da barra de baixo.
    expect(open.has('h2_2')).toBe(false);
    expect(open.has('h2_4')).toBe(false);
  });

  it('lado direito de baixo vem pelo trilho da direita, não pelo meio', () => {
    const open = unlockedFor(['bv4_9']);
    // caminho: t1..h1_6 (barra de cima) → rv_3..rv_6 → h2_6 → h2_5 → h2_4 → bv4_8 → bv4_9
    expect(open.has('h2_6')).toBe(true);
    expect(open.has('h2_5')).toBe(true);
    expect(open.has('h2_3')).toBe(false); // nunca pelo meio de baixo
  });
});
