// EXCLUSIVAMENTE DEV/TEST. Todos os nomes/afirmações/trechos abaixo são fictícios.
// Formatos seguem o contrato da API (contracts/openapi.json).
import { createApi } from '../api/adapter';
import { ApiError } from '../api/client';
import type { RequestOptions } from '../api/client';
import { defaultFilters, toStoredFilters } from '../api/domain';
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
const baseImports: ImportDetail[] = [
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
const basePending: PendingItem[] = [
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
// Campos que a API preenche ao criar cada tipo de registro.
const createDefaults: Record<string, Record<string, unknown>> = {
  nodes: { degreeTotal: 0, archivedAt: null, aliases: [], contexts: [] },
  relations: { archivedAt: null, evidence: [] },
  sources: {},
  contexts: {},
  views: {},
};
interface FixtureDataset {
  nodes: Node[];
  relations: Relation[];
  sources: Source[];
  contexts: Context[];
  views: SavedView[];
  catalog: Catalog;
  imports: ImportDetail[];
  pending: PendingItem[];
}
/**
 * Infraestrutura de roteamento fictícia compartilhada: `createFixtureServices`
 * (dataset base dos 161 testes) e `createAtlasPreviewServices` (cenário
 * isolado de fidelidade visual, rodada 3) são a MESMA máquina, só com dados
 * diferentes — nenhuma rota ou formato muda entre as duas.
 */
function buildFixtureServices(
  seed: FixtureDataset,
): Services & { session: NonNullable<Services['session']> } {
  if (import.meta.env.PROD) throw new Error('Fixtures proibidas em produção.');
  let logged = false;
  const db: Record<string, Entity[]> = structuredClone({
    nodes: seed.nodes,
    relations: seed.relations,
    sources: seed.sources,
    contexts: seed.contexts,
    views: seed.views,
  });
  const imports: ImportDetail[] = structuredClone(seed.imports);
  const pending: PendingItem[] = structuredClone(seed.pending);
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
      catalog: () => seed.catalog,
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
export function createFixtureServices(): Services & {
  session: NonNullable<Services['session']>;
} {
  return buildFixtureServices({
    nodes,
    relations,
    sources,
    contexts,
    views: [],
    catalog,
    imports: baseImports,
    pending: basePending,
  });
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

// ===== Cenário isolado de aceitação visual (rodada 3, fidelidade ao Atlas) =====
// Reproduz EXATAMENTE os 12 nós/16 relações/fontes ilustrativos do protótipo
// aprovado (direcoes-visuais-rodada-2, opção A — ver `NOS`/`RELS`/`FONTES` no
// HTML original), para comparar fidelidade de renderização e layout com a
// MESMA composição e o mesmo conteúdo, sem tocar no dataset base acima
// (usado pelos testes unitários/integração/E2E). Só é alcançado por
// `/map?atlas=preview&view=<atlasPreviewViewId>`; nunca é lido no fluxo
// normal da demonstração fictícia nem entra no bundle de produção (mesma
// guarda `import.meta.env.DEV && VITE_ENABLE_FIXTURES` de main.tsx).
const atlasIds = {
  plotino: '00000000-0000-4000-a000-000000000001',
  ficino: '00000000-0000-4000-a000-000000000002',
  pico: '00000000-0000-4000-a000-000000000003',
  jung: '00000000-0000-4000-a000-000000000004',
  bohme: '00000000-0000-4000-a000-000000000005',
  emanacao: '00000000-0000-4000-a000-000000000006',
  almaDoMundo: '00000000-0000-4000-a000-000000000007',
  inconscienteColetivo: '00000000-0000-4000-a000-000000000008',
  corpusHermeticum: '00000000-0000-4000-a000-000000000009',
  hermetismo: '00000000-0000-4000-a000-000000000010',
  teosofia: '00000000-0000-4000-a000-000000000011',
  cabalaCrista: '00000000-0000-4000-a000-000000000012',
  antiguidadeTardia: '00000000-0000-4000-a000-000000000020',
  renascimentoFlorentino: '00000000-0000-4000-a000-000000000021',
  modernidade: '00000000-0000-4000-a000-000000000022',
  view: '00000000-0000-4000-a000-000000000099',
  srcFicino1: '00000000-0000-4000-a000-000000000201',
  srcFicino2: '00000000-0000-4000-a000-000000000202',
  srcFicino3: '00000000-0000-4000-a000-000000000203',
  srcJung1: '00000000-0000-4000-a000-000000000204',
  srcJung2: '00000000-0000-4000-a000-000000000205',
  srcPlotino1: '00000000-0000-4000-a000-000000000206',
  srcPlotino2: '00000000-0000-4000-a000-000000000207',
  srcGenerico1: '00000000-0000-4000-a000-000000000208',
  srcGenerico2: '00000000-0000-4000-a000-000000000209',
};
export const atlasPreviewViewId = atlasIds.view;
const ilustrativo =
  'Ponto ilustrativo do protótipo aprovado (direcoes-visuais-rodada-2), reaproveitado só nesta fixture isolada de comparação visual — não é uma afirmação histórica.';
const atlasResumos: Partial<Record<string, string>> = {
  [atlasIds.ficino]:
    'Tradutor e comentador que reintroduz Platão e o corpo hermético no latim florentino, organizando em torno da Academia uma leitura contínua entre filosofia antiga e teologia cristã.',
  [atlasIds.plotino]:
    'Centro da leitura neoplatônica que Ficino traduz e comenta; a doutrina da emanação chega ao Renascimento sobretudo por esse caminho.',
  [atlasIds.jung]:
    'Lê a tradição hermética e a teosofia como documentos psicológicos; a leitura é interpretativa e aparece no atlas com essa classificação.',
  [atlasIds.corpusHermeticum]:
    'Conjunto de tratados atribuídos a Hermes Trismegisto, traduzido em 1471 e lido no Renascimento como anterior a Platão.',
};
function atlasNode(
  id: string,
  label: string,
  kind: Node['kind'],
  degreeTotal: number,
  contextId: string,
): Node {
  return node(id, label, kind, {
    description: atlasResumos[id] ?? ilustrativo,
    contexts: [contextId],
    degreeTotal,
  });
}
const atlasNodes: Node[] = [
  atlasNode(
    atlasIds.plotino,
    'Plotino',
    'person',
    2,
    atlasIds.antiguidadeTardia,
  ),
  atlasNode(
    atlasIds.emanacao,
    'Emanação',
    'concept',
    2,
    atlasIds.antiguidadeTardia,
  ),
  atlasNode(
    atlasIds.corpusHermeticum,
    'Corpus Hermeticum',
    'work',
    2,
    atlasIds.antiguidadeTardia,
  ),
  atlasNode(
    atlasIds.hermetismo,
    'Hermetismo',
    'tradition',
    3,
    atlasIds.antiguidadeTardia,
  ),
  atlasNode(
    atlasIds.pico,
    'Pico della Mirandola',
    'person',
    3,
    atlasIds.renascimentoFlorentino,
  ),
  atlasNode(
    atlasIds.ficino,
    'Marsílio Ficino',
    'person',
    5,
    atlasIds.renascimentoFlorentino,
  ),
  atlasNode(
    atlasIds.almaDoMundo,
    'Alma do mundo',
    'concept',
    3,
    atlasIds.renascimentoFlorentino,
  ),
  atlasNode(
    atlasIds.cabalaCrista,
    'Cabala cristã',
    'tradition',
    2,
    atlasIds.renascimentoFlorentino,
  ),
  atlasNode(atlasIds.jung, 'C. G. Jung', 'person', 3, atlasIds.modernidade),
  atlasNode(
    atlasIds.inconscienteColetivo,
    'Inconsciente coletivo',
    'concept',
    2,
    atlasIds.modernidade,
  ),
  atlasNode(atlasIds.bohme, 'Jakob Böhme', 'person', 3, atlasIds.modernidade),
  atlasNode(
    atlasIds.teosofia,
    'Teosofia',
    'tradition',
    2,
    atlasIds.modernidade,
  ),
];
const atlasSources: Source[] = [
  {
    ...base,
    id: atlasIds.srcFicino1,
    title: 'A tradição hermética no Renascimento florentino',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1964',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcFicino2,
    title: 'Notas sobre a Academia e seus tradutores',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1943',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcFicino3,
    title: 'Prefácio ao Pimander (edição ilustrativa)',
    authorText: 'Fonte primária ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1471',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcJung1,
    title: 'Leituras psicológicas da tradição hermética',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1944',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcJung2,
    title: 'Correspondência comentada, vol. II (ilustrativo)',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1953',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcPlotino1,
    title: 'Comentário às Enéadas (edição ilustrativa)',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1958',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcPlotino2,
    title: 'Notas de recepção latina',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: '1971',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcGenerico1,
    title: 'Verbete ilustrativo do acervo',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: 's.d.',
    doi: null,
    accessedAt: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.srcGenerico2,
    title: 'Nota de leitura (ilustrativa)',
    authorText: 'Autoria ilustrativa',
    canonicalUrl: null,
    workNodeId: null,
    publicationLabel: 's.d.',
    doi: null,
    accessedAt: null,
    notes: null,
  },
];
function atlasEvidence(sourceId: string, excerpt: string) {
  return {
    sourceId,
    sourceKind: 'secondary' as const,
    stance: 'contextualizes' as const,
    locator: '',
    excerpt,
    explanation: '',
    conversationReference: null,
  };
}
const ficinoEvidence = [
  atlasEvidence(
    atlasIds.srcFicino1,
    'A encomenda de Cosimo interrompe a tradução de Platão: o corpo hermético é vertido primeiro, por ser julgado mais antigo.',
  ),
  atlasEvidence(
    atlasIds.srcFicino2,
    'A noção de alma do mundo aparece comentada, não declarada: por isso a relação entra como interpretação atribuída.',
  ),
  atlasEvidence(
    atlasIds.srcFicino3,
    'Dedica a tradução ao mecenas e descreve a ordem em que os tratados foram vertidos.',
  ),
];
const jungEvidence = [
  atlasEvidence(
    atlasIds.srcJung1,
    'A leitura é declaradamente interpretativa: o próprio autor a apresenta como analogia, não como filiação histórica.',
  ),
  atlasEvidence(
    atlasIds.srcJung2,
    'Menciona a leitura dos tratados e o interesse pela teosofia alemã em dois momentos distintos.',
  ),
];
const plotinoEvidence = [
  atlasEvidence(
    atlasIds.srcPlotino1,
    'A doutrina da emanação aparece sistematizada nos tratados centrais, sem a terminologia posterior.',
  ),
  atlasEvidence(
    atlasIds.srcPlotino2,
    'A circulação no Renascimento depende da tradução florentina; antes dela, as cópias são raras.',
  ),
];
const genericEvidence = [
  atlasEvidence(
    atlasIds.srcGenerico1,
    'Registro sintético criado para demonstrar a hierarquia de publicação no painel de evidências.',
  ),
  atlasEvidence(
    atlasIds.srcGenerico2,
    'Segunda entrada sintética, para mostrar como duas fontes convivem sem virar caixas repetidas.',
  ),
];
function evidenceFor(sourceId: string) {
  if (sourceId === atlasIds.ficino) return ficinoEvidence;
  if (sourceId === atlasIds.jung) return jungEvidence;
  if (sourceId === atlasIds.plotino) return plotinoEvidence;
  return genericEvidence;
}
function atlasRelation(
  id: string,
  sourceId: string,
  targetId: string,
  type: string,
  label: string,
  evidenceStatus: Relation['evidenceStatus'],
  intensity: Relation['intensity'],
  contested: boolean,
): Relation {
  return {
    ...base,
    id,
    sourceId,
    targetId,
    type,
    contextId: null,
    claim: `${label} (cenário ilustrativo, protótipo aprovado).`,
    justification:
      'Justificativa sintética: reproduz a relação do protótipo aprovado para comparação visual.',
    evidenceStatus,
    intensity,
    intensityReason: null,
    attributionNodeId: null,
    attributionText: null,
    inferenceAuthor:
      evidenceStatus === 'inference' ? 'Autoria ilustrativa' : null,
    contested,
    contestationNote: contested
      ? 'Relação contestada no protótipo aprovado (cenário ilustrativo).'
      : null,
    evidence: evidenceFor(sourceId),
    archivedAt: null,
  };
}
// Mesmas 16 relações do HTML de referência (`RELS`), mesma ordem, mesmos
// verbos/classificações/intensidades/contestação — nenhuma adicionada,
// nenhuma omitida.
const atlasRelations: Relation[] = [
  atlasRelation(
    '00000000-0000-4000-a000-000000000101',
    atlasIds.plotino,
    atlasIds.emanacao,
    'formulated',
    'Plotino formula a emanação',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000102',
    atlasIds.corpusHermeticum,
    atlasIds.hermetismo,
    'founded',
    'Corpus Hermeticum funda o Hermetismo',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000103',
    atlasIds.ficino,
    atlasIds.corpusHermeticum,
    'translates',
    'Ficino traduz o Corpus Hermeticum',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000104',
    atlasIds.ficino,
    atlasIds.plotino,
    'translates',
    'Ficino traduz Plotino',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000105',
    atlasIds.ficino,
    atlasIds.almaDoMundo,
    'formulated',
    'Ficino formula a alma do mundo',
    'attributed_interpretation',
    2,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000106',
    atlasIds.ficino,
    atlasIds.pico,
    'influenced',
    'Ficino influencia Pico della Mirandola',
    'documented',
    2,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000107',
    atlasIds.ficino,
    atlasIds.hermetismo,
    'transmitted',
    'Ficino difunde o Hermetismo',
    'attributed_interpretation',
    2,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000108',
    atlasIds.pico,
    atlasIds.cabalaCrista,
    'founded',
    'Pico della Mirandola funda a cabala cristã',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000109',
    atlasIds.pico,
    atlasIds.almaDoMundo,
    'commented_on',
    'Pico della Mirandola comenta a alma do mundo',
    'attributed_interpretation',
    1,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000110',
    atlasIds.bohme,
    atlasIds.teosofia,
    'founded',
    'Böhme funda a teosofia',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000111',
    atlasIds.bohme,
    atlasIds.almaDoMundo,
    'resumed',
    'Böhme retoma a alma do mundo',
    'attributed_interpretation',
    1,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000112',
    atlasIds.jung,
    atlasIds.bohme,
    'read',
    'Jung lê Jakob Böhme',
    'documented',
    2,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000113',
    atlasIds.jung,
    atlasIds.inconscienteColetivo,
    'formulated',
    'Jung formula o inconsciente coletivo',
    'documented',
    3,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000114',
    atlasIds.jung,
    atlasIds.hermetismo,
    'studied',
    'Jung estuda o Hermetismo',
    'documented',
    2,
    false,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000115',
    atlasIds.inconscienteColetivo,
    atlasIds.emanacao,
    'echoed',
    'Inconsciente coletivo ecoa a emanação',
    'inference',
    1,
    true,
  ),
  atlasRelation(
    '00000000-0000-4000-a000-000000000116',
    atlasIds.cabalaCrista,
    atlasIds.teosofia,
    'preceded',
    'Cabala cristã antecede a teosofia',
    'inference',
    1,
    false,
  ),
];
const atlasCatalog: Catalog = {
  nodeKinds: [...kinds],
  relationTypes: [
    { code: 'formulated', label: 'formula' },
    { code: 'founded', label: 'funda' },
    { code: 'translates', label: 'traduz' },
    { code: 'influenced', label: 'influencia' },
    { code: 'transmitted', label: 'difunde' },
    { code: 'commented_on', label: 'comenta' },
    { code: 'read', label: 'lê' },
    { code: 'resumed', label: 'retoma' },
    { code: 'echoed', label: 'ecoa' },
    { code: 'preceded', label: 'antecede' },
    { code: 'studied', label: 'estuda' },
  ].map((t) => ({
    ...t,
    inverseLabel: `leitura inversa: ${t.label}`,
    symmetric: false,
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
const atlasContexts: Context[] = [
  {
    ...base,
    id: atlasIds.antiguidadeTardia,
    label: 'Antiguidade tardia',
    regionLabel: 'Mediterrâneo oriental (ilustrativo)',
    startYear: 200,
    endYear: 600,
    precision: 'approximate',
    periodLabel: 'séc. III – VI',
    traditionNodeId: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.renascimentoFlorentino,
    label: 'Renascimento florentino',
    regionLabel: 'Florença (ilustrativo)',
    startYear: 1400,
    endYear: 1600,
    precision: 'approximate',
    periodLabel: 'séc. XV – XVI',
    traditionNodeId: null,
    notes: null,
  },
  {
    ...base,
    id: atlasIds.modernidade,
    label: 'Modernidade',
    regionLabel: 'Europa (ilustrativo)',
    startYear: 1600,
    endYear: 2000,
    precision: 'approximate',
    periodLabel: 'séc. XVII – XX',
    traditionNodeId: null,
    notes: null,
  },
];
// Posições convertidas das coordenadas percentuais `NOS` do protótipo
// (left/top em % do palco) para o espaço de modelo do Cytoscape:
// model = (percentual − 50) × 10 — escala uniforme nos dois eixos para
// preservar a proporção/relação espacial real do layout de referência.
const atlasPositions: Record<string, { x: number; y: number }> = {
  [atlasIds.plotino]: { x: -380, y: -230 },
  [atlasIds.emanacao]: { x: -405, y: -90 },
  [atlasIds.corpusHermeticum]: { x: -350, y: 50 },
  [atlasIds.hermetismo]: { x: -390, y: 190 },
  [atlasIds.pico]: { x: -40, y: -260 },
  [atlasIds.ficino]: { x: -90, y: -70 },
  [atlasIds.almaDoMundo]: { x: -20, y: 90 },
  [atlasIds.cabalaCrista]: { x: -65, y: 230 },
  [atlasIds.jung]: { x: 280, y: -200 },
  [atlasIds.inconscienteColetivo]: { x: 320, y: -40 },
  [atlasIds.bohme]: { x: 240, y: 100 },
  [atlasIds.teosofia]: { x: 290, y: 240 },
};
const atlasView: SavedView = {
  ...base,
  id: atlasIds.view,
  name: 'Atlas — cenário de aceitação visual (ilustrativo)',
  rootNodeId: atlasIds.jung,
  filters: toStoredFilters(defaultFilters),
  expandedNodes: atlasNodes.map((n) => n.id),
  positions: atlasPositions,
  // zoom/pan medidos no app real a 1440×960 (ver fidelidade-atlas): ajusta o
  // bbox completo dos 12 nós + títulos de contexto no canvas disponível,
  // sem cortar nada. Recalcular aqui se `atlasPositions` mudar de escala.
  viewport: { zoom: 1, pan: { x: 520, y: 420 } },
};
export function createAtlasPreviewServices(): Services & {
  session: NonNullable<Services['session']>;
} {
  return buildFixtureServices({
    nodes: atlasNodes,
    relations: atlasRelations,
    sources: atlasSources,
    contexts: atlasContexts,
    views: [atlasView],
    catalog: atlasCatalog,
    imports: [],
    pending: [],
  });
}
