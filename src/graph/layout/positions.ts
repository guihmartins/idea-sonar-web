import type { Core } from 'cytoscape';
export interface Viewport {
  zoom: number;
  pan: { x: number; y: number };
}
export type Positions = Record<string, { x: number; y: number }>;
export function arrangeNew(cy: Core, pinned: Positions) {
  // Só os novos nós são posicionados; expansões não movem posições existentes/fixadas.
  const fresh = cy.nodes().filter((n) => !pinned[n.id()]);
  fresh.forEach((node, i) => {
    const anchor = node
      .neighborhood('node')
      .nodes()
      .filter((n) => !!pinned[n.id()])
      .first();
    const origin = pinned[anchor.id()] ?? { x: 300, y: 220 };
    const angle = i * 2.399963;
    const radius = 110 + 25 * Math.floor(i / 6);
    node.position({
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
    });
  });
}
