import { describe, expect, it } from 'vitest';
import cytoscape from 'cytoscape';
import type { Core, EdgeSingular } from 'cytoscape';
import type { Catalog, Node, Relation } from '../../src/api/domain';
import { elements } from '../../src/graph/adapter/elements';
import {
  directionSign,
  edgeControlPoints,
  graphStyle,
  hashSign,
  parallelSlot,
} from '../../src/graph/styles';
import {
  contestedColor,
  contextColors,
  edgeColor,
  highlightColor,
  labelColor,
  neutralColor,
  nodeFillColor,
  surfaceColor,
} from '../../src/graph/styles/palette';

interface Spot {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
}
interface Link {
  id: string;
  source: string;
  target: string;
}
/** Cytoscape de verdade, sem tela: posições e tamanhos exatos pelos dados. */
function build(spots: Spot[], links: Link[]): Core {
  return cytoscape({
    headless: true,
    // Sem styleEnabled o Cytoscape ignora o estilo (tamanhos viram 1) e, sem
    // preset, o layout padrão zera as posições dadas.
    styleEnabled: true,
    layout: { name: 'preset' },
    style: [
      { selector: 'node', style: { width: 'data(w)', height: 'data(h)' } },
    ],
    elements: [
      ...spots.map((s) => ({
        group: 'nodes' as const,
        data: { id: s.id, w: s.w ?? 100, h: s.h ?? 34 },
        position: { x: s.x, y: s.y },
      })),
      ...links.map((l) => ({ group: 'edges' as const, data: l })),
    ],
  });
}
const edgeOf = (cy: Core, id: string) =>
  cy.getElementById(id) as unknown as EdgeSingular;
/** Inverte (peso, distância) para o ponto absoluto no espaço do modelo. */
function absolute(
  source: { x: number; y: number },
  target: { x: number; y: number },
  weight: number,
  distance: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  return {
    x: source.x + weight * dx + distance * (-dy / length),
    y: source.y + weight * dy + distance * (dx / length),
  };
}
function curve(cy: Core, id: string) {
  const edge = edgeOf(cy, id);
  const { weights, distances } = edgeControlPoints(edge);
  const source = edge.source().position();
  const target = edge.target().position();
  return [0, 1].map((i) =>
    absolute(source, target, weights[i] ?? NaN, distances[i] ?? NaN),
  );
}
function expectPoint(
  actual: { x: number; y: number } | undefined,
  x: number,
  y: number,
) {
  expect(actual?.x).toBeCloseTo(x, 6);
  expect(actual?.y).toBeCloseTo(y, 6);
}

describe('hashSign', () => {
  it('é par quando a soma dos códigos do id é par, de forma estável', () => {
    expect(hashSign('')).toBe(true);
    expect(hashSign('a')).toBe(false);
    expect(hashSign('b')).toBe(true);
    expect(hashSign('ab')).toBe(false);
    expect(hashSign('abc')).toBe(true);
    expect(hashSign('e1')).toBe(true);
    expect(hashSign('e2')).toBe(false);
    // Ids com mais de dois caracteres, como os UUIDs reais, também dependem só
    // da paridade da soma dos códigos.
    expect(hashSign('r1')).toBe(false);
    expect(hashSign('r2')).toBe(true);
    expect(hashSign('rel-1')).toBe(false);
    expect(hashSign('rel-2')).toBe(true);
    expect(hashSign('edge-1')).toBe(false);
    expect(hashSign('abcd')).toBe(true);
    expect(hashSign('abc')).toBe(hashSign('abc'));
  });
});

describe('directionSign e parallelSlot', () => {
  it('directionSign depende só da ordem dos ids das pontas', () => {
    const cy = build(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 },
      ],
      [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'ba', source: 'b', target: 'a' },
        { id: 'aa', source: 'a', target: 'a' },
      ],
    );
    expect(directionSign(edgeOf(cy, 'ab'))).toBe(1);
    expect(directionSign(edgeOf(cy, 'ba'))).toBe(-1);
    expect(directionSign(edgeOf(cy, 'aa'))).toBe(-1);
  });

  it('parallelSlot ordena por id e centra em zero, incluindo as duas direções', () => {
    const cy = build(
      [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 100, y: 0 },
        { id: 'n3', x: 200, y: 0 },
      ],
      [
        { id: 'z', source: 'n1', target: 'n2' },
        { id: 'a', source: 'n1', target: 'n2' },
        { id: 'm', source: 'n2', target: 'n1' },
        { id: 'solo', source: 'n2', target: 'n3' },
      ],
    );
    expect(parallelSlot(edgeOf(cy, 'a'))).toBe(-1);
    expect(parallelSlot(edgeOf(cy, 'm'))).toBe(0);
    expect(parallelSlot(edgeOf(cy, 'z'))).toBe(1);
    expect(parallelSlot(edgeOf(cy, 'solo'))).toBe(0);
  });

  it('com quatro paralelas os slots são -1,5, -0,5, 0,5 e 1,5', () => {
    const cy = build(
      [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 100, y: 0 },
      ],
      ['d', 'b', 'c', 'a'].map((id) => ({
        id,
        source: 'n1',
        target: 'n2',
      })),
    );
    expect(
      ['a', 'b', 'c', 'd'].map((id) => parallelSlot(edgeOf(cy, id))),
    ).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });

  it('trata uma aresta ausente da própria lista de paralelas como índice 0', () => {
    const sibling = (id: string) => ({ id: () => id });
    const edge = {
      id: () => 'x',
      parallelEdges: () => ({ toArray: () => [sibling('a'), sibling('b')] }),
    } as unknown as EdgeSingular;
    expect(parallelSlot(edge)).toBe(-0.5);
  });
});

describe('edgeControlPoints', () => {
  it('relação horizontal sozinha: dois controles no eixo, com variação de 6px pelo id', () => {
    // 'a' tem soma de códigos ímpar (lado -6); 'b' é par (lado +6).
    const solo = (id: string) =>
      build(
        [
          { id: 's', x: 100, y: 50 },
          { id: 't', x: 400, y: 50 },
        ],
        [{ id, source: 's', target: 't' }],
      );
    const lower = edgeControlPoints(edgeOf(solo('a'), 'a'));
    expect(lower.weights[0]).toBeCloseTo(0.3, 6);
    expect(lower.weights[1]).toBeCloseTo(0.7, 6);
    expect(lower.distances[0]).toBeCloseTo(-6, 6);
    expect(lower.distances[1]).toBeCloseTo(-6, 6);
    const upper = edgeControlPoints(edgeOf(solo('b'), 'b'));
    expect(upper.distances[0]).toBeCloseTo(6, 6);
    expect(upper.distances[1]).toBeCloseTo(6, 6);
    expect(lower.weights).toHaveLength(2);
    expect(lower.distances).toHaveLength(2);
  });

  // [descrição, origem, destino, c1 esperado, c2 esperado] antes da variação.
  // Todos com id 'b' (lado +6) e nós 100x34 salvo indicação.
  const bends: [string, Spot, Spot, [number, number], [number, number]][] = [
    [
      'horizontal para a direita',
      { id: 's', x: 100, y: 50 },
      { id: 't', x: 400, y: 50 },
      [190, 50],
      [310, 50],
    ],
    [
      'horizontal curta: a curva sai da borda do nó (metade + 16)',
      { id: 's', x: 10, y: 20 },
      { id: 't', x: 140, y: 20 },
      [76, 20],
      [74, 20],
    ],
    [
      'horizontal para a esquerda',
      { id: 's', x: 400, y: 50 },
      { id: 't', x: 100, y: 50 },
      [310, 50],
      [190, 50],
    ],
    [
      'vertical para baixo',
      { id: 's', x: 60, y: 10 },
      { id: 't', x: 60, y: 210 },
      [60, 70],
      [60, 150],
    ],
    [
      'vertical para cima',
      { id: 's', x: 60, y: 210 },
      { id: 't', x: 60, y: 10 },
      [60, 150],
      [60, 70],
    ],
    [
      'diagonal mais vertical que 1,25 vira vertical',
      { id: 's', x: 20, y: 30 },
      { id: 't', x: 320, y: 430 },
      [20, 150],
      [320, 310],
    ],
    [
      'diagonal de 45 graus continua horizontal',
      { id: 's', x: 20, y: 30 },
      { id: 't', x: 320, y: 330 },
      [110, 30],
      [230, 330],
    ],
    [
      'exatamente 1,25 vezes ainda é horizontal',
      { id: 's', x: 20, y: 30 },
      { id: 't', x: 320, y: 405 },
      [110, 30],
      [230, 405],
    ],
    [
      'sem folga horizontal mas com folga vertical: vertical',
      { id: 's', x: 10, y: 20 },
      { id: 't', x: 110, y: 70 },
      [10, 53],
      [110, 37],
    ],
    [
      'sem folga vertical (exatamente zero): horizontal, e dx = 0 conta como direita',
      { id: 's', x: 10, y: 20 },
      { id: 't', x: 10, y: 54 },
      [76, 20],
      [-56, 54],
    ],
    [
      'nós sobrepostos nos dois eixos: horizontal',
      { id: 's', x: 10, y: 20 },
      { id: 't', x: 60, y: 30 },
      [76, 20],
      [-6, 30],
    ],
    [
      'alturas diferentes entram na folga vertical',
      { id: 's', x: 10, y: 20, h: 60 },
      { id: 't', x: 10, y: 50, h: 20 },
      [76, 20],
      [-56, 50],
    ],
    [
      'larguras diferentes: cada ponta usa a própria metade',
      { id: 's', x: 10, y: 20, w: 200, h: 60 },
      { id: 't', x: 210, y: 20, w: 40, h: 20 },
      [126, 20],
      [150, 20],
    ],
    [
      'folga horizontal soma as metades das larguras',
      { id: 's', x: 10, y: 20, w: 40 },
      { id: 't', x: 110, y: 70, w: 40 },
      [46, 20],
      [74, 70],
    ],
  ];
  it.each(bends)('%s', (_name, source, target, c1, c2) => {
    const cy = build([source, target], [{ id: 'b', source: 's', target: 't' }]);
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy);
    // 'b' é par: variação +6 na perpendicular (-dy, dx) da corda.
    const shift = { x: (-dy / length) * 6, y: (dx / length) * 6 };
    const [p1, p2] = curve(cy, 'b');
    expectPoint(p1, c1[0] + shift.x, c1[1] + shift.y);
    expectPoint(p2, c2[0] + shift.x, c2[1] + shift.y);
  });

  it('relações paralelas viram um leque e as duas direções caem em lados opostos', () => {
    const cy = build(
      [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 300, y: 0 },
      ],
      [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n1' },
      ],
    );
    const [a1, a2] = curve(cy, 'e1');
    expectPoint(a1, 90, -13);
    expectPoint(a2, 210, -13);
    const [b1, b2] = curve(cy, 'e2');
    expectPoint(b1, 210, 13);
    expectPoint(b2, 90, 13);
    // No quadro local da própria corda, a distância é o deslocamento do leque.
    const distances = edgeControlPoints(edgeOf(cy, 'e2')).distances;
    expect(distances[0]).toBeCloseTo(-13, 6);
    expect(distances[1]).toBeCloseTo(-13, 6);
  });

  it('três paralelas: ±26 nas pontas do leque e a do meio mantém só a variação de 6px', () => {
    const cy = build(
      [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 300, y: 0 },
      ],
      ['z', 'a', 'm'].map((id) => ({ id, source: 'n1', target: 'n2' })),
    );
    expect(edgeControlPoints(edgeOf(cy, 'a')).distances[0]).toBeCloseTo(-26, 6);
    // 'm' tem soma de códigos ímpar: lado -6.
    expect(edgeControlPoints(edgeOf(cy, 'm')).distances[0]).toBeCloseTo(-6, 6);
    expect(edgeControlPoints(edgeOf(cy, 'z')).distances[0]).toBeCloseTo(26, 6);
  });

  it('uma ponta sobre a outra não gera NaN', () => {
    const cy = build(
      [
        { id: 's', x: 50, y: 50 },
        { id: 't', x: 50, y: 50 },
      ],
      [{ id: 'a', source: 's', target: 't' }],
    );
    const { weights, distances } = edgeControlPoints(edgeOf(cy, 'a'));
    expect([...weights, ...distances].every(Number.isFinite)).toBe(true);
  });
});

describe('estilo do grafo a partir dos dados', () => {
  const meta = {
    version: 1,
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
    status: 'active' as const,
  };
  const point = (id: string, kind: Node['kind'], contexts: string[] = []) =>
    ({
      ...meta,
      id,
      label: `Ponto ${id}`,
      description: '',
      kind,
      startYear: null,
      endYear: null,
      precision: 'unknown',
      periodLabel: null,
      identifiers: [],
      aliases: [],
      conceptScope: null,
      contexts,
      degreeTotal: 1,
      archivedAt: null,
    }) as Node;
  const relation = (
    id: string,
    evidenceStatus: Relation['evidenceStatus'],
    intensity: number | null,
    type = 'influenced',
  ) =>
    ({
      ...meta,
      id,
      sourceId: 'p',
      targetId: 'q',
      type,
      contextId: null,
      claim: '',
      justification: '',
      evidenceStatus,
      intensity,
      intensityReason: null,
      attributionNodeId: null,
      attributionText: null,
      inferenceAuthor: null,
      contested: false,
      contestationNote: null,
      evidence: [],
      archivedAt: null,
    }) as Relation;
  const catalog = {
    nodeKinds: [],
    relationTypes: [
      {
        code: 'influenced',
        label: 'influenciou',
        inverseLabel: 'foi influenciado por',
        symmetric: false,
        allowedEndpoints: [],
      },
      {
        code: 'parallel_to',
        label: 'paralelo a',
        inverseLabel: 'paralelo a',
        symmetric: true,
        allowedEndpoints: [],
      },
    ],
    identifierSchemes: [],
    evidenceStatuses: [],
    editorialStatuses: [],
    intensities: [],
  } as Catalog;
  const rule = (selector: string) =>
    (
      graphStyle.find((r) => r.selector === selector) as unknown as {
        style: Record<string, (ele: unknown) => unknown>;
      }
    ).style;
  const dataOf = (item: { data: Record<string, unknown> } | undefined) => ({
    data: (key: string) => item?.data[key],
  });

  it('forma do nó vira glifo por tipo, com a figura em triângulo', () => {
    const kinds: Node['kind'][] = [
      'person',
      'tradition',
      'concept',
      'work',
      'figure',
    ];
    const items = elements(
      kinds.map((k) => point(k, k)),
      [],
      catalog,
    );
    const labels = items.map((item) => rule('node').label?.(dataOf(item)));
    expect(labels).toEqual([
      '• Ponto person',
      '≡ Ponto tradition',
      '◇ Ponto concept',
      '□ Ponto work',
      '△ Ponto figure',
    ]);
  });

  it('forma desconhecida cai no glifo de ponto', () => {
    expect(
      rule('node').label?.({
        data: (key: string) => (key === 'label' ? 'Sem forma' : 'blob'),
      }),
    ).toBe('• Sem forma');
  });

  it('o traço da aresta segue o status da evidência', () => {
    const items = elements(
      [point('p', 'person'), point('q', 'person')],
      [
        relation('r1', 'documented', 1),
        relation('r2', 'attributed_interpretation', 1),
        relation('r3', 'inference', 1),
      ],
      catalog,
    );
    const edges = items.filter((i) => i.group === 'edges');
    expect(edges.map((e) => rule('edge')['line-style']?.(dataOf(e)))).toEqual([
      'solid',
      'dashed',
      'dotted',
    ]);
  });

  it('a espessura cresce com a intensidade e a relação selecionada engrossa 0,3', () => {
    const items = elements(
      [point('p', 'person'), point('q', 'person')],
      [
        relation('r0', 'documented', null),
        relation('r1', 'documented', 1),
        relation('r2', 'documented', 2),
        relation('r3', 'documented', 3),
      ],
      catalog,
    );
    const edges = items.filter((i) => i.group === 'edges');
    const widths = edges.map((e) => rule('edge').width?.(dataOf(e)) as number);
    // 0,7 + (largura - 1) * 0,38, com largura = intensidade * 1,5 (1 sem intensidade).
    expect(widths[0]).toBeCloseTo(0.7, 6);
    expect(widths[1]).toBeCloseTo(0.89, 6);
    expect(widths[2]).toBeCloseTo(1.46, 6);
    expect(widths[3]).toBeCloseTo(2.03, 6);
    const selected = edges.map(
      (e) => rule('edge.selected-edge').width?.(dataOf(e)) as number,
    );
    selected.forEach((w, i) =>
      expect(w).toBeCloseTo((widths[i] ?? 0) + 0.3, 6),
    );
    expect(items.find((i) => i.data.id === 'r3')?.data.width).toBe(4.5);
  });

  it('seta só em relação direcional; simétrica não tem seta nem fluxo', () => {
    const items = elements(
      [point('p', 'person'), point('q', 'person')],
      [
        relation('dir', 'documented', 1, 'influenced'),
        relation('sym', 'documented', 1, 'parallel_to'),
      ],
      catalog,
    );
    const [dir, sym] = items.filter((i) => i.group === 'edges');
    expect(rule('edge')['target-arrow-shape']?.(dataOf(dir))).toBe('triangle');
    expect(rule('edge')['target-arrow-shape']?.(dataOf(sym))).toBe('none');
    expect(dir?.data.symmetric).toBe(false);
    expect(sym?.data.symmetric).toBe(true);
  });

  it('pontos de controle do estilo vêm de edgeControlPoints', () => {
    const cy = build(
      [
        { id: 's', x: 100, y: 50 },
        { id: 't', x: 400, y: 50 },
      ],
      [{ id: 'a', source: 's', target: 't' }],
    );
    const edge = edgeOf(cy, 'a');
    const expected = edgeControlPoints(edge);
    expect(rule('edge')['control-point-weights']?.(edge)).toEqual(
      expected.weights,
    );
    expect(rule('edge')['control-point-distances']?.(edge)).toEqual(
      expected.distances,
    );
  });

  it('cada contexto, na ordem alfabética, ocupa uma cor da paleta e dá a volta depois da quarta', () => {
    const names = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const items = elements(
      names.map((c) => point(`p-${c}`, 'person', [c])),
      [],
      catalog,
    );
    expect(items.map((i) => i.data.color)).toEqual([
      contextColors[0],
      contextColors[1],
      contextColors[2],
      contextColors[3],
      contextColors[0],
    ]);
    expect(elements([point('x', 'person')], [], catalog)[0]?.data.color).toBe(
      neutralColor,
    );
  });

  it('o nó selecionado inverte: fundo ultramarino e rótulo na cor da prancha', () => {
    const block = (selector: string) =>
      (
        graphStyle.find((r) => r.selector === selector) as unknown as {
          style: Record<string, unknown>;
        }
      ).style;
    expect(block('node:selected')).toMatchObject({
      'background-color': highlightColor,
      'border-color': highlightColor,
      color: surfaceColor,
      'font-weight': 600,
    });
    expect(block('node')).toMatchObject({
      color: labelColor,
      'font-weight': 500,
      'background-color': nodeFillColor,
    });
  });
});

describe('etiqueta do nó', () => {
  it('tem respiro de 8px e filete neutro fino, sem cor de contexto', () => {
    const node = (
      graphStyle.find((r) => r.selector === 'node') as unknown as {
        style: Record<string, unknown>;
      }
    ).style;
    // Valores do DESIGN.md (nó como etiqueta retangular de canto reto): o
    // filete #c9c3b2 é neutro de propósito, o contexto fica na legenda.
    expect(node.padding).toBe('8px');
    expect(node['border-color']).toBe('#c9c3b2');
    expect(node['border-width']).toBe(1.25);
  });
});

describe('paleta do mapa', () => {
  // Contrato visual de DESIGN.md ("Grafo sobre a prancha"): os valores exatos
  // fazem parte do desenho e foram medidos contra o marfim. Mudar uma cor
  // exige remedir o contraste e atualizar o DESIGN.md junto.
  it('mantém os tokens de DESIGN.md', () => {
    expect(contextColors).toEqual(['#4c6b35', '#9a5a2b', '#3c5f7d', '#6b4a7a']);
    expect(neutralColor).toBe('#767c6b');
    expect(edgeColor).toBe('#7e8372');
    expect(contestedColor).toBe('#9d2b4e');
    expect(highlightColor).toBe('#2145d8');
    expect(labelColor).toBe('#172034');
    expect(surfaceColor).toBe('#f5f2e9');
    expect(nodeFillColor).toBe('#efebdf');
  });

  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return (
      0.2126 * (channels[0] ?? 0) +
      0.7152 * (channels[1] ?? 0) +
      0.0722 * (channels[2] ?? 0)
    );
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
  };

  it('todo traço do grafo tem pelo menos 3:1 sobre o marfim e o rótulo passa de 13:1', () => {
    for (const color of [
      ...contextColors,
      neutralColor,
      edgeColor,
      contestedColor,
      highlightColor,
    ])
      expect(contrast(color, surfaceColor)).toBeGreaterThanOrEqual(3);
    expect(contrast(labelColor, surfaceColor)).toBeGreaterThanOrEqual(14);
    expect(contrast(labelColor, nodeFillColor)).toBeGreaterThanOrEqual(13);
    expect(new Set(contextColors).size).toBe(contextColors.length);
  });
});
