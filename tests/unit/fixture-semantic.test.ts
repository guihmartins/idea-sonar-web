import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/client';
import type { ImportBatch, Node } from '../../src/api/domain';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import {
  FIXTURE_MIN,
  FIXTURE_MODEL,
  dismissParallel,
  jaccard,
  orderedPair,
  parallelSuggestions,
  semanticSearch,
  similarNodes,
  withSimilar,
} from '../../src/dev/fixture-semantic';

// A API fictícia segue as regras da busca por significado (contrato 1.3.0), com
// o índice de Jaccard no lugar do modelo: ordem previsível, números próprios.
type Fixtures = ReturnType<typeof createFixtureServices>;
let services: Fixtures;
const signal = new AbortController().signal;
const labels = (items: { node: Node }[]) =>
  items.map((item) => item.node.label);
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';

beforeEach(async () => {
  services = createFixtureServices();
  await services.session.login();
});

describe('jaccard', () => {
  it('é a razão entre as palavras em comum e as palavras das duas, com três casas', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(
      0.5,
    );
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['x', 'y', 'z']))).toBe(0);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c']))).toBe(1);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'x', 'y']))).toBe(
      0.2,
    );
    expect(jaccard(new Set(), new Set())).toBe(0);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'x']))).toBe(
      0.5,
    );
    expect(
      jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'd', 'e'])),
    ).toBe(0.4);
    expect(
      jaccard(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c', 'd'])),
    ).toBe(0.75);
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['a']))).toBe(0.333);
  });

  it('o par de demonstração fica acima do limiar e o texto genérico dos outros, abaixo', async () => {
    const { items } = await services.api.parallels({ minScore: 0 }, signal);
    const pair = items.find(
      (item) => item.a.id === ids.individuation && item.b.id === ids.coniunctio,
    );
    expect(pair?.score).toBeGreaterThanOrEqual(FIXTURE_MIN);
    for (const item of items.filter((entry) => entry !== pair))
      expect(item.score).toBeLessThan(FIXTURE_MIN);
  });
});

describe('GET /search/semantic', () => {
  it('ordena pelo sentido do texto, melhor primeiro, com modelo e pontuação', async () => {
    const result = await services.api.semanticSearch(
      'união de opostos como caminho de autoconhecimento',
      {},
      signal,
    );
    expect(result.model).toBe(FIXTURE_MODEL);
    expect(labels(result.items).slice(0, 2)).toEqual([
      individuation,
      coniunctio,
    ]);
    const [first, second] = result.items;
    // "opostos" só está na descrição da Individuação; "contrários", na outra.
    expect(first!.score).toBeGreaterThan(second!.score);
    expect(first!.score).toBeLessThanOrEqual(1);
  });

  it('só devolve pontos que dividem alguma palavra com a busca', async () => {
    const none = await services.api.semanticSearch('zzz yyy', {}, signal);
    expect(none.items).toEqual([]);
    const one = await services.api.semanticSearch(
      'Obra demonstração',
      {},
      signal,
    );
    expect(labels(one.items)).toEqual(['Obra de demonstração']);
  });

  it('respeita tipo, limite e pendentes, só quando pedido', async () => {
    const kind = await services.api.semanticSearch(
      'texto sintético fictício',
      { kind: 'person' },
      signal,
    );
    expect(labels(kind.items)).toEqual(['Jung (exemplo fictício)']);
    const limited = await services.api.semanticSearch(
      'texto sintético fictício',
      { limit: 2 },
      signal,
    );
    expect(limited.items).toHaveLength(2);

    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Rascunho de união',
        description: 'Texto sintético sobre a união de opostos.',
        conceptScope: 'broad',
        status: 'pending',
      },
      'k-pend',
    );
    const hidden = await services.api.semanticSearch(
      'união opostos',
      {},
      signal,
    );
    expect(labels(hidden.items)).not.toContain('Rascunho de união');
    const shown = await services.api.semanticSearch(
      'união opostos',
      { includePending: true },
      signal,
    );
    expect(labels(shown.items)).toContain('Rascunho de união');
    const explicit = await services.api.semanticSearch(
      'união opostos',
      { includePending: false },
      signal,
    );
    expect(labels(explicit.items)).not.toContain('Rascunho de união');
  });

  it('recusa busca vazia, longa demais, tipo e limite inválidos com 400', async () => {
    const bad = (q: string, filters = {}) =>
      services.api.semanticSearch(q, filters, signal);
    await expect(bad('')).rejects.toMatchObject({ status: 400 });
    await expect(bad('x'.repeat(501))).rejects.toMatchObject({ status: 400 });
    await expect(bad('x'.repeat(500))).resolves.toBeDefined();
    await expect(bad('a', { limit: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(bad('a', { limit: 51 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(bad('a', { limit: 50 })).resolves.toBeDefined();
    await expect(bad('a', { limit: 1 })).resolves.toBeDefined();
    expect(() =>
      semanticSearch([], new URLSearchParams('q=a&kind=planeta')),
    ).toThrowError(
      expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      semanticSearch([], new URLSearchParams('q=a&limit=2.5')),
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

// `mode=duplicates`: `q` é o texto de um ponto prestes a ser escrito, no formato
// da API, e só voltam os pontos acima do limiar do aviso do lote.
describe('GET /search/semantic?mode=duplicates', () => {
  // Resolvido na hora do teste: a descrição é declarada mais abaixo no arquivo.
  const individuationText = () =>
    `Individuação (exemplo fictício) · conceito · ${unionDescription}`;
  const search = (q: string, filters = {}) =>
    services.api.semanticSearch(q, { mode: 'duplicates', ...filters }, signal);

  it('devolve só o que passa do limiar, melhor primeiro, e o resto fica de fora', async () => {
    const { items } = await search(individuationText());
    expect(labels(items)).toEqual([individuation, coniunctio]);
    expect(items[0]!.score).toBe(1);
    for (const item of items)
      expect(item.score).toBeGreaterThanOrEqual(FIXTURE_MIN);
    // No modo de sempre, o mesmo texto traz também o que está abaixo do limiar.
    const meaning = await services.api.semanticSearch(
      individuationText(),
      {},
      signal,
    );
    expect(meaning.items.length).toBeGreaterThan(items.length);
    expect(meaning.items.some((item) => item.score < FIXTURE_MIN)).toBe(true);
    expect(
      (
        await services.api.semanticSearch(
          individuationText(),
          { mode: 'meaning' },
          signal,
        )
      ).items,
    ).toEqual(meaning.items);
  });

  it('texto sem parecido nenhum volta vazio, mesmo com palavras em comum', async () => {
    expect((await search('União · pessoa · Texto sintético.')).items).toEqual(
      [],
    );
    expect((await search('zzz yyy')).items).toEqual([]);
  });

  it('compara como o aviso do lote: o mesmo texto dá os mesmos parecidos', async () => {
    const result = await services.api.importBatch(
      batch('k-dup', false),
      'k-dup',
    );
    const nova = result.items.find((item) => item.clientRef === 'nova')!;
    const created = (
      await services.api.list('nodes', null, signal, {
        q: 'Terceira união',
      })
    ).items[0] as Node;
    const text = `${created.label} · conceito · ${created.description}`;
    const found = (await search(text, { limit: 10 })).items.filter(
      (item) => item.node.id !== created.id,
    );
    expect(found.map((item) => item.node.id)).toEqual(
      nova.similar!.map((point) => point.id),
    );
    expect(found.map((item) => item.score)).toEqual(
      nova.similar!.map((point) => point.score),
    );
  });

  it('respeita tipo, pendentes e limite como no modo de sempre', async () => {
    expect(
      labels((await search(individuationText(), { kind: 'work' })).items),
    ).toEqual([]);
    expect(
      labels((await search(individuationText(), { kind: 'concept' })).items),
    ).toEqual([individuation, coniunctio]);
    expect(
      (await search(individuationText(), { limit: 1 })).items,
    ).toHaveLength(1);
    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Individuação (exemplo fictício)',
        description: unionDescription,
        conceptScope: 'broad',
        status: 'pending',
      },
      'k-pend',
    );
    expect(
      (await search(individuationText())).items.filter(
        (item) => item.node.status === 'pending',
      ),
    ).toEqual([]);
    expect(
      (await search(individuationText(), { includePending: true })).items.some(
        (item) => item.node.status === 'pending',
      ),
    ).toBe(true);
  });

  it('modo desconhecido é 400', async () => {
    expect(() =>
      semanticSearch([], new URLSearchParams('q=a&mode=exato')),
    ).toThrowError(
      expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      semanticSearch([], new URLSearchParams('q=a&mode=')),
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });
});

describe('GET /nodes/{id}/similar', () => {
  it('lista os outros pontos ativos, sem o próprio, melhor primeiro', async () => {
    const { items } = await services.api.similarNodes(
      ids.individuation,
      5,
      signal,
    );
    expect(items[0]?.node.label).toBe(coniunctio);
    expect(items[0]?.score).toBeGreaterThanOrEqual(FIXTURE_MIN);
    expect(items.map((item) => item.node.id)).not.toContain(ids.individuation);
    expect(items.length).toBeLessThanOrEqual(5);
    const sorted = [...items].sort((a, b) => b.score - a.score);
    expect(items).toEqual(sorted);
  });

  it('respeita o limite e ignora pendentes e arquivados', async () => {
    const one = await services.api.similarNodes(ids.individuation, 1, signal);
    expect(one.items).toHaveLength(1);
    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Rascunho de união',
        description: unionDescription,
        conceptScope: 'broad',
        status: 'pending',
      },
      'k-pend',
    );
    const all = await services.api.similarNodes(ids.individuation, 50, signal);
    expect(labels(all.items)).not.toContain('Rascunho de união');
  });

  it('ponto desconhecido é 404 e limite fora de 1 a 50 é 400', async () => {
    await expect(
      services.api.similarNodes(
        '00000000-0000-4000-8000-0000000000ff',
        5,
        signal,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      services.api.similarNodes(ids.jung, 0, signal),
    ).rejects.toMatchObject({ status: 400 });
    expect(() => similarNodes([], 'x', new URLSearchParams())).toThrow(
      ApiError,
    );
  });
});

const unionDescription =
  'Texto sintético sobre a união de opostos como caminho de autoconhecimento e de integração das partes da psique; não é uma afirmação histórica.';

describe('GET /suggestions/parallels', () => {
  it('sugere o par ativo sem relação, com a e b na ordem dos ids', async () => {
    const result = await services.api.parallels({}, signal);
    expect(result.model).toBe(FIXTURE_MODEL);
    expect(result.items).toHaveLength(1);
    const [pair] = result.items;
    expect(pair?.a.id).toBe(ids.individuation);
    expect(pair?.b.id).toBe(ids.coniunctio);
    expect(pair?.score).toBeGreaterThanOrEqual(FIXTURE_MIN);
  });

  it('nunca sugere pares que já têm relação, em qualquer sentido, mesmo com minScore 0', async () => {
    const { items } = await services.api.parallels({ minScore: 0 }, signal);
    const keys = items.map((item) => [item.a.id, item.b.id].sort().join('|'));
    for (const [x, y] of [
      [ids.jung, ids.gnosis],
      [ids.jung, ids.concept],
      [ids.gnosis, ids.concept],
    ])
      expect(keys).not.toContain([x, y].sort().join('|'));
    // Pares sem relação entram, com pontuação baixa.
    expect(keys).toContain([ids.jung, ids.work].sort().join('|'));
    expect(items.map((item) => item.score)).toEqual(
      [...items.map((item) => item.score)].sort((a, b) => b - a),
    );
  });

  it('relação pendente tira o par; relação arquivada o devolve', async () => {
    const relation = (state: 'pending' | 'archived') =>
      services.api.save(
        'relations',
        {
          sourceId: ids.coniunctio,
          targetId: ids.individuation,
          type: 'parallel_to',
          contextId: null,
          claim: 'Paralelo.',
          justification: 'Justifica.',
          evidenceStatus: 'inference',
          inferenceAuthor: 'Teste',
          intensity: null,
          contested: false,
          status: state,
          evidence: [],
        },
        `k-${state}`,
      );
    const created = await relation('pending');
    expect((await services.api.parallels({}, signal)).items).toEqual([]);
    await services.api.save('relations', { status: 'archived' }, 'k', created);
    expect((await services.api.parallels({}, signal)).items).toHaveLength(1);
  });

  it('minScore sobe e desce o limiar; limit corta a lista', async () => {
    expect(
      (await services.api.parallels({ minScore: 0.99 }, signal)).items,
    ).toEqual([]);
    const low = await services.api.parallels({ minScore: 0, limit: 2 }, signal);
    expect(low.items).toHaveLength(2);
    await expect(
      services.api.parallels({ minScore: 1.5 }, signal),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.parallels({ minScore: -0.1 }, signal),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.parallels({ limit: 51 }, signal),
    ).rejects.toMatchObject({ status: 400 });
    expect(() =>
      parallelSuggestions([], [], new Map(), new URLSearchParams('minScore=x')),
    ).toThrowError(expect.objectContaining({ status: 400 }));
    expect(
      (await services.api.parallels({ minScore: 1 }, signal)).items,
    ).toEqual([]);
  });
});

describe('POST /suggestions/parallels/dismiss', () => {
  it('registra o motivo, tira o par da lista e devolve o registro com a e b ordenados', async () => {
    const record = await services.api.dismissParallel(
      ids.coniunctio,
      ids.individuation,
      'Não é paralelo.',
    );
    expect(record).toMatchObject({
      a: ids.individuation,
      b: ids.coniunctio,
      kind: 'parallel',
      reason: 'Não é paralelo.',
    });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(record.createdAt).getTime()).not.toBeNaN();
    expect((await services.api.parallels({}, signal)).items).toEqual([]);
  });

  it('é idempotente por par: repetir (em qualquer ordem) devolve o primeiro registro', async () => {
    const first = await services.api.dismissParallel(
      ids.individuation,
      ids.coniunctio,
      'Primeiro motivo.',
    );
    const again = await services.api.dismissParallel(
      ids.coniunctio,
      ids.individuation,
      'Outro motivo.',
    );
    expect(again).toEqual(first);
    expect(again.reason).toBe('Primeiro motivo.');
  });

  it('pares diferentes ganham registros diferentes, sem repetir a resposta do caminho', async () => {
    const one = await services.api.dismissParallel(ids.jung, ids.work, 'a');
    const two = await services.api.dismissParallel(ids.gnosis, ids.work, 'b');
    expect(two.id).not.toBe(one.id);
    expect(two.b).toBe(ids.work);
    expect(two.reason).toBe('b');
  });

  it('a igual a b, motivo vazio ou longo e ponto desconhecido são recusados', async () => {
    await expect(
      services.api.dismissParallel(ids.jung, ids.jung, 'x'),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: {
        details: [{ path: 'b', message: 'Os pontos devem ser diferentes' }],
      },
    });
    await expect(
      services.api.dismissParallel(ids.jung, ids.jung.toUpperCase(), 'x'),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.dismissParallel(ids.jung, ids.work, ''),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.dismissParallel(ids.jung, ids.work, '   '),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.dismissParallel(ids.jung, ids.work, 'x'.repeat(2001)),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.dismissParallel(ids.jung, ids.work, 'x'.repeat(2000)),
    ).resolves.toBeDefined();
    await expect(
      services.api.dismissParallel(
        ids.jung,
        '00000000-0000-4000-8000-0000000000ff',
        'x',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      services.api.dismissParallel(
        '00000000-0000-4000-8000-0000000000ff',
        ids.jung,
        'x',
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(() =>
      dismissParallel(
        [],
        new Map(),
        { a: 'a', b: 'b', reason: 1 as never },
        '',
      ),
    ).toThrowError(expect.objectContaining({ status: 400 }));
  });

  it('o par é guardado em minúsculas, o menor primeiro', () => {
    expect(orderedPair('B', 'a')).toEqual(['a', 'b']);
    expect(orderedPair('a', 'B')).toEqual(['a', 'b']);
  });
});

const batch = (key: string, dryRun: boolean): ImportBatch => ({
  contractVersion: '1',
  policyVersion: '1',
  idempotencyKey: key,
  origin: 'manual',
  inputSummary: 'Lote de teste',
  dryRun,
  nodes: [
    {
      op: 'create',
      clientRef: 'nova',
      kind: 'concept',
      label: 'Terceira união (exemplo fictício)',
      description: unionDescription.replace('opostos', 'polos'),
      conceptScope: 'broad',
      precision: 'unknown',
      aliases: [],
      identifiers: [],
      contexts: [],
      status: 'active',
    },
    {
      op: 'create',
      clientRef: 'isolada',
      kind: 'work',
      label: 'Obra isolada',
      description: 'Nada em comum.',
      conceptScope: null,
      precision: 'unknown',
      aliases: [],
      identifiers: [],
      contexts: [],
      status: 'active',
    },
  ],
});

describe('similar nos itens do lote', () => {
  it('POST /imports traz até 3 parecidos nos pontos criados, lista vazia quando não há nenhum', async () => {
    const result = await services.api.importBatch(batch('k1', false), 'k1');
    const nova = result.items.find((item) => item.clientRef === 'nova');
    const isolada = result.items.find((item) => item.clientRef === 'isolada');
    expect(nova?.similar?.map((point) => point.label)).toEqual([
      coniunctio,
      individuation,
    ]);
    expect(nova?.similar?.[0]).toEqual({
      id: ids.coniunctio,
      label: coniunctio,
      score: expect.any(Number),
    });
    expect(nova?.similar?.[0]?.score).toBeGreaterThanOrEqual(FIXTURE_MIN);
    expect(isolada?.similar).toEqual([]);
  });

  it('a simulação também traz o aviso, sem gravar o lote', async () => {
    const result = await services.api.importBatch(batch('k2', true), 'k2');
    expect(result.dryRun).toBe(true);
    expect(
      result.items.find((item) => item.clientRef === 'nova')?.similar,
    ).toHaveLength(2);
    expect((await services.api.imports(null, signal)).items).toHaveLength(1);
  });

  it('o detalhe do lote recalcula o aviso a cada leitura; itens que não criaram ponto ficam sem o campo', async () => {
    const detail = await services.api.import(ids.import, signal);
    const byRef = Object.fromEntries(
      detail.result.items.map((item) => [item.clientRef, item]),
    );
    // Individuação foi criada pelo lote e Coniunctio, não: é o aviso.
    expect(byRef['individuacao']?.similar?.map((point) => point.id)).toEqual([
      ids.coniunctio,
    ]);
    // Jung foi criado, mas nada fora do lote lê parecido.
    expect(byRef['jung']?.similar).toEqual([]);
    for (const ref of ['gnose', 'fonte', 'homonimo'])
      expect(byRef[ref]).not.toHaveProperty('similar');

    // Um ponto novo, parecido com a Individuação, entra no aviso na próxima leitura.
    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Terceiro (exemplo fictício)',
        description: unionDescription.replace('opostos', 'metades'),
        conceptScope: 'broad',
        status: 'active',
      },
      'k-novo',
    );
    const later = await services.api.import(ids.import, signal);
    expect(
      later.result.items
        .find((item) => item.clientRef === 'individuacao')
        ?.similar?.map((point) => point.label),
    ).toEqual([coniunctio, 'Terceiro (exemplo fictício)']);
  });

  it('lote desfeito não tem aviso', async () => {
    const detail = await services.api.import(ids.import, signal);
    await services.api.undo(ids.import, detail.version, 'Engano', 'k-undo');
    const undone = await services.api.import(ids.import, signal);
    expect(undone.status).toBe('undone');
    for (const item of undone.result.items)
      expect(item).not.toHaveProperty('similar');
  });

  it('withSimilar fica com 3 pontos no máximo, ordenados, sem os do lote e sem inativos', () => {
    const base = (id: string, label: string, status: Node['status']): Node => ({
      id,
      version: 1,
      createdAt: '',
      updatedAt: '',
      status,
      kind: 'concept',
      label,
      description: unionDescription,
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
    });
    const nodes = [
      base('n', 'N', 'active'),
      base('o', 'O', 'active'),
      base('a', 'A', 'active'),
      base('b', 'B', 'active'),
      base('c', 'C', 'active'),
      base('d', 'D', 'active'),
      base('p', 'Pendente', 'pending'),
      base('r', 'Arquivado', 'archived'),
    ];
    const created = (clientRef: string, entityId: string) => ({
      clientRef,
      entityType: 'nodes',
      entityId,
      outcome: 'created' as const,
      reason: null,
      candidates: [],
    });
    const [item] = withSimilar([created('n', 'n'), created('o', 'o')], nodes);
    expect(item?.similar?.map((point) => point.label)).toEqual(['A', 'B', 'C']);
    expect(item?.similar?.every((point) => point.score === 1)).toBe(true);
  });
});
