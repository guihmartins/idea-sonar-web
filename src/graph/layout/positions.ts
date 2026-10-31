import type { Core, NodeSingular } from 'cytoscape';
export interface Viewport {
  zoom: number;
  pan: { x: number; y: number };
}
export type Positions = Record<string, { x: number; y: number }>;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const rowHeight = 34;
/**
 * Estimativa sem medir texto real (o nó ainda não está renderizado): a
 * etiqueta Atlas (rodada 3) é um bloco retangular com glifo + texto
 * CENTRADOS (`text-halign/valign: 'center'`, `width/height: 'label'`,
 * `padding: 7`), não mais sinal à esquerda com rótulo à direita — a caixa de
 * colisão cobre a largura aproximada do glifo+texto mais o padding dos dois
 * lados. Erra para mais, não para menos — melhor um pouco de respiro extra
 * do que rótulos colidindo.
 */
function estimateLabelBox(
  node: NodeSingular,
  center: { x: number; y: number },
): Box {
  const label = String(node.data('label') ?? '');
  // +2 caracteres cobrem o glifo prefixado (ex.: "• ") somado ao rótulo.
  const w = Math.max(node.outerWidth(), (label.length + 2) * 9 + 16);
  return {
    x: center.x - w / 2,
    y: center.y - Math.max(rowHeight, node.outerHeight()) / 2,
    w,
    h: Math.max(rowHeight, node.outerHeight()),
  };
}
function overlaps(a: Box, b: Box): boolean {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}
export function arrangeNew(cy: Core, pinned: Positions) {
  // Só os novos nós são posicionados; expansões não movem posições existentes/fixadas.
  const fresh = cy.nodes().filter((n) => !pinned[n.id()]);
  // Sem nó fixado como âncora (primeira raiz): usa o centro real do canvas
  // no sistema de coordenadas do modelo, não um ponto fixo arbitrário — o
  // contêiner muda de tamanho conforme o layout da tela.
  const zoom = cy.zoom() || 1;
  const pan = cy.pan() || { x: 0, y: 0 };
  const canvasCenter = {
    x: (cy.width() / 2 - pan.x) / zoom,
    y: (cy.height() / 2 - pan.y) / zoom,
  };
  // Nós já fixados entram na checagem de colisão: um rótulo novo não pode
  // nascer em cima de um rótulo existente, mesmo que os sinais não se toquem.
  const placed: Box[] = cy
    .nodes()
    .filter((n) => !!pinned[n.id()])
    .map((n) =>
      estimateLabelBox(
        n as unknown as NodeSingular,
        pinned[n.id()] as { x: number; y: number },
      ),
    );
  fresh.forEach((node, i) => {
    const anchor = node
      .neighborhood('node')
      .nodes()
      .filter((n) => !!pinned[n.id()])
      .first();
    const origin = pinned[anchor.id()] ?? canvasCenter;
    let chosen = { x: origin.x, y: origin.y };
    const maxAttempts = 48;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const slot = i + attempt * fresh.length;
      const angle = slot * 2.399963;
      const radius = 130 + 36 * Math.floor(slot / 6);
      const candidate = {
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius,
      };
      const box = estimateLabelBox(node, candidate);
      if (
        attempt === maxAttempts - 1 ||
        !placed.some((p) => overlaps(p, box))
      ) {
        chosen = candidate;
        placed.push(box);
        break;
      }
    }
    node.position(chosen);
  });
}
