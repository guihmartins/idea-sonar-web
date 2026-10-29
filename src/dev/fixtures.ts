// EXCLUSIVAMENTE DEV/TEST. Todos os nomes/afirmações/trechos abaixo são fictícios.
// Formatos seguem o contrato da API (contracts/openapi.json).
import { createApi } from '../api/adapter';
import { ApiError } from '../api/client';
import type { RequestOptions } from '../api/client';
import type {
  Catalog,
  Context,
  Entity,
  HistoryEntry,
  ImportDetail,
  Node,
  PendingItem,
  Relation,
  SavedView,
  Source,
} from '../api/domain';
import type { Services } from '../app/services';
export const ids = {
  jung: '00000000-0000-4000-8000-000000000001',
  gnosis: '00000000-0000-4000-8000-000000000002',
  concept: '00000000-0000-4000-8000-000000000003',
  work: '00000000-0000-4000-8000-000000000004',
  source: '00000000-0000-4000-8000-000000000005',
  context: '00000000-0000-4000-8000-000000000006',
  relation: '00000000-0000-4000-8000-000000000007',
  import: '00000000-0000-4000-8000-000000000020',
  pending: '00000000-0000-4000-8000-000000000021',
};
const at = '2026-10-24T12:00:00.000Z';
const base = {
  version: 1,
  status: 'active' as const,
  createdAt: at,
  updatedAt: at,
};
function node(
  id: string,
  label: string,
  kind: Node['kind'],
  extra: Partial<Node> = {},
): Node {
  return {
    ...base,
    id,
    label,
    kind,
    description:
      'Registro sintético para testar a interface; não é uma afirmação histórica.',
    conceptScope: null,
    aliases: [],
    contexts: [],
    degreeTotal: 0,
    archivedAt: null,
    ...extra,
  };
}
const nodes: Node[] = [
  node(ids.jung, 'Jung (exemplo fictício)', 'person', {
    aliases: [{ alias: 'Jung', language: 'de' }],
    contexts: [ids.context],
    degreeTotal: 3,
  }),
  node(ids.gnosis, 'Gnosticismo (exemplo fictício)', 'tradition', {
    contexts: [ids.context],
    degreeTotal: 3,
  }),
  node(ids.concept, 'Conceito compartilhado fictício', 'concept', {
    conceptScope: 'broad',
    degreeTotal: 2,
  }),
  node(ids.work, 'Obra de demonstração', 'work', { degreeTotal: 1 }),
];
function relation(
  id: string,
  sourceId: string,
  targetId: string,
  type = 'studied',
): Relation {
  return {
    ...base,
    id,
    sourceId,
    targetId,
    type,
    contextId: ids.context,
    claim:
      'Afirmação inteiramente fictícia para validar o painel de evidências.',
    justification: 'Justificativa sintética, sem validade histórica.',
    evidenceStatus: 'attributed_interpretation',
    intensity: 2,
    intensityReason: 'Relevância fictícia no cenário de teste.',
    attributionNodeId: null,
    attributionText: 'Autoria de demonstração',
    inferenceAuthor: null,
    contested: true,
    contestationNote: 'Contestação fictícia do cenário de teste.',
    evidence: [
      {
        sourceId: ids.source,
        sourceKind: 'secondary',
        stance: 'contextualizes',
        excerpt: 'Trecho fictício: este material existe apenas para teste.',
        locator: 'Página fictícia 12',
        explanation: 'Explicação fictícia da evidência.',
        conversationReference: null,
      },
    ],
    archivedAt: null,
  };
}
const relations: Relation[] = [
  relation(ids.relation, ids.jung, ids.gnosis),
  relation('00000000-0000-4000-8000-000000000008', ids.jung, ids.concept),
  {
    ...relation(
      '00000000-0000-4000-8000-000000000009',
      ids.gnosis,
      ids.concept,
      'parallel_to',
    ),
    evidenceStatus: 'inference',
    attributionText: null,
    inferenceAuthor: 'Autoria de demonstração',
    evidence: [],
  },
  {
    ...relation('00000000-0000-4000-8000-000000000010', ids.jung, ids.gnosis),
    evidenceStatus: 'documented',
    contested: false,
    contestationNote: null,
  },
];
const kinds = ['person', 'tradition', 'concept', 'work'] as const;
const predicateNames = [
  'influenced',
  'formulated',
  'developed',
  'studied',
  'used',
  'adhered_to',
  'transmitted',
  'reinterpreted',
  'incorporated_from',
  'criticized',
  'part_of',
  'type_of',
  'contextualizes',
  'appears_in',
  'parallel_to',
  'differs_from',
];
const labels = [
  'influenciou',
  'formulou',
  'desenvolveu',
  'estudou',
  'utilizou',
  'aderiu a',
  'transmitiu',
  'reinterpretou',
  'incorporou de',
  'criticou',
  'parte de',
  'tipo de',
  'contextualiza',
  'aparece em',
  'paralelo a',
  'difere de',
];
const catalog: Catalog = {
  nodeKinds: [...kinds],
  relationTypes: predicateNames.map((code, i) => ({
    code,
    label: labels[i] ?? code,
    inverseLabel: `leitura inversa: ${labels[i] ?? code}`,
    symmetric: ['parallel_to', 'differs_from'].includes(code),
    allowedEndpoints: kinds.flatMap((source) =>
      kinds.map((target) => ({ source, target })),
    ),
  })),
  evidenceStatuses: ['documented', 'attributed_interpretation', 'inference'],
  editorialStatuses: ['active', 'pending', 'archived'],
  intensities: [
    { value: 1, label: 'pontual' },
    { value: 2, label: 'relevante' },
    { value: 3, label: 'central' },
    { value: null, label: 'não avaliada' },
  ],
};
const sources: Source[] = [
  {
    ...base,
    id: ids.source,
    title: 'Fonte sintética de demonstração',
    authorText: 'Autor fictício',
    canonicalUrl: 'https://example.com/fonte-ficticia',
    workNodeId: null,
    publicationLabel: null,
    doi: null,
    accessedAt: null,
    notes: null,
  },
];
const contexts: Context[] = [
  {
    ...base,
    id: ids.context,
    label: 'Contexto fictício',
    regionLabel: 'Região de teste',
    startYear: 0,
    endYear: 100,
    precision: 'approximate',
    periodLabel: null,
    traditionNodeId: null,
    notes: null,
  },
];
// Campos que a API preenche ao criar cada tipo de registro.
const createDefaults: Record<string, Record<string, unknown>> = {
  nodes: { degreeTotal: 0, archivedAt: null, aliases: [], contexts: [] },
  relations: { archivedAt: null, evidence: [] },
  sources: {},
  contexts: {},
  views: {},
};
export function createFixtureServices(): Services & {
  session: NonNullable<Services['session']>;
} {
  if (import.meta.env.PROD) throw new Error('Fixtures proibidas em produção.');
  let logged = false;
  const db: Record<string, Entity[]> = structuredClone({
    nodes,
    relations,
    sources,
    contexts,
    views: [] as SavedView[],
  });
  const imports: ImportDetail[] = [
    {
      id: ids.import,
      origin: 'chat',
      inputSummary: 'Importação fictícia',
      status: 'committed_with_pending',
      version: 1,
      createdAt: at,
      updatedAt: at,
      result: {
        created: 1,
        updated: 1,
        reused: 1,
        pending: 1,
        items: [
          {
            clientRef: 'jung',
            entityType: 'nodes',
            entityId: ids.jung,
            outcome: 'created',
            reason: null,
          },
          {
            clientRef: 'gnose',
            entityType: 'nodes',
            entityId: ids.gnosis,
            outcome: 'updated',
            reason: null,
          },
          {
            clientRef: 'fonte',
            entityType: 'sources',
            entityId: ids.source,
            outcome: 'reused',
            reason: null,
          },
          {
            clientRef: 'homonimo',
            entityType: 'nodes',
            entityId: null,
            outcome: 'pending',
            reason: 'Nome já existente; selecionar ID explicitamente',
          },
        ],
      },
    },
  ];
  const pending: PendingItem[] = [
    {
      id: ids.pending,
      batchId: ids.import,
      batchVersion: 1,
      clientRef: 'homonimo',
      entityType: 'nodes',
      reason: 'Nome já existente; selecionar ID explicitamente',
      dependencies: [],
      payload: {
        nodes: [
          {
            clientRef: 'homonimo',
            op: 'create',
            kind: 'person',
            label: 'Jung (exemplo fictício)',
            description: 'Homônimo fictício.',
          },
        ],
      },
    },
  ];
  const history = new Map<string, HistoryEntry[]>();
  const actions = new Map<string, unknown>();
  function page<T>(items: T[], cursor: string | null) {
    const start = Number(cursor ?? 0);
    return {
      items: items.slice(start, start + 2),
      nextCursor: start + 2 < items.length ? String(start + 2) : null,
    };
  }
  function matches(node: Node, params: URLSearchParams): boolean {
    if (
      node.status === 'archived' ||
      (node.status === 'pending' && params.get('includePending') !== 'true')
    )
      return false;
    if (params.get('kind') && params.get('kind') !== node.kind) return false;
    if (
      params.get('contextId') &&
      !node.contexts.includes(params.get('contextId') ?? '')
    )
      return false;
    return matchesPeriod(node, params);
  }
  function matchesPeriod(node: Node, params: URLSearchParams): boolean {
    const periods = (db.contexts as Context[]).filter((context) =>
      node.contexts.includes(context.id),
    );
    const from = params.get('startYear');
    const to = params.get('endYear');
    if (
      !periods.length ||
      periods.every((p) => p.startYear === null && p.endYear === null)
    )
      return params.get('includeUnknownPeriod') !== 'false';
    return periods.some(
      (p) =>
        (from === null || p.endYear === null || p.endYear >= Number(from)) &&
        (to === null || p.startYear === null || p.startYear <= Number(to)),
    );
  }
  function record(type: string, before: Entity | undefined, after: Entity) {
    const key = `${type}/${after.id}`;
    history.set(key, [
      ...(history.get(key) ?? []),
      {
        id: crypto.randomUUID(),
        operation: before ? 'update' : 'create',
        createdAt: new Date().toISOString(),
        versionAfter: after.version,
        batchId: null,
        beforeData: (before as Record<string, unknown> | undefined) ?? null,
        afterData: after as Record<string, unknown>,
      },
    ]);
  }
  function resolvePending(id: string, options: RequestOptions) {
    const body = options.body as {
      expectedVersion: number;
      reason: string;
      selection: { entityId: string };
    };
    const index = pending.findIndex((p) => p.id === id);
    const batch = imports.find((i) => i.id === pending[index]?.batchId);
    if (!batch) throw new ApiError(404, 'Pendência indisponível.');
    if (batch.version !== body.expectedVersion)
      throw new ApiError(409, 'Pendência alterada.');
    pending.splice(index, 1);
    batch.version += 1;
    batch.status = pending.some((p) => p.batchId === batch.id)
      ? 'committed_with_pending'
      : 'committed';
    return {
      id,
      entityId: body.selection.entityId,
      version: batch.version,
      reason: body.reason,
    };
  }
  function pendingResult(id: string, url: URL, options: RequestOptions) {
    if (options.method !== 'POST')
      return page(pending, url.searchParams.get('cursor'));
    return resolvePending(id, options);
  }
  function undoImport(item: ImportDetail, options: RequestOptions) {
    const body = options.body as { expectedVersion: number; reason: string };
    if (item.status === 'undone' || item.version !== body.expectedVersion)
      throw new ApiError(409, 'Lote alterado ou já desfeito.');
    item.status = 'undone';
    item.version += 1;
    return { batchId: item.id, status: 'undone', reason: body.reason };
  }
  function importResult(
    id: string,
    url: URL,
    operation: string,
    options: RequestOptions,
  ) {
    const item = imports.find((i) => i.id === id);
    if (operation === 'undo' && item) return undoImport(item, options);
    // A listagem real omite `result`; o schema de resumo descarta o campo.
    return id ? item : page(imports, url.searchParams.get('cursor'));
  }
  function historyResult(type: string, id: string) {
    return page(history.get(`${type}/${id}`) ?? [], null);
  }
  function neighborResult(id: string, url: URL) {
    const all = (db.relations as Relation[]).filter((r) => {
      if (r.sourceId !== id && r.targetId !== id) return false;
      const neighbor = (db.nodes as Node[]).find(
        (node) => node.id === (r.sourceId === id ? r.targetId : r.sourceId),
      );
      return !!neighbor && matches(neighbor, url.searchParams);
    });
    const cursor = Number(url.searchParams.get('cursor') ?? 0);
    const selected = all.slice(cursor, cursor + 2);
    const endpoints = new Set(
      selected.flatMap((r) => [r.sourceId, r.targetId]),
    );
    return {
      nodes: (db.nodes as Node[]).filter((n) => endpoints.has(n.id)),
      relations: selected,
      nextCursor: cursor + 2 < all.length ? String(cursor + 2) : null,
      truncated: false,
    };
  }
  function searchText(entity: Entity) {
    if ('title' in entity) return entity.title;
    return 'label' in entity ? entity.label : '';
  }
  function readCollection(
    type: string,
    id: string,
    url: URL,
    collection: Entity[],
  ) {
    if (id) return collection.find((e) => e.id === id);
    const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase('pt-BR');
    const items = collection.filter(
      (entity) =>
        searchText(entity).toLocaleLowerCase('pt-BR').includes(q) &&
        (type !== 'nodes' || matches(entity as Node, url.searchParams)),
    );
    return page(items, url.searchParams.get('cursor'));
  }
  function writeCollection(
    type: string,
    id: string,
    options: RequestOptions,
    collection: Entity[],
  ) {
    const body = options.body as Record<string, unknown>;
    const now = new Date().toISOString();
    if (options.method === 'PATCH') {
      const index = collection.findIndex((e) => e.id === id);
      const current = collection[index];
      if (!current) throw new ApiError(404, 'Registro não encontrado.');
      if (String(current.version) !== options.version)
        throw new ApiError(409, 'Versão mudou; recarregue.');
      const updated = {
        ...current,
        ...body,
        id,
        version: current.version + 1,
        updatedAt: now,
      } as Entity;
      collection[index] = updated;
      record(type, current, updated);
      return updated;
    }
    const created = {
      ...createDefaults[type],
      ...base,
      ...body,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as unknown as Entity;
    collection.push(created);
    record(type, undefined, created);
    return created;
  }
  function routeResult(
    type: string,
    id: string,
    operation: string,
    url: URL,
    options: RequestOptions,
  ) {
    const method = options.method ?? 'GET';
    const routes: Record<string, () => unknown> = {
      me: () => ({
        issuer: 'https://fixture.invalid/',
        subject: 'fixture-user',
        scopes: ['idea-sonar:read', 'idea-sonar:write', 'idea-sonar:undo'],
      }),
      catalog: () => catalog,
      export: () => ({
        contractVersion: '1',
        exportedAt: new Date().toISOString(),
        fictitious: true,
        ...db,
      }),
      pending: () => pendingResult(id, url, options),
      imports: () => importResult(id, url, operation, options),
    };
    if (routes[type]) return routes[type]();
    if (operation === 'history') return historyResult(type, id);
    if (operation === 'neighbors') return neighborResult(id, url);
    const collection = db[type];
    if (!collection) return undefined;
    return method === 'GET'
      ? readCollection(type, id, url, collection)
      : writeCollection(type, id, options, collection);
  }
  async function send(
    path: string,
    options: RequestOptions = {},
  ): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 40));
    options.signal?.throwIfAborted();
    if (!logged) throw new ApiError(401, 'Entre na demonstração.');
    const { url, type, id, operation, method, actionKey } = fixtureRequest(
      path,
      options,
    );
    if (method === 'POST' && actions.has(actionKey))
      return structuredClone(actions.get(actionKey));
    const result = routeResult(type, id, operation, url, options);
    if (result === undefined)
      throw new ApiError(404, 'Registro fictício não encontrado.');
    if (method === 'POST') actions.set(actionKey, structuredClone(result));
    return structuredClone(result);
  }
  return {
    fictitious: true,
    api: createApi(send),
    session: {
      authenticated: async () => logged,
      login: async () => {
        logged = true;
      },
      callback: async () => {},
      token: async () => 'fixture-only',
      logout: async () => {
        logged = false;
      },
    },
  };
}

function fixtureRequest(path: string, options: RequestOptions) {
  const url = new URL(path, 'https://fixture.invalid');
  const [type = '', id = '', operation = ''] = url.pathname
    .split('/')
    .filter(Boolean);
  const method = options.method ?? 'GET';
  const actionKey = `${path}:${options.idempotencyKey ?? ''}`;

  return { url, type, id, operation, method, actionKey };
}
