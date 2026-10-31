import cytoscape from 'cytoscape';
import type { Core } from 'cytoscape';
import { describe, expect, it } from 'vitest';
import { arrangeNew } from '../../src/graph/layout/positions';
import type { Positions } from '../../src/graph/layout/positions';

// Reimplementação da fórmula de `estimateLabelBox` (privada em positions.ts)
// só para montar a caixa de colisão esperada e checar sobreposição nos testes.
function box(label: string, center: { x: number; y: number }) {
  const w = (label.length + 2) * 7 + 14;
  const h = 28;
  return { x: center.x - w / 2, y: center.y - h / 2, w, h };
}
function overlaps(a: ReturnType<typeof box>, b: ReturnType<typeof box>) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}
function buildCy(
  nodeDefs: { id: string; label: string }[],
  edgeDefs: [string, string][],
): Core {
  const cy = cytoscape({ headless: true });
  cy.add(
    nodeDefs.map((n) => ({
      group: 'nodes' as const,
      data: { id: n.id, label: n.label },
    })),
  );
  cy.add(
    edgeDefs.map(([source, target], i) => ({
      group: 'edges' as const,
      data: { id: `e${i}-${source}-${target}`, source, target },
    })),
  );
  return cy;
}

describe('arrangeNew', () => {
  it('não deixa dois nós novos nascidos do mesmo nó fixado com caixas sobrepostas', () => {
    const cy = buildCy(
      [
        { id: 'root', label: 'Raiz fixada' },
        { id: 'n1', label: 'Novo ponto um' },
        { id: 'n2', label: 'Novo ponto dois' },
      ],
      [
        ['root', 'n1'],
        ['root', 'n2'],
      ],
    );
    const pinned: Positions = { root: { x: 0, y: 0 } };
    arrangeNew(cy, pinned);
    const b1 = box('Novo ponto um', cy.getElementById('n1').position());
    const b2 = box('Novo ponto dois', cy.getElementById('n2').position());
    expect(overlaps(b1, b2)).toBe(false);
  });

  it('nós já fixados entram na checagem de colisão: um novo nó não nasce sobre a caixa de um fixado', () => {
    const cy = buildCy(
      [
        { id: 'root', label: 'Raiz' },
        { id: 'fixedNeighbor', label: 'Vizinho fixado com rótulo bem longo' },
        { id: 'n1', label: 'Novo' },
      ],
      [['root', 'n1']],
    );
    // `fixedNeighbor` fica deliberadamente na posição onde a primeira
    // tentativa de `n1` cairia (ângulo 0, raio 130 a partir da raiz),
    // forçando a checagem de colisão a descartar esse candidato.
    const pinned: Positions = {
      root: { x: 0, y: 0 },
      fixedNeighbor: { x: 130, y: 0 },
    };
    arrangeNew(cy, pinned);
    const newBox = box('Novo', cy.getElementById('n1').position());
    const fixedBox = box(
      'Vizinho fixado com rótulo bem longo',
      pinned.fixedNeighbor as { x: number; y: number },
    );
    expect(overlaps(newBox, fixedBox)).toBe(false);
  });

  it('um rótulo bem mais longo produz uma caixa mais larga que um rótulo curto', () => {
    const shortBox = box('Oi', { x: 0, y: 0 });
    const longBox = box(
      'Um rótulo bastante mais longo do que o anterior, de verdade',
      { x: 0, y: 0 },
    );
    expect(longBox.w).toBeGreaterThan(shortBox.w);
  });
});
