import { describe, expect, it } from 'vitest';
import type {
  NeighborPage,
  Node,
  Relation,
  Catalog,
} from '../../src/api/domain';
import {
  emptyLedger,
  reduceLedger,
  visible,
} from '../../src/graph/visibility/ledger';
import { elements } from '../../src/graph/adapter/elements';
import { astronomicalYear, displayYear } from '../../src/components/period';
const meta = {
  version: 1,
  createdAt: '2026-10-24T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
  status: 'active' as const,
};
const node = (id: string): Node => ({
  ...meta,
  id,
  label: id,
  description: '',
  kind: 'concept',
  aliases: [],
  conceptScope: 'broad',
  contexts: [],
  degreeTotal: 1,
  archivedAt: null,
});
const edge = (id: string, sourceId: string, targetId: string): Relation => ({
  ...meta,
  id,
  sourceId,
  targetId,
  type: 'parallel_to',
  contextId: null,
  claim: '',
  justification: '',
  evidenceStatus: 'inference',
  intensity: null,
  intensityReason: null,
  attributionNodeId: null,
  attributionText: null,
  inferenceAuthor: 'teste',
  contested: true,
  contestationNote: null,
  evidence: [],
  archivedAt: null,
});
const catalogOf = (relationTypes: Catalog['relationTypes']): Catalog => ({
  nodeKinds: [],
  relationTypes,
  evidenceStatuses: [],
  editorialStatuses: [],
  intensities: [],
});
const relationType = (
  code: string,
  label: string,
  inverseLabel: string,
  symmetric: boolean,
) => ({ code, label, inverseLabel, symmetric, allowedEndpoints: [] });
const page = (ids: string[], relations: Relation[] = []): NeighborPage => ({
  nodes: ids.map(node),
  relations,
  nextCursor: null,
  truncated: false,
});
describe('ledger de expansões', () => {
  it('preserva ponto compartilhado ao recolher uma expansão', () => {
    let state = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
    for (const [id, p] of [
      ['a', page(['a', 'b', 'c'])],
      ['b', page(['b', 'd'], [edge('bd', 'b', 'd')])],
      ['c', page(['c', 'd'], [edge('cd', 'c', 'd')])],
    ] as const)
      state = reduceLedger(state, { type: 'page', id, page: p, generation: 1 });
    state = reduceLedger(state, { type: 'collapse', id: 'b' });
    expect(visible(state).nodes.map((n) => n.id)).toContain('d');
    expect(visible(state).relations.map((r) => r.id)).toEqual(['cd']);
    state = reduceLedger(state, { type: 'collapse', id: 'a' });
    expect(visible(state).nodes.map((n) => n.id)).toEqual(['a']);
    expect(state.expansions).toEqual({});
  });
  it('mescla páginas, conserva relações paralelas e descarta resposta tardia', () => {
    let state = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
    state = reduceLedger(state, {
      type: 'page',
      id: 'a',
      page: page(['a', 'b'], [edge('1', 'a', 'b')]),
      generation: 1,
    });
    state = reduceLedger(state, {
      type: 'page',
      id: 'a',
      page: page(
        ['b', 'c'],
        [edge('2', 'a', 'b'), edge('dangling', 'c', 'missing')],
      ),
      generation: 1,
    });
    expect(visible(state).nodes).toHaveLength(3);
    expect(visible(state).relations).toHaveLength(2);
    const reset = reduceLedger(state, { type: 'root', node: node('a') });
    expect(
      reduceLedger(reset, {
        type: 'page',
        id: 'a',
        page: page(['z']),
        generation: 1,
      }),
    ).toEqual(reset);
  });
  it('não permite mais de 500 pontos', () => {
    const state = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
    expect(
      reduceLedger(state, {
        type: 'page',
        id: 'a',
        page: page(Array.from({ length: 500 }, (_, i) => String(i))),
        generation: 1,
      }),
    ).toBe(state);
  });
  it('arestas simétricas sem seta, inferência pontilhada e intensidade nula neutra', () => {
    const catalog = catalogOf([
      relationType('parallel_to', 'Paralelo a', '', true),
    ]);
    const data = elements(
      [node('a'), node('b')],
      [edge('e', 'a', 'b')],
      catalog,
    );
    expect(data[2]?.data).toMatchObject({
      arrow: 'none',
      line: 'dotted',
      width: 1,
      contested: true,
    });
  });
});
it('converte explicitamente anos astronômicos', () => {
  expect(astronomicalYear('1', 'bce')).toBe(0);
  expect(astronomicalYear('2', 'bce')).toBe(-1);
  expect(displayYear(0)).toBe('1 a.C.');
  expect(displayYear(-1)).toBe('2 a.C.');
  expect(astronomicalYear('', 'ce')).toBeNull();
  expect(() => astronomicalYear('0', 'bce')).toThrow();
});

it('reset e troca de raiz descartam expansões e invalidam respostas anteriores', () => {
  const root = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
  const expanded = reduceLedger(root, {
    type: 'page',
    id: 'a',
    page: page(['a', 'b']),
    generation: root.generation,
  });
  const reset = reduceLedger(expanded, { type: 'reset' });
  expect(reset).toEqual({
    roots: [],
    expansions: {},
    generation: expanded.generation + 1,
  });
  const changed = reduceLedger(expanded, { type: 'root', node: node('b') });
  expect(changed).toEqual({
    roots: [node('b')],
    expansions: {},
    generation: expanded.generation + 1,
  });
  expect(
    reduceLedger(changed, {
      type: 'page',
      id: 'b',
      page: page(['late']),
      generation: root.generation,
    }),
  ).toBe(changed);
  expect(
    reduceLedger(changed, {
      type: 'page',
      id: 'missing-owner',
      page: page(['orphan']),
      generation: changed.generation,
    }),
  ).toBe(changed);
});
it('mantém exatamente 500 pontos e recusa a página inteira acima do limite', () => {
  const root = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
  const full = reduceLedger(root, {
    type: 'page',
    id: 'a',
    page: page(Array.from({ length: 499 }, (_, i) => String(i))),
    generation: root.generation,
  });
  expect(visible(full).nodes).toHaveLength(500);
  expect(
    reduceLedger(full, {
      type: 'page',
      id: 'a',
      page: page(['extra']),
      generation: full.generation,
    }),
  ).toBe(full);
  expect(visible(full).nodes.some((n) => n.id === 'extra')).toBe(false);
});
it('visibilidade independe da ordem de expansão e não mantém ciclos órfãos', () => {
  const root = node('a');
  const state = {
    roots: [root],
    generation: 7,
    expansions: {
      c: page(['c', 'b']),
      b: page(['b', 'c'], [edge('bc', 'b', 'c')]),
      a: page(['a', 'b'], [edge('ab', 'a', 'b')]),
      unrelated: page(['unrelated', 'x']),
    },
  };
  expect(new Set(visible(state).nodes.map((n) => n.id))).toEqual(
    new Set(['a', 'b', 'c']),
  );
  const collapsed = reduceLedger(state, { type: 'collapse', id: 'a' });
  expect(collapsed.generation).toBe(8);
  expect(collapsed.expansions).toEqual({});
  expect(visible(collapsed)).toEqual({ nodes: [root], relations: [] });
  expect(state.expansions.a).toBeDefined();
});
it('atualiza dados e cursor entre páginas sem duplicar IDs nem aceitar endpoints ausentes', () => {
  let state = reduceLedger(emptyLedger, { type: 'root', node: node('a') });
  state = reduceLedger(state, {
    type: 'page',
    id: 'a',
    page: { ...page(['b'], [edge('ab', 'a', 'b')]), nextCursor: 'page-2' },
    generation: 1,
  });
  const updated = { ...node('b'), label: 'Atualizado' };
  const updatedEdge = { ...edge('ab', 'a', 'b'), claim: 'Afirmação revisada' };
  state = reduceLedger(state, {
    type: 'page',
    id: 'a',
    page: {
      nodes: [updated, node('c')],
      relations: [
        updatedEdge,
        edge('missing-source', 'missing', 'c'),
        edge('missing-target', 'c', 'missing'),
      ],
      nextCursor: null,
      truncated: true,
    },
    generation: 1,
  });
  expect(visible(state).nodes).toEqual([node('a'), updated, node('c')]);
  expect(visible(state).relations).toEqual([updatedEdge]);
  expect(state.expansions.a?.nextCursor).toBeNull();
  expect(state.expansions.a?.truncated).toBe(true);
});
it('mapeia todos os tipos, preserva identidade/direção e usa catálogo por ID', () => {
  const catalog = catalogOf([
    relationType('studied', 'estudou', 'estudado por', false),
    relationType('parallel_to', 'paralelo a', 'paralelo a', true),
  ]);
  const input = (['person', 'tradition', 'concept', 'work'] as const).map(
    (kind, i) => ({
      ...node(String(i)),
      kind,
      label: `Ponto ${i}`,
      degreeTotal: i === 3 ? 10000 : i,
    }),
  );
  const relations = [
    {
      ...edge('e1', '0', '1'),
      type: 'studied',
      evidenceStatus: 'documented' as const,
      intensity: 1,
      contested: false,
    },
    {
      ...edge('e2', '0', '1'),
      evidenceStatus: 'attributed_interpretation' as const,
      intensity: 3,
    },
    {
      ...edge('e3', '1', '0'),
      type: 'not-in-catalog',
      evidenceStatus: 'inference' as const,
    },
  ];
  const result = elements(input, relations, catalog);
  expect(result.slice(0, 4).map((e) => e.data.shape)).toEqual([
    'ellipse',
    'hexagon',
    'diamond',
    'rectangle',
  ]);
  expect(dataAt(result, 0)).toMatchObject({
    id: '0',
    label: 'Ponto 0',
    size: 30,
    color: '#697c81',
  });
  expect(dataAt(result, 3).size).toBe(68);
  expect(dataAt(result, 1).size).toBeGreaterThan(30);
  expect(dataAt(result, 2).size).toBeGreaterThan(dataAt(result, 1).size);
  expect(dataAt(result, 4)).toMatchObject({
    id: 'e1',
    source: '0',
    target: '1',
    label: 'estudou',
    arrow: 'triangle',
    line: 'solid',
    contested: false,
  });
  expect(dataAt(result, 5)).toMatchObject({
    id: 'e2',
    label: 'paralelo a',
    arrow: 'none',
    line: 'dashed',
    contested: true,
  });
  expect(dataAt(result, 5).width).toBeGreaterThan(dataAt(result, 4).width);
  expect(dataAt(result, 6)).toMatchObject({
    source: '1',
    target: '0',
    label: 'not-in-catalog',
    arrow: 'triangle',
    line: 'dotted',
    width: 1,
  });
});
it('cores de contexto são estáveis com ordem diferente dos pontos', () => {
  const a = { ...node('a'), contexts: ['z'] };
  const b = { ...node('b'), contexts: ['a'] };
  const catalog = catalogOf([]);
  const first = elements([a, b], [], catalog);
  const reversed = elements([b, a], [], catalog);
  expect(first[0]?.data.color).toBe(reversed[1]?.data.color);
  expect(first[1]?.data.color).toBe(reversed[0]?.data.color);
  expect(first[0]?.data.color).not.toBe(first[1]?.data.color);
  expect(first[0]?.data.color).not.toBe('#697c81');
});

function dataAt(result: ReturnType<typeof elements>, index: number) {
  const item = result[index];
  if (!item) throw new Error('Elemento esperado ausente.');
  return item.data;
}
