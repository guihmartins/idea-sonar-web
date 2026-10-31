import { expect, it, vi } from 'vitest';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { defaultFilters } from '../../src/api/domain';
import type { SavedView } from '../../src/api/domain';
import { restoreView } from '../../src/graph/restore';
import { visible } from '../../src/graph/visibility/ledger';
async function setup() {
  const { api, session } = createFixtureServices();
  await session.login();
  const view: SavedView = {
    id: 'view',
    name: 'View sintética',
    version: 1,
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
    status: 'active',
    rootNodeId: ids.jung,
    filters: {},
    expandedNodes: [ids.jung],
    positions: {},
    viewport: { zoom: 1, pan: { x: 0, y: 0 } },
  };
  vi.spyOn(api, 'detail').mockResolvedValue(view);
  return { api, view };
}
it('restauração preserva páginas carregadas se a próxima falhar', async () => {
  const { api } = await setup();
  const first = await api.neighbors(
    ids.jung,
    defaultFilters,
    null,
    new AbortController().signal,
  );
  vi.spyOn(api, 'neighbors')
    .mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error('Falha de rede'));
  const restored = await restoreView(
    api,
    'view',
    new AbortController().signal,
    () => 5,
  );
  expect(restored.partial).toBe(true);
  expect(restored.ledger.generation).toBe(6);
  expect(visible(restored.ledger).nodes).toEqual(first.nodes);
  expect(visible(restored.ledger).relations).toEqual(first.relations);
});
it('cursor repetido encerra a paginação sem perder o recorte já restaurado', async () => {
  const { api } = await setup();
  const first = await api.neighbors(
    ids.jung,
    defaultFilters,
    null,
    new AbortController().signal,
  );
  const neighbors = vi.spyOn(api, 'neighbors').mockResolvedValue(first);
  const restored = await restoreView(
    api,
    'view',
    new AbortController().signal,
    () => 0,
  );
  expect(neighbors).toHaveBeenCalledTimes(2);
  expect(restored.partial).toBe(true);
  expect(visible(restored.ledger).relations).toEqual(first.relations);
});
it('resposta tardia após cancelamento não conclui restauração', async () => {
  const { api } = await setup();
  const controller = new AbortController();
  const first = await api.neighbors(
    ids.jung,
    defaultFilters,
    null,
    controller.signal,
  );
  vi.spyOn(api, 'neighbors').mockImplementation(async () => {
    controller.abort();
    return { ...first, nextCursor: null };
  });
  await expect(
    restoreView(api, 'view', controller.signal, () => 0),
  ).rejects.toMatchObject({ name: 'AbortError' });
});

it('rejeita uma view sem ponto raiz', async () => {
  const { api, view } = await setup();
  vi.spyOn(api, 'detail').mockResolvedValue({ ...view, rootNodeId: null });
  const node = vi.spyOn(api, 'node');

  await expect(
    restoreView(api, 'view', new AbortController().signal, () => 0),
  ).rejects.toThrow('Esta view não tem ponto raiz. Escolha um ponto no mapa.');
  expect(node).not.toHaveBeenCalled();
});

it('rejeita uma raiz arquivada antes de restaurar as expansões', async () => {
  const { api } = await setup();
  const root = await api.node(ids.jung, new AbortController().signal);
  vi.spyOn(api, 'node').mockResolvedValue({ ...root, status: 'archived' });
  const neighbors = vi.spyOn(api, 'neighbors');

  await expect(
    restoreView(api, 'view', new AbortController().signal, () => 0),
  ).rejects.toThrow(
    'A raiz desta view foi arquivada. Escolha outro ponto para iniciar um recorte.',
  );
  expect(neighbors).not.toHaveBeenCalled();
});

it('marca como parcial a expansão de um ponto que não está visível', async () => {
  const { api, view } = await setup();
  vi.spyOn(api, 'detail').mockResolvedValue({
    ...view,
    expandedNodes: ['ponto-ausente'],
  });
  const neighbors = vi.spyOn(api, 'neighbors');

  const restored = await restoreView(
    api,
    'view',
    new AbortController().signal,
    () => 0,
  );

  expect(restored.partial).toBe(true);
  expect(visible(restored.ledger).nodes.map((node) => node.id)).toEqual([
    ids.jung,
  ]);
  expect(neighbors).not.toHaveBeenCalled();
});

it('marca limite de expansão como restauração parcial', async () => {
  const { api } = await setup();
  const root = await api.node(ids.jung, new AbortController().signal);
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    ...root,
    id: index === 0 ? root.id : `restored-${index}`,
    label: `Ponto ${index}`,
  }));
  const neighbors = vi
    .spyOn(api, 'neighbors')
    .mockResolvedValueOnce({
      nodes: firstPage,
      relations: [],
      nextCursor: 'next-page',
      truncated: false,
    })
    .mockResolvedValueOnce({
      nodes: [{ ...root, id: 'overflow', label: 'Ponto excedente' }],
      relations: [],
      nextCursor: null,
      truncated: false,
    });

  const restored = await restoreView(
    api,
    'view',
    new AbortController().signal,
    () => 0,
  );

  expect(neighbors).toHaveBeenCalledTimes(2);
  expect(restored.partial).toBe(true);
  expect(visible(restored.ledger).nodes).toHaveLength(500);
  expect(
    visible(restored.ledger).nodes.some((node) => node.id === 'overflow'),
  ).toBe(false);
});
