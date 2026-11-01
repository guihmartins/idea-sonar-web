import { describe, expect, it } from 'vitest';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import type { ImportBatch, Node } from '../../src/api/domain';

// A API fictícia segue as regras da real para conceitos contextuais: o REST
// recusa o que só o lote grava (idea-sonar-api, contrato 1.1.0).
const contextual = {
  kind: 'concept',
  label: 'Conceito contextual fictício',
  description: 'Rascunho.',
  conceptScope: 'contextual',
  aliases: [],
  contexts: [ids.context],
};
const batch = (key: string, dryRun = false): ImportBatch => ({
  contractVersion: '1',
  policyVersion: '1',
  idempotencyKey: key,
  origin: 'manual',
  inputSummary: 'Teste do lote fictício',
  dryRun,
  nodes: [
    {
      op: 'create',
      clientRef: 'n',
      kind: 'concept',
      label: 'Conceito do lote',
      description: 'Criado pelo lote.',
      conceptScope: 'contextual',
      precision: 'unknown',
      aliases: [],
      identifiers: [],
      contexts: [{ id: ids.context }],
      status: 'active',
    },
  ],
  relations: [
    {
      op: 'create',
      clientRef: 'r',
      type: 'contextualizes',
      source: { clientRef: 'n' },
      target: { id: ids.concept },
      claim: 'Contextualiza.',
      justification: 'Justifica.',
      evidenceStatus: 'inference',
      inferenceAuthor: 'Teste',
      intensity: null,
      contested: false,
      status: 'active',
      evidence: [],
    },
  ],
});

async function setup() {
  const services = createFixtureServices();
  await services.session.login();
  return services.api;
}

describe('API fictícia — conceito contextual', () => {
  it('o REST recusa conceito contextual ativo, ativado depois ou relação ativa com ponto pendente', async () => {
    const api = await setup();
    await expect(
      api.save('nodes', { ...contextual, status: 'active' }, 'k1'),
    ).rejects.toMatchObject({ status: 422, code: 'CONTEXT_REQUIRED' });
    const draft = (await api.save(
      'nodes',
      { ...contextual, status: 'pending' },
      'k2',
    )) as Node;
    await expect(
      api.save('nodes', { status: 'active' }, 'k3', draft),
    ).rejects.toMatchObject({ code: 'CONTEXT_REQUIRED' });
    await expect(
      api.save(
        'relations',
        {
          sourceId: draft.id,
          targetId: ids.concept,
          type: 'contextualizes',
          status: 'active',
        },
        'k4',
      ),
    ).rejects.toMatchObject({ status: 422, code: 'INACTIVE_ENDPOINT' });
  });

  it('o lote grava os dois na mesma transação', async () => {
    const api = await setup();
    const result = await api.importBatch(batch('lote-1'), 'lote-1');
    expect(result).toMatchObject({
      status: 'committed',
      created: 2,
      pending: 0,
      dryRun: false,
    });
    expect(result.viewUrl).toContain(`/imports/${result.batchId}`);
    const node = await api.detail('nodes', result.clientRefToId.n!);
    expect(node).toMatchObject({ status: 'active' });
    const detail = await api.import(
      result.batchId,
      new AbortController().signal,
    );
    expect(detail).toMatchObject({
      status: 'committed',
      origin: 'manual',
      inputSummary: 'Teste do lote fictício',
    });
  });

  it('dryRun não grava nada e a chave repetida devolve o mesmo resultado', async () => {
    const api = await setup();
    const preview = await api.importBatch(batch('lote-2', true), 'lote-2');
    expect(preview.dryRun).toBe(true);
    const found = await api.search(
      'Conceito do lote',
      {
        kind: '',
        contextId: '',
        includePending: true,
        startYear: null,
        endYear: null,
        includeUnknownPeriod: true,
      },
      null,
      new AbortController().signal,
    );
    expect(found.items).toHaveLength(0);
    const first = await api.importBatch(batch('lote-3'), 'lote-3');
    const again = await api.importBatch(batch('lote-3'), 'lote-3');
    expect(again.batchId).toBe(first.batchId);
  });

  it('recusa chave de cabeçalho diferente da chave do corpo', async () => {
    const api = await setup();
    await expect(
      api.importBatch(batch('corpo'), 'cabecalho'),
    ).rejects.toMatchObject({ status: 400, code: 'IDEMPOTENCY_MISMATCH' });
  });

  it('versão desatualizada no update do lote é 409 e referência inexistente é 400', async () => {
    const api = await setup();
    const base = batch('lote-4');
    await expect(
      api.importBatch(
        {
          ...base,
          nodes: [
            {
              op: 'update',
              clientRef: 'n',
              id: ids.jung,
              expectedVersion: 99,
              status: 'pending',
            },
          ],
          relations: [],
        },
        'lote-4',
      ),
    ).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
    await expect(
      api.importBatch(
        {
          ...base,
          idempotencyKey: 'lote-5',
          nodes: [
            {
              op: 'update',
              clientRef: 'n',
              id: '00000000-0000-4000-8000-0000000000ff',
              expectedVersion: 1,
              status: 'pending',
            },
          ],
          relations: [],
        },
        'lote-5',
      ),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REFERENCE' });
  });

  it('lista relações do ponto por predicado, pendentes só com includePending', async () => {
    const api = await setup();
    const draft = (await api.save(
      'nodes',
      { ...contextual, status: 'pending' },
      'k5',
    )) as Node;
    await api.save(
      'relations',
      {
        sourceId: draft.id,
        targetId: ids.concept,
        type: 'contextualizes',
        contextId: null,
        claim: 'Pendente.',
        justification: 'Justifica.',
        evidenceStatus: 'inference',
        intensity: null,
        contested: false,
        status: 'pending',
        evidence: [],
      },
      'k6',
    );
    const links = await api.nodeRelations(draft.id, 'contextualizes');
    expect(links.items).toHaveLength(1);
    expect(links.items[0]).toMatchObject({ status: 'pending' });
    expect((await api.nodeRelations(draft.id, 'influenced')).items).toEqual([]);
    expect((await api.nodeRelations(ids.jung, 'contextualizes')).items).toEqual(
      [],
    );
    const withoutPending = await api.list('relations', null);
    expect(withoutPending.items.every((r) => r.status === 'active')).toBe(true);
  });
});

// Modelo de dados v2 (contrato 1.2.0): identificadores únicos, candidatos de
// duplicidade, descarte e payload enxuto das pendências.
describe('API fictícia — modelo de dados v2', () => {
  const person = (label: string, extra: Record<string, unknown> = {}) => ({
    kind: 'person',
    label,
    description: 'Pessoa fictícia.',
    conceptScope: null,
    aliases: [],
    contexts: [],
    status: 'active',
    ...extra,
  });
  const op = (clientRef: string, label: string, extra = {}) => ({
    op: 'create' as const,
    clientRef,
    kind: 'person' as const,
    label,
    description: 'Pessoa fictícia.',
    precision: 'unknown' as const,
    aliases: [],
    identifiers: [],
    contexts: [],
    status: 'active' as const,
    ...extra,
  });
  const lote = (
    key: string,
    nodes: NonNullable<ImportBatch['nodes']>,
  ): ImportBatch => ({
    contractVersion: '1',
    policyVersion: '1',
    idempotencyKey: key,
    origin: 'chat',
    inputSummary: 'Lote do modelo v2',
    dryRun: false,
    nodes,
  });

  it('REST guarda o identificador normalizado e recusa o de outro ponto com 409 DUPLICATE', async () => {
    const api = await setup();
    const owner = (await api.save(
      'nodes',
      person('Dona', {
        identifiers: [
          {
            scheme: 'wikidata',
            value: 'https://www.wikidata.org/wiki/q1000009',
          },
        ],
      }),
      'k1',
    )) as Node;
    expect(owner.identifiers).toEqual([
      { scheme: 'wikidata', value: 'Q1000009' },
    ]);
    await expect(
      api.save(
        'nodes',
        person('Outra', {
          identifiers: [{ scheme: 'wikidata', value: 'Q1000009' }],
        }),
        'k2',
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE',
      message: 'Registro duplicado',
      details: {
        details: [
          {
            path: 'identifiers',
            message: 'Identificador já cadastrado em outro ponto',
          },
        ],
      },
    });
    // Arquivado continua dono do identificador.
    await api.save('nodes', { status: 'archived' }, 'k3', owner);
    await expect(
      api.save(
        'nodes',
        person('Outra', {
          identifiers: [{ scheme: 'wikidata', value: 'q1000009' }],
        }),
        'k4',
      ),
    ).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  it('REST valida identificador e período com o caminho do campo', async () => {
    const api = await setup();
    await expect(
      api.save(
        'nodes',
        person('Ruim', {
          startYear: 10,
          endYear: 5,
          identifiers: [
            { scheme: 'wikidata', value: 'Q1' },
            { scheme: 'viaf', value: 'não é número' },
          ],
        }),
        'k5',
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: {
        details: [
          { path: 'startYear', message: 'startYear deve ser <= endYear' },
          {
            path: 'identifiers.1.value',
            message: 'Identificador inválido para viaf',
          },
        ],
      },
    });
  });

  it('create com identificador já cadastrado fica pendente com os candidatos', async () => {
    const api = await setup();
    const owner = (await api.save(
      'nodes',
      person('Dona do VIAF', {
        identifiers: [{ scheme: 'viaf', value: '777' }],
      }),
      'k6',
    )) as Node;
    const result = await api.importBatch(
      lote('lote-v2-1', [
        op('nova', 'Nome diferente', {
          identifiers: [
            { scheme: 'viaf', value: 'https://viaf.org/viaf/777/' },
          ],
        }),
      ]),
      'lote-v2-1',
    );
    expect(result).toMatchObject({
      status: 'committed_with_pending',
      pending: 1,
    });
    expect(result.items[0]).toMatchObject({
      outcome: 'pending',
      candidates: [owner.id],
    });
    expect(result.items[0]?.reason).toContain(`viaf:777 → ponto ${owner.id}`);
    expect(result.items[0]?.reason).toContain('{op:"reference", id}');
  });

  it('create com nome ou alias repetido lista os candidatos; o identificador vale antes', async () => {
    const api = await setup();
    const result = await api.importBatch(
      lote('lote-v2-2', [
        op('igual', 'Jung (exemplo fictício)', {}),
        op('alias', 'Jung', {}),
        op('livre', 'Ninguém repetido', {}),
        op('mesmo-lote-a', 'Gêmea', {}),
        op('mesmo-lote-b', 'gemea', {}),
      ]),
      'lote-v2-2',
    );
    const by = Object.fromEntries(result.items.map((i) => [i.clientRef, i]));
    expect(by.igual?.candidates).toHaveLength(1);
    expect(by.igual?.reason).toContain('Nome já existente (candidatos: ');
    expect(by.alias?.candidates).toEqual(by.igual?.candidates);
    expect(by.livre?.outcome).toBe('created');
    expect(by['mesmo-lote-a']?.outcome).toBe('created');
    expect(by['mesmo-lote-b']).toMatchObject({
      outcome: 'pending',
      candidates: [result.clientRefToId['mesmo-lote-a']],
    });
  });

  it('erros do lote levam a posição do item: nodes.N.identifiers.M.value', async () => {
    const api = await setup();
    await expect(
      api.importBatch(
        lote('lote-v2-3', [
          op('a', 'Primeiro'),
          op('b', 'Segundo', {
            identifiers: [{ scheme: 'isbn', value: '123' }],
          }),
        ]),
        'lote-v2-3',
      ),
    ).rejects.toMatchObject({
      status: 400,
      details: {
        details: [
          {
            path: 'nodes.1.identifiers.0.value',
            message: 'Identificador inválido para isbn',
          },
        ],
      },
    });
  });

  it('descartar tira a pendência da fila sem criar registro e o resultado mostra Descartados', async () => {
    const api = await setup();
    const signal = new AbortController().signal;
    const result = await api.importBatch(
      lote('lote-v2-4', [op('dup', 'Jung (exemplo fictício)')]),
      'lote-v2-4',
    );
    const first = await api.pending(null, signal);
    const second = first.nextCursor
      ? await api.pending(first.nextCursor, signal)
      : null;
    const item = [...first.items, ...(second?.items ?? [])].find(
      (p) => p.batchId === result.batchId,
    )!;
    // Só a operação proposta, no formato {tipo: [op]}.
    expect(Object.keys(item.payload)).toEqual(['nodes']);
    expect(item.payload.nodes).toEqual([
      expect.objectContaining({
        clientRef: 'dup',
        label: 'Jung (exemplo fictício)',
      }),
    ]);
    const done = await api.discard(item, 'Duplicata do que já existe.', 'k-d');
    expect(done).toMatchObject({
      entityId: null,
      reason: 'Duplicata do que já existe.',
    });
    const detail = await api.import(result.batchId, signal);
    expect(detail.result).toMatchObject({ pending: 0, discarded: 1 });
    expect(detail.result.items[0]).toMatchObject({
      outcome: 'discarded',
      entityId: null,
      reason: 'Duplicata do que já existe.',
    });
    expect(detail.status).toBe('committed');
  });

  it('desfazer o lote descarta o que ainda estava pendente e tira da fila', async () => {
    const api = await setup();
    const signal = new AbortController().signal;
    const result = await api.importBatch(
      lote('lote-v2-5', [
        op('dup', 'Jung (exemplo fictício)'),
        op('ok', 'Pessoa nova'),
      ]),
      'lote-v2-5',
    );
    const before = await api.import(result.batchId, signal);
    await api.undo(result.batchId, before.version, 'Desfazendo o lote.', 'k-u');
    const after = await api.import(result.batchId, signal);
    expect(after.status).toBe('undone');
    expect(after.result).toMatchObject({ pending: 0, discarded: 1 });
    expect(after.result.items.find((i) => i.clientRef === 'dup')).toMatchObject(
      {
        outcome: 'discarded',
        reason: 'Lote desfeito',
      },
    );
    const queue = await api.pending(null, signal);
    expect(queue.items.every((p) => p.batchId !== result.batchId)).toBe(true);
  });

  it('depois de desfeito o lote, a pendência dele já não existe na fila', async () => {
    const api = await setup();
    const signal = new AbortController().signal;
    const [item] = (await api.pending(null, signal)).items;
    const batch = await api.import(item!.batchId, signal);
    await api.undo(batch.id, batch.version, 'Desfeito.', 'k-u2');
    // A pendência saiu da fila: agir sobre ela agora não a encontra.
    await expect(
      api.discard(item!, 'Tarde demais.', 'k-d2'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('busca por identificador e match=exact', async () => {
    const api = await setup();
    const signal = new AbortController().signal;
    await api.save(
      'nodes',
      person('Pessoa do Wikidata', {
        identifiers: [{ scheme: 'wikidata', value: 'Q1000011' }],
      }),
      'k7',
    );
    const filters = {
      kind: '' as const,
      contextId: '',
      includePending: false,
      startYear: null,
      endYear: null,
      includeUnknownPeriod: true,
    };
    expect(
      (
        await api.search(
          'https://www.wikidata.org/wiki/Q1000011',
          filters,
          null,
          signal,
        )
      ).items.map((n) => n.label),
    ).toEqual(['Pessoa do Wikidata']);
    expect((await api.search('wikidata', filters, null, signal)).items).toEqual(
      [expect.objectContaining({ label: 'Pessoa do Wikidata' })],
    );
    expect(
      (await api.search('Pessoa do', filters, null, signal, 'exact')).items,
    ).toEqual([]);
    expect(
      (await api.search('pessoa do wikidata', filters, null, signal, 'exact'))
        .items,
    ).toHaveLength(1);
  });
});
