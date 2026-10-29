// Cliente HTTP da API: rotas e formatos conforme contracts/openapi.json; cada
// resposta é validada pelos schemas de domain.ts.
import { z } from 'zod';
import {
  catalogSchema,
  nodeSchema,
  relationSchema,
  neighborSchema,
  sourceSchema,
  contextSchema,
  viewSchema,
  pendingSchema,
  importSummarySchema,
  importDetailSchema,
  undoResultSchema,
  resolveResultSchema,
  historySchema,
  identitySchema,
  pageSchema,
} from './domain';
import type { EntityType, Filters, Entity, PendingItem } from './domain';
import type { RequestOptions, Transport } from './client';
const entitySchemas = {
  nodes: nodeSchema,
  relations: relationSchema,
  sources: sourceSchema,
  contexts: contextSchema,
  views: viewSchema,
};
export type CandidateType = 'nodes' | 'sources' | 'contexts';
function query(
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined && value !== '')
      params.set(key, String(value));
  return params.size ? `?${params}` : '';
}
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});
export function createApi(send: Transport) {
  async function read<T>(
    schema: z.ZodType<T>,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const data = await send(path, options);
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        'Resposta da API fora do contrato esperado. Confira se API e frontend usam o mesmo snapshot OpenAPI.',
      );
    return parsed.data;
  }
  return {
    me: () => read(identitySchema, '/me'),
    catalog: (signal?: AbortSignal) =>
      read(catalogSchema, '/catalog', withSignal(signal)),
    search: (
      q: string,
      filters: Filters,
      cursor: string | null,
      signal: AbortSignal,
    ) =>
      read(
        pageSchema(nodeSchema),
        `/nodes${query({ q, ...filters, cursor, limit: 50 })}`,
        { signal },
      ),
    candidates: (type: CandidateType, q: string, signal?: AbortSignal) =>
      read(
        pageSchema(entitySchemas[type]),
        `/${type}${query({ q, includePending: true, limit: 20 })}`,
        withSignal(signal),
      ),
    node: (id: string, signal?: AbortSignal) =>
      read(nodeSchema, `/nodes/${encodeURIComponent(id)}`, withSignal(signal)),
    relation: (id: string, signal?: AbortSignal) =>
      read(
        relationSchema,
        `/relations/${encodeURIComponent(id)}`,
        withSignal(signal),
      ),
    neighbors: (
      id: string,
      filters: Filters,
      cursor: string | null,
      signal: AbortSignal,
    ) =>
      read(
        neighborSchema,
        `/nodes/${encodeURIComponent(id)}/neighbors${query({ ...filters, cursor, limit: 50 })}`,
        { signal },
      ),
    list: (type: EntityType, cursor: string | null, signal?: AbortSignal) =>
      read(
        pageSchema(entitySchemas[type]),
        `/${type}${query({ cursor, limit: 50 })}`,
        withSignal(signal),
      ),
    detail: (type: EntityType, id: string, signal?: AbortSignal) =>
      read<Entity>(
        entitySchemas[type],
        `/${type}/${encodeURIComponent(id)}`,
        withSignal(signal),
      ),
    save: (type: EntityType, body: unknown, key: string, entity?: Entity) =>
      read<Entity>(
        entitySchemas[type],
        `/${type}${entity ? `/${encodeURIComponent(entity.id)}` : ''}`,
        {
          method: entity ? 'PATCH' : 'POST',
          body,
          ...(entity
            ? { version: String(entity.version) }
            : { idempotencyKey: key }),
        },
      ),
    imports: (cursor: string | null, signal: AbortSignal) =>
      read(
        pageSchema(importSummarySchema),
        `/imports${query({ cursor, limit: 50 })}`,
        { signal },
      ),
    import: (id: string, signal: AbortSignal) =>
      read(importDetailSchema, `/imports/${encodeURIComponent(id)}`, {
        signal,
      }),
    undo: (id: string, expectedVersion: number, reason: string, key: string) =>
      read(undoResultSchema, `/imports/${encodeURIComponent(id)}/undo`, {
        method: 'POST',
        body: { expectedVersion, reason },
        idempotencyKey: key,
      }),
    pending: (cursor: string | null, signal: AbortSignal) =>
      read(
        pageSchema(pendingSchema),
        `/pending${query({ cursor, limit: 50 })}`,
        { signal },
      ),
    resolve: (
      item: PendingItem,
      entityId: string,
      reason: string,
      key: string,
    ) =>
      read(
        resolveResultSchema,
        `/pending/${encodeURIComponent(item.id)}/resolve`,
        {
          method: 'POST',
          body: {
            expectedVersion: item.batchVersion,
            reason,
            selection: { entityId },
          },
          idempotencyKey: key,
        },
      ),
    history: (
      type: 'nodes' | 'relations',
      id: string,
      cursor: string | null,
      signal: AbortSignal,
    ) =>
      read(
        pageSchema(historySchema),
        `/${type}/${encodeURIComponent(id)}/history${query({ cursor })}`,
        { signal },
      ),
    export: () => send('/export'),
  };
}
export type Api = ReturnType<typeof createApi>;
