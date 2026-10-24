// EXCLUSIVAMENTE DEV/TEST. Todos os nomes/afirmações/trechos abaixo são fictícios.
import { createApi } from '../api/adapter';
import { ApiError } from '../api/client';
import type { RequestOptions } from '../api/client';
import type {
  Entity,
  Node,
  Relation,
  Catalog,
  SavedView,
  Context,
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
};
const base = {
  description:
    'Registro sintético para testar a interface; não é uma afirmação histórica.',
  version: '"1"',
  status: 'active' as const,
};
const nodes: Node[] = [
  {
    ...base,
    id: ids.jung,
    label: 'Jung (exemplo fictício)',
    kind: 'person',
    aliases: ['Jung'],
    conceptScope: '',
    contexts: [ids.context],
    degreeTotal: 3,
  },
  {
    ...base,
    id: ids.gnosis,
    label: 'Gnosticismo (exemplo fictício)',
    kind: 'tradition',
    aliases: [],
    conceptScope: '',
    contexts: [ids.context],
    degreeTotal: 3,
  },
  {
    ...base,
    id: ids.concept,
    label: 'Conceito compartilhado fictício',
    kind: 'concept',
    aliases: [],
    conceptScope: 'Interpretação de teste',
    contexts: [],
    degreeTotal: 2,
  },
  {
    ...base,
    id: ids.work,
    label: 'Obra de demonstração',
    kind: 'work',
    aliases: [],
    conceptScope: '',
    contexts: [],
    degreeTotal: 1,
  },
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
    label: 'Relação de demonstração',
    sourceId,
    targetId,
    type,
    claim:
      'Afirmação inteiramente fictícia para validar o painel de evidências.',
    justification: 'Justificativa sintética, sem validade histórica.',
    context: ids.context,
    evidenceStatus: 'attributed_interpretation',
    intensity: 2,
    intensityReason: 'Relevância fictícia no cenário de teste.',
    attribution: 'Autoria de demonstração',
    contested: true,
    evidence: [
      {
        sourceId: ids.source,
        role: 'contextualizes',
        sourceRole: 'secondary',
        excerpt: 'Trecho fictício: este material existe apenas para teste.',
        locator: 'Página fictícia 12',
      },
    ],
  };
}
const relations = [
  relation(ids.relation, ids.jung, ids.gnosis),
  relation('00000000-0000-4000-8000-000000000008', ids.jung, ids.concept),
  {
    ...relation(
      '00000000-0000-4000-8000-000000000009',
      ids.gnosis,
      ids.concept,
      'parallel_to',
    ),
    evidenceStatus: 'inference' as const,
    evidence: [],
  },
  {
    ...relation('00000000-0000-4000-8000-000000000010', ids.jung, ids.gnosis),
    evidenceStatus: 'documented' as const,
    contested: false,
  },
];
const kinds = [
  { id: 'person', label: 'Pessoa' },
  { id: 'tradition', label: 'Tradição' },
  { id: 'concept', label: 'Conceito' },
  { id: 'work', label: 'Obra' },
] as const;
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
  kinds: [...kinds],
  predicates: predicateNames.map((id, i) => ({
    id,
    label: labels[i] ?? id,
    inverse: `leitura inversa: ${labels[i] ?? id}`,
    symmetric: ['parallel_to', 'differs_from'].includes(id),
    sourceKinds: kinds.map((k) => k.id),
    targetKinds: kinds.map((k) => k.id),
  })),
};
export function createFixtureServices(): Services {
  if (import.meta.env.PROD) throw new Error('Fixtures proibidas em produção.');
  let logged = false;
  const db: Record<string, Entity[]> = structuredClone({
    nodes,
    relations,
    sources: [
      {
        ...base,
        id: ids.source,
        label: 'Fonte sintética de demonstração',
        author: 'Autor fictício',
        url: 'https://example.com/fonte-ficticia',
      },
    ],
    contexts: [
      {
        ...base,
        id: ids.context,
        label: 'Contexto fictício',
        region: 'Região de teste',
        period: { start: 0, end: 100, approximate: true },
      },
    ],
    views: [] as SavedView[],
  });
  const imports = [
    {
      ...base,
      id: '00000000-0000-4000-8000-000000000020',
      label: 'Importação fictícia',
      at: '2026-10-24T12:00:00Z',
      created: [ids.jung],
      updated: [ids.gnosis],
      reused: [ids.source],
      pending: ['00000000-0000-4000-8000-000000000021'],
      conflicts: ['Exemplo fictício: registro editado após importação.'],
      undone: false,
    },
  ];
  const pending = [
    {
      ...base,
      id: '00000000-0000-4000-8000-000000000021',
      label: 'Homônimo fictício',
      reason: 'Escolha explicitamente um candidato; nenhum merge automático.',
      candidates: [ids.jung, ids.gnosis],
    },
  ];
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
      (node.status === 'pending' && params.get('pending') !== 'true')
    )
      return false;
    if (params.get('kind') && params.get('kind') !== node.kind) return false;
    if (
      params.get('context') &&
      !node.contexts.includes(params.get('context') ?? '')
    )
      return false;
    const periods = (db.contexts as Context[])
      .filter((context) => node.contexts.includes(context.id))
      .map((context) => context.period);
    const from = params.get('from');
    const to = params.get('to');
    if (
      !periods.length ||
      periods.every((period) => period.start === null && period.end === null)
    )
      return params.get('unknown') !== 'false';
    return periods.some(
      (period) =>
        (from === null || period.end === null || period.end >= Number(from)) &&
        (to === null || period.start === null || period.start <= Number(to)),
    );
  }
  async function send(
    path: string,
    options: RequestOptions = {},
  ): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 40));
    options.signal?.throwIfAborted();
    if (!logged) throw new ApiError(401, 'Entre na demonstração.');
    const url = new URL(path, 'https://fixture.invalid');
    const parts = url.pathname.split('/').filter(Boolean);
    const [type = '', id = '', operation = ''] = parts;
    const method = options.method ?? 'GET';
    const actionKey = `${path}:${options.idempotencyKey ?? ''}`;
    if (method === 'POST' && actions.has(actionKey))
      return structuredClone(actions.get(actionKey));
    let result: unknown;
    if (type === 'me') result = { id: 'fixture-user', name: 'Pessoa fictícia' };
    else if (type === 'catalog') result = catalog;
    else if (type === 'export') result = { fictitious: true, ...db };
    else if (type === 'pending') {
      if (method === 'POST') {
        const index = pending.findIndex((p) => p.id === id);
        if (index < 0) throw new ApiError(404, 'Pendência indisponível.');
        pending.splice(index, 1);
        result = {};
      } else result = page(pending, url.searchParams.get('cursor'));
    } else if (type === 'imports') {
      const item = imports.find((i) => i.id === id);
      if (operation === 'undo' && item) {
        item.undone = true;
        result = {
          message: 'Simulação fictícia de desfazer; conflitos preservados.',
          conflicts: item.conflicts,
        };
      } else result = id ? item : page(imports, url.searchParams.get('cursor'));
    } else if (operation === 'history')
      result = page(
        [
          {
            id: 'synthetic-history',
            at: '2026-10-24T12:00:00Z',
            action: 'created',
            description: 'Histórico inteiramente fictício.',
          },
        ],
        null,
      );
    else if (operation === 'neighbors') {
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
      result = {
        nodes: (db.nodes as Node[]).filter((n) => endpoints.has(n.id)),
        relations: selected,
        nextCursor: cursor + 2 < all.length ? String(cursor + 2) : null,
        truncated: false,
      };
    } else if (db[type]) {
      const collection = db[type];
      if (method === 'GET') {
        let items = collection;
        if (type === 'nodes') {
          const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase(
            'pt-BR',
          );
          items = items.filter((n) =>
            n.label.toLocaleLowerCase('pt-BR').includes(q),
          );
          items = (items as Node[]).filter((node) =>
            matches(node, url.searchParams),
          );
          const kind = url.searchParams.get('kind');
          if (kind) items = items.filter((n) => 'kind' in n && n.kind === kind);
          items = items.filter(
            (n) =>
              n.status !== 'archived' &&
              (url.searchParams.get('pending') === 'true' ||
                n.status !== 'pending'),
          );
        }
        result = id
          ? collection.find((e) => e.id === id)
          : page(items, url.searchParams.get('cursor'));
      } else {
        const body = options.body as Record<string, unknown>;
        if (method === 'PATCH') {
          const index = collection.findIndex((e) => e.id === id);
          const current = collection[index];
          if (!current) throw new ApiError(404, 'Registro não encontrado.');
          if (current.version !== options.version)
            throw new ApiError(409, 'Versão mudou; recarregue.');
          const updated = {
            ...current,
            ...body,
            id,
            version: `"${Number(current.version.replaceAll('"', '')) + 1}"`,
          } as Entity;
          collection[index] = updated;
          result = updated;
        } else {
          const created = {
            ...base,
            ...body,
            id: crypto.randomUUID(),
          } as Entity;
          collection.push(created);
          result = created;
        }
      }
    }
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
