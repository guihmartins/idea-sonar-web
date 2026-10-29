import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../../src/api/adapter';
import type { RequestOptions } from '../../src/api/client';
import {
  defaultFilters,
  fromStoredFilters,
  toStoredFilters,
} from '../../src/api/domain';
import type { PendingItem } from '../../src/api/domain';
import { pendingTitle } from '../../src/components/labels';
import { formatAliases, parseAliases } from '../../src/pages/editor/payload';
import { createFixtureServices, ids } from '../../src/dev/fixtures';

function setup(response: unknown) {
  const send = vi.fn(
    async (_path: string, _options?: RequestOptions) => response,
  );
  return { send, api: createApi(send) };
}
const page = { items: [], nextCursor: null };
const signal = new AbortController().signal;
const pending: PendingItem = {
  id: 'p1',
  batchId: 'b1',
  batchVersion: 4,
  clientRef: 'ref-1',
  entityType: 'nodes',
  reason: 'Nome já existente',
  dependencies: [],
  payload: {
    nodes: [{ clientRef: 'ref-1', op: 'create', label: 'Proposto' }],
  },
};

describe('adapter alinhado ao contrato da API', () => {
  it('envia filtros com os nomes da API e omite vazios', async () => {
    const { api, send } = setup(page);
    await api.search(
      'jung',
      {
        ...defaultFilters,
        kind: 'person',
        contextId: 'ctx',
        includePending: true,
        startYear: 0,
      },
      'next',
      signal,
    );
    expect(send.mock.calls[0]?.[0]).toBe(
      '/nodes?q=jung&kind=person&contextId=ctx&includePending=true&startYear=0&includeUnknownPeriod=true&cursor=next&limit=50',
    );
  });
  it('PATCH envia a versão inteira em If-Match e POST usa Idempotency-Key', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const node = await services.api.node(ids.jung);
    const { api, send } = setup(node);
    await api.save('nodes', { label: 'x' }, 'key-1', node);
    expect(send.mock.calls[0]?.[1]).toMatchObject({
      method: 'PATCH',
      version: '1',
    });
    await api.save('nodes', { label: 'x' }, 'key-2');
    expect(send.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      idempotencyKey: 'key-2',
    });
  });
  it('desfazer e resolver enviam versão esperada, motivo e seleção', async () => {
    const { api, send } = setup({
      batchId: 'b1',
      status: 'undone',
      reason: 'motivo',
    });
    await api.undo('b1', 3, 'motivo', 'key');
    expect(send.mock.calls[0]).toEqual([
      '/imports/b1/undo',
      {
        method: 'POST',
        body: { expectedVersion: 3, reason: 'motivo' },
        idempotencyKey: 'key',
      },
    ]);
    const resolved = setup({
      id: 'p1',
      entityId: 'n1',
      version: 5,
      reason: 'ok',
    });
    await resolved.api.resolve(pending, 'n1', 'ok', 'key');
    expect(resolved.send.mock.calls[0]?.[1]?.body).toEqual({
      expectedVersion: 4,
      reason: 'ok',
      selection: { entityId: 'n1' },
    });
  });
  it('rejeita resposta fora do contrato', async () => {
    const { api } = setup({ id: 'x', version: '1' });
    await expect(api.node('x')).rejects.toThrow('fora do contrato');
  });
});

describe('conversões da interface', () => {
  it('filtros salvos omitem vazios e recuperam padrões', () => {
    const stored = toStoredFilters({
      ...defaultFilters,
      kind: 'work',
      endYear: -1,
    });
    expect(stored).toEqual({
      kind: 'work',
      includePending: false,
      endYear: -1,
      includeUnknownPeriod: true,
    });
    expect(fromStoredFilters(stored)).toEqual({
      ...defaultFilters,
      kind: 'work',
      endYear: -1,
    });
    expect(fromStoredFilters({})).toEqual(defaultFilters);
  });
  it('aliases preservam idioma e usam "und" quando ausente', () => {
    const aliases = parseAliases('Jung (de), C. G. Jung, Carl (pt-BR),  ');
    expect(aliases).toEqual([
      { alias: 'Jung', language: 'de' },
      { alias: 'C. G. Jung', language: 'und' },
      { alias: 'Carl', language: 'pt-BR' },
    ]);
    expect(formatAliases(aliases)).toBe('Jung (de), C. G. Jung, Carl (pt-BR)');
  });
  it('título da pendência vem do lote original ou do clientRef', () => {
    expect(pendingTitle(pending)).toBe('Proposto');
    expect(pendingTitle({ ...pending, payload: {} })).toBe('ref-1');
  });
});
