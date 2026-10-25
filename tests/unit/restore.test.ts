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
    label: 'View sintética',
    description: '',
    version: '1',
    status: 'active',
    root: ids.jung,
    filters: defaultFilters,
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
