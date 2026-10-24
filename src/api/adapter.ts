// Adapter HTTP TEMPORÁRIO baseado nas rotas de referência do PLAN.md.
// Substituir mapeamento/DTOs pelo cliente gerado quando o snapshot for publicado.
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
  importSchema,
  historySchema,
  pageSchema,
} from './domain';
import type { EntityType, Filters, Entity } from './domain';
import type { RequestOptions, Transport } from './client';
const entitySchemas = {
  nodes: nodeSchema,
  relations: relationSchema,
  sources: sourceSchema,
  contexts: contextSchema,
  views: viewSchema,
};
function query(
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined && value !== '')
      params.set(key, String(value));
  return params.size ? `?${params}` : '';
}
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
        'Resposta incompatível com o adapter provisório. É necessário alinhar o contrato publicado pela API.',
      );
    return parsed.data;
  }
  return {
    me: () => read(z.object({ id: z.string(), name: z.string() }), '/me'),
    catalog: (signal?: AbortSignal) =>
      read(catalogSchema, '/catalog', signal ? { signal } : {}),
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
    node: (id: string, signal?: AbortSignal) =>
      read(
        nodeSchema,
        `/nodes/${encodeURIComponent(id)}`,
        signal ? { signal } : {},
      ),
    relation: (id: string, signal?: AbortSignal) =>
      read(
        relationSchema,
        `/relations/${encodeURIComponent(id)}`,
        signal ? { signal } : {},
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
        signal ? { signal } : {},
      ),
    detail: (type: EntityType, id: string, signal?: AbortSignal) =>
      read<Entity>(
        entitySchemas[type],
        `/${type}/${encodeURIComponent(id)}`,
        signal ? { signal } : {},
      ),
    save: (type: EntityType, body: unknown, key: string, entity?: Entity) =>
      read<Entity>(
        entitySchemas[type],
        `/${type}${entity ? `/${encodeURIComponent(entity.id)}` : ''}`,
        {
          method: entity ? 'PATCH' : 'POST',
          body,
          ...(entity ? { version: entity.version } : { idempotencyKey: key }),
        },
      ),
    imports: (cursor: string | null, signal: AbortSignal) =>
      read(
        pageSchema(importSchema),
        `/imports${query({ cursor, limit: 50 })}`,
        { signal },
      ),
    import: (id: string, signal: AbortSignal) =>
      read(importSchema, `/imports/${encodeURIComponent(id)}`, { signal }),
    undo: (id: string, key: string) =>
      read(
        z.object({ message: z.string(), conflicts: z.array(z.string()) }),
        `/imports/${encodeURIComponent(id)}/undo`,
        { method: 'POST', idempotencyKey: key },
      ),
    pending: (cursor: string | null, signal: AbortSignal) =>
      read(
        pageSchema(pendingSchema),
        `/pending${query({ cursor, limit: 50 })}`,
        { signal },
      ),
    resolve: (
      id: string,
      resolution: string,
      candidateId: string,
      key: string,
    ) =>
      send(`/pending/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        body: { resolution, candidateId },
        idempotencyKey: key,
      }),
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
