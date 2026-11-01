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
  label: string | undefined,
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

const GOLDEN = 2.399963;
const canvas = (overrides: Record<string, unknown> = {}) => ({
  zoom: () => 1,
  pan: () => ({ x: 0, y: 0 }),
  width: () => 600,
  height: () => 440,
  ...overrides,
});
const polar = (
  origin: { x: number; y: number },
  slot: number,
): { x: number; y: number } => ({
  x: origin.x + Math.cos(slot * GOLDEN) * (130 + 36 * Math.floor(slot / 6)),
  y: origin.y + Math.sin(slot * GOLDEN) * (130 + 36 * Math.floor(slot / 6)),
});
function expectPosition(
  call: { x: number; y: number } | undefined,
  x: number,
  y: number,
) {
  expect(call).toBeDefined();
  expect(call?.x).toBeCloseTo(x, 6);
  expect(call?.y).toBeCloseTo(y, 6);
}
const placedAt = (fake: ReturnType<typeof fakeNode>) =>
  fake.position.mock.calls[0]?.[0] as { x: number; y: number } | undefined;

describe('arrangeNew: centro do canvas', () => {
  it('converte o centro do canvas para o espaço do modelo com zoom e pan', () => {
    const fresh = fakeNode('n', 'Novo');
    const cy = {
      nodes: () => [fresh.node],
      ...canvas({ zoom: () => 2, pan: () => ({ x: 100, y: 40 }) }),
    } as unknown as Core;
    arrangeNew(cy, {});
    // ((600/2 - 100) / 2, (440/2 - 40) / 2) = (100, 90), mais o raio de 130.
    expectPosition(placedAt(fresh), 230, 90);
  });

  it('zoom zero cai em 1 e pan ausente cai em origem', () => {
    const fresh = fakeNode('n', 'Novo');
    const cy = {
      nodes: () => [fresh.node],
      ...canvas({ zoom: () => 0, pan: () => undefined }),
    } as unknown as Core;
    arrangeNew(cy, {});
    expectPosition(placedAt(fresh), 430, 220);
  });
});

describe('arrangeNew: caixa do rótulo e colisão', () => {
  const center = { x: 300, y: 220 };
  const first = polar(center, 0);
  const second = polar(center, 1);
  // O candidato novo sempre nasce em `first` (slot 0, sem âncora). Um ponto
  // fixado encostando na caixa dele (distância = soma das metades) conta como
  // colisão; com 1px de folga, não.
  interface Size {
    label: string;
    width: number;
    height: number;
  }
  // Largura efetiva = max(largura do nó, (letras + 2) * 9 + 16); altura = max(34, altura do nó).
  const configs: {
    name: string;
    fixed: Size;
    fresh: Size;
    w: [number, number];
    h: [number, number];
  }[] = [
    {
      name: 'largura e altura do próprio nó',
      fixed: { label: '', width: 100, height: 34 },
      fresh: { label: '', width: 100, height: 34 },
      w: [100, 100],
      h: [34, 34],
    },
    {
      name: 'largura estimada pelo rótulo e altura mínima de 34',
      fixed: { label: 'abcdefghij', width: 20, height: 10 },
      fresh: { label: 'x'.repeat(20), width: 10, height: 80 },
      w: [124, 214],
      h: [34, 80],
    },
  ];
  type Side = 'esquerda' | 'direita' | 'acima' | 'abaixo';
  const offsetFor = (
    side: Side,
    w: [number, number],
    h: [number, number],
    gap: number,
  ) => {
    const dx = (w[0] + w[1]) / 2 + gap;
    const dy = (h[0] + h[1]) / 2 + gap;
    return {
      esquerda: { x: -dx, y: 0 },
      direita: { x: dx, y: 0 },
      acima: { x: 0, y: -dy },
      abaixo: { x: 0, y: dy },
    }[side];
  };
  const run = (cfg: (typeof configs)[number], side: Side, gap: number) => {
    const fixed = fakeNode('fixed', cfg.fixed.label, [], {
      width: cfg.fixed.width,
      height: cfg.fixed.height,
    });
    const fresh = fakeNode('fresh', cfg.fresh.label, [], {
      width: cfg.fresh.width,
      height: cfg.fresh.height,
    });
    const delta = offsetFor(side, cfg.w, cfg.h, gap);
    const cy = {
      nodes: () => [fixed.node, fresh.node],
      ...canvas(),
    } as unknown as Core;
    arrangeNew(cy, {
      fixed: { x: first.x + delta.x, y: first.y + delta.y },
    });
    return placedAt(fresh);
  };

  for (const cfg of configs)
    for (const side of ['esquerda', 'direita', 'acima', 'abaixo'] as const) {
      it(`${cfg.name}: encostar pela ${side} é colisão e 1px de folga não é`, () => {
        // Encostando: a primeira tentativa é recusada e vale a segunda (slot 1).
        expectPosition(run(cfg, side, 0), second.x, second.y);
        // Com folga: a primeira tentativa (slot 0) é aceita.
        expectPosition(run(cfg, side, 1), first.x, first.y);
      });
    }

  it('rótulo ausente conta como vazio (caixa mínima de 34px)', () => {
    const unnamed = fakeNode('u', undefined, [], { width: 0, height: 34 });
    const fresh = fakeNode('f', 'y', [], { width: 200, height: 34 });
    const cy = {
      nodes: () => [unnamed.node, fresh.node],
      ...canvas(),
    } as unknown as Core;
    // 34 + 200 = 234 < 260: o novo nó cabe a 130px do fixado, sem colidir.
    arrangeNew(cy, { u: { x: 300, y: 220 } });
    expectPosition(placedAt(fresh), 430, 220);
  });

  it('um novo nó entra na checagem de colisão dos seguintes', () => {
    // Caixas altas e largas: o candidato 1 colide com o 0 e precisa de outro slot.
    const a = fakeNode('a', '', [], { width: 400, height: 120 });
    const b = fakeNode('b', '', [], { width: 400, height: 120 });
    const cy = {
      nodes: () => [a.node, b.node],
      ...canvas(),
    } as unknown as Core;
    arrangeNew(cy, {});
    expectPosition(placedAt(a), first.x, first.y);
    const chosen = placedAt(b);
    expect(chosen).toBeDefined();
    // Caixas de 400x120 centradas em pontos distintos não podem se sobrepor.
    const overlapsA =
      Math.abs((chosen?.x ?? 0) - first.x) <= 400 &&
      Math.abs((chosen?.y ?? 0) - first.y) <= 120;
    expect(overlapsA).toBe(false);
  });

  it('a tentativa k de i usa o slot i + k * quantidade de novos nós', () => {
    // O ponto fixado cobre tudo ao redor; só a última tentativa (47) é aceita
    // à força, na posição do slot i + 47 * novos.
    const wall = fakeNode('wall', '', [], { width: 20000, height: 20000 });
    const a = fakeNode('a', '', [], { width: 100, height: 34 });
    const b = fakeNode('b', '', [], { width: 100, height: 34 });
    const cy = {
      nodes: () => [wall.node, a.node, b.node],
      ...canvas(),
    } as unknown as Core;
    arrangeNew(cy, { wall: { x: 300, y: 220 } });
    const forA = polar(center, 0 + 47 * 2);
    const forB = polar(center, 1 + 47 * 2);
    expectPosition(placedAt(a), forA.x, forA.y);
    expectPosition(placedAt(b), forB.x, forB.y);
  });

  it('com a segunda tentativa usando o segundo slot de cada novo nó', () => {
    const wallA = fakeNode('wallA', '', [], { width: 100, height: 34 });
    const a = fakeNode('a', '', [], { width: 100, height: 34 });
    const b = fakeNode('b', '', [], { width: 100, height: 34 });
    const cy = {
      nodes: () => [wallA.node, a.node, b.node],
      ...canvas(),
    } as unknown as Core;
    // Bloqueia exatamente o slot 0 (de a) e o slot 1 (de b).
    const slot0 = polar(center, 0);
    arrangeNew(cy, { wallA: { x: slot0.x, y: slot0.y } });
    // a (i=0) recusa slot 0 e vai para o slot 0 + 1 * 2 = 2.
    const expectedA = polar(center, 2);
    expectPosition(placedAt(a), expectedA.x, expectedA.y);
  });
});
