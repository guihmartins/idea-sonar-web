import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../../src/api/adapter';
import type { CandidateType } from '../../src/api/adapter';
import { createTransport } from '../../src/api/client';
import type { RequestOptions } from '../../src/api/client';
import { defaultFilters } from '../../src/api/domain';
import type {
  EntityType,
  ImportBatch,
  PendingItem,
} from '../../src/api/domain';
import { createFixtureServices, ids } from '../../src/dev/fixtures';

const page = { items: [], nextCursor: null };
const signal = new AbortController().signal;

function setup(response: unknown = page) {
  const send = vi.fn(async (_path: string, _options?: RequestOptions) =>
    structuredClone(response),
  );
  return { send, api: createApi(send) };
}
const path = (send: ReturnType<typeof setup>['send'], call = 0) =>
  send.mock.calls[call]?.[0];

describe('adapter — URLs de leitura', () => {
  it('search: filtros com os nomes da API, vazios e nulos omitidos, falso e zero mantidos', async () => {
    const { api, send } = setup();
    await api.search('', defaultFilters, null, signal);
    expect(path(send)).toBe(
      '/nodes?includePending=false&includeUnknownPeriod=true&limit=50',
    );
    await api.search(
      'Jung',
      {
        kind: 'person',
        contextId: 'ctx',
        includePending: true,
        startYear: 0,
        endYear: -3,
        includeUnknownPeriod: false,
      },
      'cur',
      signal,
    );
    expect(path(send, 1)).toBe(
      '/nodes?q=Jung&kind=person&contextId=ctx&includePending=true&startYear=0&endYear=-3&includeUnknownPeriod=false&cursor=cur&limit=50',
    );
    await api.search('á b&c', defaultFilters, null, signal);
    expect(path(send, 2)).toBe(
      '/nodes?q=%C3%A1+b%26c&includePending=false&includeUnknownPeriod=true&limit=50',
    );
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
  });

  it('match=exact só vai quando pedido, logo depois de q', async () => {
    const { api, send } = setup();
    await api.search('Jung', defaultFilters, null, signal, 'exact');
    expect(path(send)).toBe(
      '/nodes?q=Jung&match=exact&includePending=false&includeUnknownPeriod=true&limit=50',
    );
    await api.search('Jung', defaultFilters, null, signal, 'contains');
    expect(path(send, 1)).toContain('q=Jung&match=contains&');
    await api.candidates('nodes', 'Q1000001', signal, 'exact');
    expect(path(send, 2)).toBe(
      '/nodes?q=Q1000001&match=exact&includePending=true&limit=20',
    );
    await api.search('Jung', defaultFilters, null, signal);
    expect(path(send, 3)).not.toContain('match');
  });

  it.each<[CandidateType, string]>([
    ['nodes', '/nodes'],
    ['sources', '/sources'],
    ['contexts', '/contexts'],
  ])('candidates de %s inclui pendentes e limita a 20', async (type, base) => {
    const { api, send } = setup();
    await api.candidates(type, 'termo', signal);
    expect(path(send)).toBe(`${base}?q=termo&includePending=true&limit=20`);
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
    await api.candidates(type, '');
    expect(path(send, 1)).toBe(`${base}?includePending=true&limit=20`);
    expect(send.mock.calls[1]?.[1]).toEqual({});
  });

  it('neighbors: ID codificado, mesmos filtros e página de 50', async () => {
    const { api, send } = setup({
      nodes: [],
      relations: [],
      nextCursor: null,
      truncated: false,
    });
    await api.neighbors('a b/c', defaultFilters, null, signal);
    expect(path(send)).toBe(
      '/nodes/a%20b%2Fc/neighbors?includePending=false&includeUnknownPeriod=true&limit=50',
    );
    await api.neighbors(
      'n1',
      { ...defaultFilters, kind: 'work', contextId: 'c', startYear: 10 },
      'cursor-2',
      signal,
    );
    expect(path(send, 1)).toBe(
      '/nodes/n1/neighbors?kind=work&contextId=c&includePending=false&startYear=10&includeUnknownPeriod=true&cursor=cursor-2&limit=50',
    );
  });

  it.each<EntityType>(['nodes', 'relations', 'sources', 'contexts', 'views'])(
    'list de %s pagina de 50 em 50, com cursor só quando existe',
    async (type) => {
      const { api, send } = setup();
      await api.list(type, null);
      expect(path(send)).toBe(`/${type}?limit=50`);
      expect(send.mock.calls[0]?.[1]).toEqual({});
      await api.list(type, 'abc', signal);
      expect(path(send, 1)).toBe(`/${type}?cursor=abc&limit=50`);
      expect(send.mock.calls[1]?.[1]).toEqual({ signal });
    },
  );

  it('list: filtros de busca com os nomes da API, na ordem fixa, depois do cursor', async () => {
    const { api, send } = setup();
    await api.list('nodes', 'c2', signal, {
      includeUnknownPeriod: false,
      endYear: 0,
      startYear: -499,
      includePending: true,
      kind: 'figure',
      match: 'exact',
      q: 'Q42',
    });
    expect(path(send)).toBe(
      '/nodes?q=Q42&match=exact&kind=figure&includePending=true&startYear=-499&endYear=0&includeUnknownPeriod=false&cursor=c2&limit=50',
    );
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
  });

  it('list: omite filtro vazio, nulo ou indefinido e mantém zero e falso', async () => {
    const { api, send } = setup();
    await api.list('nodes', null, undefined, {
      q: '',
      match: undefined,
      kind: undefined,
      includePending: undefined,
      startYear: null,
      endYear: null,
      includeUnknownPeriod: undefined,
    });
    expect(path(send)).toBe('/nodes?limit=50');
    await api.list('nodes', null, undefined, {});
    expect(path(send, 1)).toBe('/nodes?limit=50');
    await api.list('nodes', null, undefined, {
      startYear: 0,
      endYear: 0,
      includePending: false,
    });
    expect(path(send, 2)).toBe(
      '/nodes?includePending=false&startYear=0&endYear=0&limit=50',
    );
  });

  it.each<EntityType>(['sources', 'contexts'])(
    'list de %s: busca, modo exato e pendentes',
    async (type) => {
      const { api, send } = setup();
      await api.list(type, null, signal, {
        q: 'Édipo & filhos',
        match: 'exact',
        includePending: true,
      });
      expect(path(send)).toBe(
        `/${type}?q=%C3%89dipo+%26+filhos&match=exact&includePending=true&limit=50`,
      );
      await api.list(type, 'c1', signal, { q: 'a', match: 'contains' });
      expect(path(send, 1)).toBe(
        `/${type}?q=a&match=contains&cursor=c1&limit=50`,
      );
    },
  );

  it('history: caminho por tipo e cursor opcional, sem limite', async () => {
    const { api, send } = setup();
    await api.history('nodes', 'n 1', null, signal);
    expect(path(send)).toBe('/nodes/n%201/history');
    await api.history('relations', 'r1', 'c2', signal);
    expect(path(send, 1)).toBe('/relations/r1/history?cursor=c2');
  });

  it('imports e pending: listas de 50 com cursor opcional', async () => {
    const { api, send } = setup();
    await api.imports(null, signal);
    await api.imports('i2', signal);
    await api.pending(null, signal);
    await api.pending('p2', signal);
    expect([0, 1, 2, 3].map((call) => path(send, call))).toEqual([
      '/imports?limit=50',
      '/imports?cursor=i2&limit=50',
      '/pending?limit=50',
      '/pending?cursor=p2&limit=50',
    ]);
  });

  it('as leituras paginadas e de lote repassam o sinal de cancelamento ao transporte', async () => {
    const { api, send } = setup();
    // As respostas vazias podem não passar no schema; só o pedido importa.
    const ignore = (pending: Promise<unknown>) =>
      pending.catch(() => undefined);
    await ignore(api.neighbors('n1', defaultFilters, null, signal));
    await ignore(api.imports(null, signal));
    await ignore(api.pending(null, signal));
    await ignore(api.history('nodes', 'n1', null, signal));
    for (const call of [0, 1, 2, 3])
      expect(send.mock.calls[call]?.[1]).toEqual({ signal });
    // O detalhe do lote devolve outro formato; só o pedido importa aqui.
    const detail = setup({ id: 'x' });
    await detail.api.import('lote 1', signal).catch(() => undefined);
    expect(path(detail.send)).toBe('/imports/lote%201');
    expect(detail.send.mock.calls[0]?.[1]).toEqual({ signal });
  });

  it('leituras de um registro codificam o ID e repassam o cancelamento', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const node = await services.api.node(ids.jung);
    const { api, send } = setup(node);
    await api.node('a/b', signal);
    await api.detail('nodes', 'a b', signal);
    await api.node('x');
    expect([0, 1, 2].map((call) => path(send, call))).toEqual([
      '/nodes/a%2Fb',
      '/nodes/a%20b',
      '/nodes/x',
    ]);
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
    expect(send.mock.calls[2]?.[1]).toEqual({});
    const relation = setup(
      await services.api.detail('relations', ids.relation),
    );
    await relation.api.relation('r/1', signal);
    expect(path(relation.send)).toBe('/relations/r%2F1');
    const imported = setup({
      id: 'i',
      origin: 'chat',
      inputSummary: 'x',
      status: 'committed',
      version: 1,
      createdAt: 'a',
      updatedAt: 'b',
      result: { created: 0, updated: 0, reused: 0, pending: 0, items: [] },
    });
    await imported.api.import('i/1', signal);
    expect(path(imported.send)).toBe('/imports/i%2F1');
  });

  it('catalog, me e export usam a rota simples', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const catalog = setup(await services.api.catalog());
    await catalog.api.catalog(signal);
    expect(path(catalog.send)).toBe('/catalog');
    expect(catalog.send.mock.calls[0]?.[1]).toEqual({ signal });
    await catalog.api.catalog();
    expect(catalog.send.mock.calls[1]?.[1]).toEqual({});
    const me = setup(await services.api.me());
    await me.api.me();
    expect(path(me.send)).toBe('/me');
    const exported = setup({ ok: true });
    expect(await exported.api.export()).toEqual({ ok: true });
    expect(exported.send.mock.calls[0]).toEqual(['/export']);
  });
});

describe('adapter — opções das escritas', () => {
  it('discard resolve com {discard: true}, sem registro, e aceita entityId nulo', async () => {
    const pending: PendingItem = {
      id: 'p 1',
      batchId: 'b',
      batchVersion: 4,
      clientRef: 'r',
      entityType: 'nodes',
      reason: null,
      dependencies: [],
      payload: {},
    };
    const { api, send } = setup({
      id: 'p 1',
      entityId: null,
      version: 5,
      reason: 'Duplicata',
    });
    const result = await api.discard(pending, 'Duplicata', 'k-desc');
    expect(result.entityId).toBeNull();
    expect(send.mock.calls[0]).toEqual([
      '/pending/p%201/resolve',
      {
        method: 'POST',
        body: {
          expectedVersion: 4,
          reason: 'Duplicata',
          selection: { discard: true },
        },
        idempotencyKey: 'k-desc',
      },
    ]);
  });

  it('save cria com POST e Idempotency-Key, e edita com PATCH e a versão', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const node = await services.api.node(ids.jung);
    const { api, send } = setup(node);
    await api.save('nodes', { label: 'x' }, 'chave-1');
    expect(send.mock.calls[0]).toEqual([
      '/nodes',
      { method: 'POST', body: { label: 'x' }, idempotencyKey: 'chave-1' },
    ]);
    await api.save('nodes', { label: 'y' }, 'ignorada', {
      ...node,
      id: 'a b',
      version: 7,
    });
    expect(send.mock.calls[1]).toEqual([
      '/nodes/a%20b',
      { method: 'PATCH', body: { label: 'y' }, version: '7' },
    ]);
    expect(send.mock.calls[1]?.[1]).not.toHaveProperty('idempotencyKey');
    expect(send.mock.calls[0]?.[1]).not.toHaveProperty('version');
  });

  it('undo, resolve e importBatch são POST com a chave de idempotência', async () => {
    const pending: PendingItem = {
      id: 'p 1',
      batchId: 'b',
      batchVersion: 4,
      clientRef: 'r',
      entityType: 'nodes',
      reason: null,
      dependencies: [],
      payload: {},
    };
    const undo = setup({ batchId: 'b 1', status: 'undone', reason: 'm' });
    await undo.api.undo('b 1', 3, 'm', 'k-undo');
    expect(undo.send.mock.calls[0]).toEqual([
      '/imports/b%201/undo',
      {
        method: 'POST',
        body: { expectedVersion: 3, reason: 'm' },
        idempotencyKey: 'k-undo',
      },
    ]);
    const resolve = setup({ id: 'p', entityId: 'e', version: 5, reason: 'ok' });
    await resolve.api.resolve(pending, 'entidade', 'ok', 'k-res');
    expect(resolve.send.mock.calls[0]).toEqual([
      '/pending/p%201/resolve',
      {
        method: 'POST',
        body: {
          expectedVersion: 4,
          reason: 'ok',
          selection: { entityId: 'entidade' },
        },
        idempotencyKey: 'k-res',
      },
    ]);
  });
});

// Mesmas chamadas, agora pelo transporte real com um fetch falso: o que de fato
// sai pela rede (URL, método, cabeçalhos e corpo).
describe('adapter + transporte — o que vai pela rede', () => {
  const body: ImportBatch = {
    contractVersion: '1',
    policyVersion: '1',
    idempotencyKey: 'chave-lote',
    origin: 'manual',
    inputSummary: 'Teste',
    dryRun: false,
    nodes: [],
  };
  async function network(response: unknown) {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(response));
    const api = createApi(
      createTransport('https://api.test/api/v1', null, fetcher),
    );
    return { api, fetcher };
  }
  const call = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) => {
    const [url, init] = fetcher.mock.calls[n]!;
    const headers = new Headers(init?.headers);
    return { url: String(url), init: init!, headers };
  };

  it('GET não tem corpo, Content-Type nem Authorization', async () => {
    const { api, fetcher } = await network(page);
    await api.candidates('sources', 'abc', signal);
    const { url, init, headers } = call(fetcher);
    expect(url).toBe(
      'https://api.test/api/v1/sources?q=abc&includePending=true&limit=20',
    );
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('X-Request-Id')).toBeTruthy();
    for (const name of [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'If-Match',
    ])
      expect(headers.has(name)).toBe(false);
  });

  it('POST de criação leva Idempotency-Key e JSON; PATCH leva If-Match e não a chave', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const node = await services.api.node(ids.jung);
    const { api, fetcher } = await network(node);
    await api.save('nodes', { label: 'x' }, 'chave-post');
    const post = call(fetcher, 0);
    expect(post.url).toBe('https://api.test/api/v1/nodes');
    expect(post.init.method).toBe('POST');
    expect(post.init.body).toBe('{"label":"x"}');
    expect(post.headers.get('Content-Type')).toBe('application/json');
    expect(post.headers.get('Idempotency-Key')).toBe('chave-post');
    expect(post.headers.has('If-Match')).toBe(false);
    await api.save('nodes', { label: 'y' }, 'outra', { ...node, version: 3 });
    const patch = call(fetcher, 1);
    expect(patch.url).toBe(`https://api.test/api/v1/nodes/${node.id}`);
    expect(patch.init.method).toBe('PATCH');
    expect(patch.init.body).toBe('{"label":"y"}');
    expect(patch.headers.get('If-Match')).toBe('3');
    expect(patch.headers.has('Idempotency-Key')).toBe(false);
  });

  it('undo, resolve e importBatch mandam POST JSON com a chave no cabeçalho', async () => {
    const undo = await network({ batchId: 'b', status: 'undone', reason: 'm' });
    await undo.api.undo('b', 2, 'm', 'k-undo');
    const undone = call(undo.fetcher);
    expect(undone.url).toBe('https://api.test/api/v1/imports/b/undo');
    expect(undone.init.method).toBe('POST');
    expect(undone.init.body).toBe('{"expectedVersion":2,"reason":"m"}');
    expect(undone.headers.get('Idempotency-Key')).toBe('k-undo');

    const resolve = await network({
      id: 'p',
      entityId: 'e',
      version: 2,
      reason: 'r',
    });
    await resolve.api.resolve(
      {
        id: 'p',
        batchId: 'b',
        batchVersion: 1,
        clientRef: 'c',
        entityType: 'nodes',
        reason: null,
        dependencies: [],
        payload: {},
      },
      'e',
      'r',
      'k-res',
    );
    const resolved = call(resolve.fetcher);
    expect(resolved.url).toBe('https://api.test/api/v1/pending/p/resolve');
    expect(resolved.init.method).toBe('POST');
    expect(resolved.init.body).toBe(
      '{"expectedVersion":1,"reason":"r","selection":{"entityId":"e"}}',
    );
    expect(resolved.headers.get('Idempotency-Key')).toBe('k-res');

    const batch = await network({
      batchId: 'b',
      status: 'committed',
      created: 0,
      updated: 0,
      reused: 0,
      pending: 0,
      discarded: 0,
      clientRefToId: {},
      items: [],
      viewUrl: null,
      dryRun: false,
    });
    await batch.api.importBatch(body, 'chave-lote');
    const sent = call(batch.fetcher);
    expect(sent.url).toBe('https://api.test/api/v1/imports');
    expect(sent.init.method).toBe('POST');
    expect(JSON.parse(String(sent.init.body))).toEqual(body);
    expect(sent.headers.get('Content-Type')).toBe('application/json');
    expect(sent.headers.get('Idempotency-Key')).toBe(body.idempotencyKey);
  });
});

// Busca por significado (contrato 1.3.0): rotas, query e corpo exatos.
describe('adapter — busca por significado', () => {
  const nodeJson = {
    id: 'n1',
    version: 1,
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
    status: 'active',
    kind: 'concept',
    label: 'Individuação',
    description: 'Texto.',
    conceptScope: 'broad',
    startYear: null,
    endYear: null,
    precision: 'unknown',
    periodLabel: null,
    aliases: [],
    identifiers: [],
    contexts: [],
    degreeTotal: 0,
    archivedAt: null,
  };
  const semantic = {
    model: 'Xenova/multilingual-e5-small',
    items: [{ node: nodeJson, score: 0.87 }],
  };

  it('semanticSearch: q, kind, includePending e limit, nessa ordem, vazio omitido', async () => {
    const { api, send } = setup(semantic);
    await api.semanticSearch('união de opostos', {}, signal);
    expect(path(send)).toBe('/search/semantic?q=uni%C3%A3o+de+opostos');
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
    await api.semanticSearch(
      'união de opostos',
      { kind: 'concept', includePending: true, limit: 20 },
      signal,
    );
    expect(path(send, 1)).toBe(
      '/search/semantic?q=uni%C3%A3o+de+opostos&kind=concept&includePending=true&limit=20',
    );
    await api.semanticSearch(
      'a&b',
      { includePending: false, limit: 50 },
      signal,
    );
    expect(path(send, 2)).toBe(
      '/search/semantic?q=a%26b&includePending=false&limit=50',
    );
    // `mode` só vai quando pedido, depois do limite.
    await api.semanticSearch(
      'União · conceito · texto',
      { mode: 'duplicates', includePending: true, limit: 3 },
      signal,
    );
    expect(path(send, 3)).toBe(
      '/search/semantic?q=Uni%C3%A3o+%C2%B7+conceito+%C2%B7+texto&includePending=true&limit=3&mode=duplicates',
    );
    await api.semanticSearch('a', { mode: 'meaning' }, signal);
    expect(path(send, 4)).toBe('/search/semantic?q=a&mode=meaning');
    await api.semanticSearch('a', { mode: undefined }, signal);
    expect(path(send, 5)).toBe('/search/semantic?q=a');
  });

  it('similarNodes: ID codificado e limite', async () => {
    const { api, send } = setup(semantic);
    await api.similarNodes('a b/c', 5, signal);
    expect(path(send)).toBe('/nodes/a%20b%2Fc/similar?limit=5');
    expect(send.mock.calls[0]?.[1]).toEqual({ signal });
  });

  it('parallels: limit e minScore só quando dados (0 vale)', async () => {
    const { api, send } = setup({
      model: 'm',
      items: [{ a: nodeJson, b: { ...nodeJson, id: 'n2' }, score: 0.93 }],
    });
    await api.parallels({}, signal);
    expect(path(send)).toBe('/suggestions/parallels');
    await api.parallels({ limit: 20 }, signal);
    expect(path(send, 1)).toBe('/suggestions/parallels?limit=20');
    await api.parallels({ limit: 50, minScore: 0.95 }, signal);
    expect(path(send, 2)).toBe('/suggestions/parallels?limit=50&minScore=0.95');
    await api.parallels({ minScore: 0 }, signal);
    expect(path(send, 3)).toBe('/suggestions/parallels?minScore=0');
    expect(send.mock.calls[2]?.[1]).toEqual({ signal });
  });

  it('dismissParallel: POST com {a, b, reason} e sem Idempotency-Key', async () => {
    const dismissal = {
      id: 'd1',
      a: 'n1',
      b: 'n2',
      kind: 'parallel',
      reason: 'Não é paralelo.',
      createdAt: '2026-11-01T12:00:00.000Z',
    };
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(dismissal));
    const api = createApi(
      createTransport('https://api.test/api/v1', null, fetcher),
    );
    await expect(
      api.dismissParallel('n1', 'n2', 'Não é paralelo.'),
    ).resolves.toEqual(dismissal);
    const [url, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(String(url)).toBe(
      'https://api.test/api/v1/suggestions/parallels/dismiss',
    );
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":"n1","b":"n2","reason":"Não é paralelo."}');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.has('Idempotency-Key')).toBe(false);
    expect(headers.has('If-Match')).toBe(false);
  });

  it('valida as respostas contra os schemas do contrato', async () => {
    await expect(
      setup({ items: [] }).api.semanticSearch('a', {}, signal),
    ).rejects.toThrow('fora do contrato');
    await expect(
      setup({ model: 'm', items: [{ node: nodeJson }] }).api.similarNodes(
        'n1',
        5,
        signal,
      ),
    ).rejects.toThrow('fora do contrato');
    await expect(
      setup({ model: 'm', items: [{ a: nodeJson, score: 1 }] }).api.parallels(
        {},
        signal,
      ),
    ).rejects.toThrow('fora do contrato');
    await expect(
      setup({ id: 'd' }).api.dismissParallel('a', 'b', 'r'),
    ).rejects.toThrow('fora do contrato');
    await expect(
      setup(semantic).api.semanticSearch('a', {}, signal),
    ).resolves.toEqual(semantic);
  });
});
