import { describe, expect, it, vi } from 'vitest';
import type { Core } from 'cytoscape';
import { arrangeNew } from '../../src/graph/layout/positions';

interface FakeNode {
  id: () => string;
  neighborhood: (kind: string) => {
    nodes: () => {
      filter: (predicate: (node: FakeNode) => boolean) => {
        first: () => FakeNode;
      };
    };
  };
  position: (value: { x: number; y: number }) => void;
}

function fakeNode(id: string, neighbors: FakeNode[] = []) {
  const position = vi.fn();
  const empty: FakeNode = {
    id: () => '',
    neighborhood: () => ({
      nodes: () => ({ filter: () => ({ first: () => empty }) }),
    }),
    position: vi.fn(),
  };
  const node: FakeNode = {
    id: () => id,
    neighborhood: (kind) => ({
      nodes: () => ({
        filter: (predicate) => ({
          first: () =>
            (kind === 'node' ? neighbors.filter(predicate)[0] : undefined) ??
            empty,
        }),
      }),
    }),
    position,
  };
  return { node, position };
}

describe('arrangeNew', () => {
  it('arranja nós novos ao redor de âncoras fixadas e da origem padrão', () => {
    const anchor = fakeNode('anchor');
    const first = fakeNode('first', [anchor.node]);
    const second = fakeNode('second');
    const cy = {
      nodes: () => [anchor.node, first.node, second.node],
    } as unknown as Core;

    arrangeNew(cy, { anchor: { x: 10, y: 20 } });

    expect(anchor.position).not.toHaveBeenCalled();
    expect(first.position).toHaveBeenCalledWith({ x: 120, y: 20 });
    expect(second.position).toHaveBeenCalledWith({
      x: expect.closeTo(300 + Math.cos(2.399963) * 110, 8),
      y: expect.closeTo(220 + Math.sin(2.399963) * 110, 8),
    });
  });

  it('mantém a distribuição radial e aumenta o raio depois de seis nós', () => {
    const fresh = Array.from({ length: 7 }, (_, index) =>
      fakeNode(`n${index}`),
    );
    const cy = {
      nodes: () => fresh.map(({ node }) => node),
    } as unknown as Core;

    arrangeNew(cy, {});

    const seventhAngle = 6 * 2.399963;
    expect(fresh[0]?.position).toHaveBeenCalledWith({ x: 410, y: 220 });
    expect(fresh[6]?.position).toHaveBeenCalledWith({
      x: expect.closeTo(300 + Math.cos(seventhAngle) * 135, 8),
      y: expect.closeTo(220 + Math.sin(seventhAngle) * 135, 8),
    });
  });
});
