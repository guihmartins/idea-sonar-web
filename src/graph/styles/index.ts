import type { StylesheetJson, Css, EdgeSingular, Position } from 'cytoscape';
import {
  highlightColor,
  labelColor,
  nodeFillColor,
  surfaceColor,
} from './palette';
/**
 * A escala visual mora aqui, não no adapter: `elements()` continua entregando
 * `shape`/`size`/`width` crus (ver testes de `graph.test.ts`), e o desenho
 * decide o quanto disso vira pixel. Rodada 3 (fidelidade ao Atlas): o nó é
 * uma etiqueta retangular completa, de canto reto — símbolo pequeno + texto —
 * como no mapa de referência; a forma geométrica antiga (elipse/hexágono/
 * losango/retângulo crus) vira só o glifo prefixado ao rótulo, não mais o
 * contorno do nó.
 */
type Element = { data: (key: string) => unknown };
const glyphs: Record<string, string> = {
  ellipse: '•',
  hexagon: '≡',
  diamond: '◇',
  rectangle: '□',
};
const nodeLabel = (node: Element) =>
  `${glyphs[String(node.data('shape'))] ?? '•'} ${String(node.data('label'))}`;
const edgeWidth = (edge: Element) =>
  0.7 + (Number(edge.data('width')) - 1) * 0.38;
/** Soma estável (não aleatória) dos códigos do id: decide o lado da pequena
 * variação de uma relação sozinha e o lado do meio de um grupo ímpar. */
export function hashSign(id: string): boolean {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1)
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (hash & 1) === 0;
}
/**
 * `parallelEdges()` inclui as duas direções entre o mesmo par (A→B e B→A).
 * O deslocamento perpendicular abaixo é medido em relação ao vetor
 * origem→destino DESTA aresta; para duas arestas com o mesmo par de pontas
 * em direções opostas, esse vetor se inverte, o que já inverte o lado do
 * desenho sozinho. `directionSign` cancela essa inversão para que o slot
 * (abaixo) decida o lado absoluto, não a direção de cada relação — senão
 * duas relações paralelas em sentidos opostos podem cair na mesma curva.
 */
export function directionSign(edge: EdgeSingular): number {
  return edge.source().id() < edge.target().id() ? 1 : -1;
}
/** Posição da aresta entre suas paralelas (mesmo par, qualquer direção),
 * centrada em 0 — uma relação sozinha cai no slot 0. */
export function parallelSlot(edge: EdgeSingular): number {
  const siblings = edge
    .parallelEdges()
    .toArray()
    .sort((a, b) => (a.id() < b.id() ? -1 : a.id() > b.id() ? 1 : 0));
  const count = siblings.length;
  const index = siblings.findIndex((e) => e.id() === edge.id());
  return (index < 0 ? 0 : index) - (count - 1) / 2;
}
const fanStep = 26;
/**
 * Deslocamento perpendicular para separar relações paralelas; uma relação
 * sozinha ganha só uma variação pequena e estável (não precisa separar de
 * nada — a curva em S abaixo já garante que nunca fica reta).
 */
function fanOffset(edge: EdgeSingular): number {
  const slot = parallelSlot(edge);
  if (slot !== 0) return directionSign(edge) * slot * fanStep;
  return (hashSign(edge.id()) ? 1 : -1) * 6;
}
interface Bend {
  c1: Position;
  c2: Position;
}
/**
 * Gesto da curva de referência (protótipo Atlas, função `desenhar()`):
 * relação predominantemente vertical sai/entra na VERTICAL dos nós; relação
 * predominantemente horizontal sai/entra na HORIZONTAL — nunca na diagonal
 * direta do centro ao centro. `c1`/`c2` são pontos ABSOLUTOS (no espaço do
 * modelo), um alinhado à origem e outro ao destino; a cadeia resultante tem
 * tangente quase reta em cada ponta e dobra só no meio, como no HTML
 * original (ali é uma única cúbica; aqui vira uma cadeia de 2 quadráticas
 * com o mesmo gesto — ver `toWeightDistance`/`edgeControlPoints`).
 */
function bendControlPoints(
  source: Position,
  target: Position,
  sourceSize: Position,
  targetSize: Position,
): Bend {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const horizontalGap = Math.abs(dx) - (sourceSize.x + targetSize.x) / 2;
  const verticalGap = Math.abs(dy) - (sourceSize.y + targetSize.y) / 2;
  const verticalDominant =
    verticalGap > 0 &&
    (horizontalGap <= 0 || Math.abs(dy) > Math.abs(dx) * 1.25);
  const sourceHalf = (verticalDominant ? sourceSize.y : sourceSize.x) / 2;
  const targetHalf = (verticalDominant ? targetSize.y : targetSize.x) / 2;
  const length = verticalDominant ? Math.abs(dy) : Math.abs(dx);
  const sourceBend = Math.max(sourceHalf + 16, length * 0.3);
  const targetBend = Math.max(targetHalf + 16, length * 0.3);
  const sign = verticalDominant ? Math.sign(dy) || 1 : dx >= 0 ? 1 : -1;
  return verticalDominant
    ? {
        c1: { x: source.x, y: source.y + sign * sourceBend },
        c2: { x: target.x, y: target.y - sign * targetBend },
      }
    : {
        c1: { x: source.x + sign * sourceBend, y: source.y },
        c2: { x: target.x - sign * targetBend, y: target.y },
      };
}
/**
 * Converte um ponto ABSOLUTO (`c1`/`c2`) para o par (peso, distância) que o
 * Cytoscape usa para posicionar pontos de controle em `unbundled-bezier`:
 * peso = fração ao longo da corda origem→destino, distância = deslocamento
 * perpendicular a essa corda nessa fração (ver `findMidptPtsEtc` em
 * `edge-control-points.mjs` do pacote `cytoscape`). Qualquer ponto do plano
 * tem um par (peso, distância) correspondente — é só projeção numa base
 * ortonormal (tangente, perpendicular) da corda.
 */
function toWeightDistance(
  source: Position,
  target: Position,
  point: Position,
): { weight: number; distance: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const tangentX = dx / length;
  const tangentY = dy / length;
  const perpX = -tangentY;
  const perpY = tangentX;
  const rx = point.x - source.x;
  const ry = point.y - source.y;
  return {
    weight: (rx * tangentX + ry * tangentY) / length,
    distance: rx * perpX + ry * perpY,
  };
}
/**
 * 2 pontos de controle por aresta: o gesto em S de `bendControlPoints`,
 * deslocado perpendicularmente por `fanOffset` para separar relações
 * paralelas sem perder o formato. Com 2 controles reais, `flow.ts` (cadeia
 * de quadráticas com ponto médio entre controles, igual ao Cytoscape)
 * percorre exatamente este traçado — não uma polilinha entre eles.
 */
export function edgeControlPoints(edge: EdgeSingular): {
  weights: number[];
  distances: number[];
} {
  const source = edge.source().position();
  const target = edge.target().position();
  const sourceNode = edge.source();
  const targetNode = edge.target();
  const { c1, c2 } = bendControlPoints(
    source,
    target,
    { x: sourceNode.outerWidth(), y: sourceNode.outerHeight() },
    { x: targetNode.outerWidth(), y: targetNode.outerHeight() },
  );
  const length = Math.hypot(target.x - source.x, target.y - source.y) || 1;
  const perpX = -(target.y - source.y) / length;
  const perpY = (target.x - source.x) / length;
  const offset = fanOffset(edge);
  const p1 = toWeightDistance(source, target, {
    x: c1.x + perpX * offset,
    y: c1.y + perpY * offset,
  });
  const p2 = toWeightDistance(source, target, {
    x: c2.x + perpX * offset,
    y: c2.y + perpY * offset,
  });
  return {
    weights: [p1.weight, p2.weight],
    distances: [p1.distance, p2.distance],
  };
}
export const graphStyle: StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: nodeLabel,
      shape: 'rectangle',
      width: 'label',
      height: 'label',
      padding: '8px',
      'background-color': nodeFillColor,
      'background-opacity': 1,
      'border-width': 1.25,
      // Contexto não vira cor de borda (ficava pesado/competindo com a
      // seleção): continua disponível na legenda e nos filtros. O filete do
      // nó é neutro e fino, como na referência.
      'border-color': '#c9c3b2',
      color: labelColor,
      'font-family': 'DM Sans Variable, DM Sans, system-ui, sans-serif',
      'font-size': 13,
      'font-weight': 500,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'ellipsis',
      'text-max-width': '180px',
      'min-zoomed-font-size': 9,
    },
  },
  {
    selector: 'edge',
    style: {
      width: edgeWidth,
      'line-style': (edge) => edge.data('line') as Css.LineStyle,
      'target-arrow-shape': (edge) => edge.data('arrow') as Css.ArrowShape,
      'curve-style': 'unbundled-bezier',
      'edge-distances': 'node-position',
      'control-point-distances': (edge) =>
        edgeControlPoints(edge as unknown as EdgeSingular).distances,
      'control-point-weights': (edge) =>
        edgeControlPoints(edge as unknown as EdgeSingular).weights,
      'line-color': '#8b8f7f',
      'target-arrow-color': '#8b8f7f',
      'arrow-scale': 0.7,
    },
  },
  // Vizinho da seleção: ganha peso de traço, sem cor própria de contexto —
  // o filete some entre os nós para não competir com a seleção ultramarina.
  { selector: '.neighbor', style: { 'border-width': 1.5 } },
  // Fora da vizinhança: fica no desenho, mas recua.
  { selector: '.faded', style: { opacity: 0.58 } },
  {
    selector: 'node:selected',
    style: {
      'border-color': highlightColor,
      'background-color': highlightColor,
      'background-opacity': 1,
      color: surfaceColor,
      'font-weight': 600,
      'z-index': 10,
    },
  },
  /**
   * Toda relação conectada ao nó selecionado fica ultramarina — não só a
   * aresta tocada diretamente. A classe é aplicada pelo GraphCanvas (junto
   * com `.neighbor`/`.faded`), não pelo pseudo-estado `:selected` do
   * Cytoscape, que só cobriria o fio clicado.
   */
  {
    selector: 'edge.selected-edge',
    style: {
      width: (edge: Element) => edgeWidth(edge) + 0.3,
      'line-color': highlightColor,
      'target-arrow-color': highlightColor,
      'arrow-scale': 0.65,
      'z-index': 10,
    },
  },
];
