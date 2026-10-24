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
const node = (id: string): Node => ({
  id,
  label: id,
  description: '',
  version: '1',
  kind: 'concept',
  aliases: [],
  conceptScope: '',
  contexts: [],
  degreeTotal: 1,
  status: 'active',
});
const edge = (id: string, sourceId: string, targetId: string): Relation => ({
  id,
  sourceId,
  targetId,
  label: id,
  description: '',
  version: '1',
  status: 'active',
  type: 'parallel_to',
  claim: '',
  justification: '',
  context: '',
  evidenceStatus: 'inference',
  intensity: null,
  intensityReason: '',
  attribution: 'teste',
  contested: true,
  evidence: [],
});
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
    const catalog: Catalog = {
      kinds: [],
      predicates: [
        {
          id: 'parallel_to',
          label: 'Paralelo a',
          inverse: '',
          symmetric: true,
          sourceKinds: [],
          targetKinds: [],
        },
      ],
    };
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
