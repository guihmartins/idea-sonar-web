import { describe, expect, it, vi } from 'vitest';
import type { Core } from 'cytoscape';
import { arrangeNew } from '../../src/graph/layout/positions';

interface FakeNode {
  id: () => string;
  data: (key: string) => unknown;
  outerWidth: () => number;
  outerHeight: () => number;
  neighborhood: (kind: string) => {
    nodes: () => {
      filter: (predicate: (node: FakeNode) => boolean) => {
        first: () => FakeNode;
      };
    };
  };
  position: (value: { x: number; y: number }) => void;
}

function fakeNode(
  id: string,
  label: string,
  neighbors: FakeNode[] = [],
  dimensions = { width: 90, height: 34 },
) {
  const position = vi.fn();
  const empty: FakeNode = {
    id: () => '',
    data: () => '',
    outerWidth: () => 0,
    outerHeight: () => 0,
    neighborhood: () => ({
      nodes: () => ({ filter: () => ({ first: () => empty }) }),
    }),
    position: vi.fn(),
  };
  const node: FakeNode = {
    id: () => id,
    data: (key) => (key === 'label' ? label : undefined),
    outerWidth: () => dimensions.width,
    outerHeight: () => dimensions.height,
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

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

describe('arrangeNew', () => {
  it('arranja nós novos ao redor de âncoras fixadas e da origem padrão', () => {
    const anchor = fakeNode('anchor', 'Âncora');
    const first = fakeNode('first', 'Primeiro', [anchor.node]);
    const second = fakeNode('second', 'Segundo');
    const cy = {
      nodes: () => [anchor.node, first.node, second.node],
      zoom: () => 1,
      pan: () => ({ x: 0, y: 0 }),
      width: () => 600,
      height: () => 440,
    } as unknown as Core;

    arrangeNew(cy, { anchor: { x: 10, y: 20 } });

    expect(anchor.position).not.toHaveBeenCalled();
    expect(first.position).toHaveBeenCalledWith({ x: 140, y: 20 });
    expect(second.position).toHaveBeenCalledWith({
      x: expect.closeTo(300 + Math.cos(2.399963) * 130, 8),
      y: expect.closeTo(220 + Math.sin(2.399963) * 130, 8),
    });
  });

  it('mantém a distribuição radial e aumenta o raio depois de seis nós', () => {
    const fresh = Array.from({ length: 7 }, (_, index) =>
      fakeNode(`n${index}`, `Nó ${index}`),
    );
    const cy = {
      nodes: () => fresh.map(({ node }) => node),
      zoom: () => 1,
      pan: () => ({ x: 0, y: 0 }),
      width: () => 600,
      height: () => 440,
    } as unknown as Core;

    arrangeNew(cy, {});

    const seventhAngle = 6 * 2.399963;
    expect(fresh[0]?.position).toHaveBeenCalledWith({ x: 430, y: 220 });
    expect(fresh[6]?.position).toHaveBeenCalledWith({
      x: expect.closeTo(300 + Math.cos(seventhAngle) * 166, 8),
      y: expect.closeTo(220 + Math.sin(seventhAngle) * 166, 8),
    });
  });

  it('evita sobreposição entre novos nós e caixas dos nós já fixados', () => {
    const root = fakeNode('root', 'Raiz', [], { width: 60, height: 34 });
    const fixed = fakeNode('fixed', 'Vizinho fixado', [], {
      width: 250,
      height: 50,
    });
    const first = fakeNode('n1', 'Novo ponto um', [root.node], {
      width: 160,
      height: 34,
    });
    const second = fakeNode('n2', 'Novo ponto dois', [root.node], {
      width: 160,
      height: 34,
    });
    const cy = {
      nodes: () => [root.node, fixed.node, first.node, second.node],
      zoom: () => 1,
      pan: () => ({ x: 0, y: 0 }),
      width: () => 600,
      height: () => 440,
    } as unknown as Core;
    const pinned = { root: { x: 0, y: 0 }, fixed: { x: 130, y: 0 } };

    arrangeNew(cy, pinned);

    const firstPosition = first.position.mock.calls[0]?.[0];
    const secondPosition = second.position.mock.calls[0]?.[0];
    const fixedPosition = pinned.fixed;
    expect(firstPosition).toBeDefined();
    expect(secondPosition).toBeDefined();
    if (!firstPosition || !secondPosition) throw new Error('posição ausente');
    const box = (center: { x: number; y: number }, w: number, h: number) => ({
      x: center.x - w / 2,
      y: center.y - h / 2,
      w,
      h,
    });
    expect(
      overlaps(box(firstPosition, 160, 34), box(fixedPosition, 250, 50)),
    ).toBe(false);
    expect(
      overlaps(box(firstPosition, 160, 34), box(secondPosition, 160, 34)),
    ).toBe(false);
  });
});
