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
      aliases: [],
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
