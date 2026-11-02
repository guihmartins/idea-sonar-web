import { describe, expect, it } from 'vitest';
import {
  importItemSchema,
  importResultSchema,
  parallelDismissalSchema,
  similarPointSchema,
  storedFiltersSchema,
  undoResultSchema,
} from '../../src/api/domain';

describe('schemas da API', () => {
  it('filtros salvos mantêm todos os campos preenchidos e recusam tipo inválido', () => {
    const filters = {
      kind: 'figure',
      contextId: 'ctx-1',
      includePending: true,
      startYear: -300,
      endYear: 1900,
      includeUnknownPeriod: false,
    };
    expect(storedFiltersSchema.parse(filters)).toEqual(filters);
    expect(storedFiltersSchema.parse({})).toEqual({});
    expect(storedFiltersSchema.safeParse({ kind: 'planeta' }).success).toBe(
      false,
    );
    expect(storedFiltersSchema.safeParse({ startYear: 1.5 }).success).toBe(
      false,
    );
  });

  it('item de importação sem candidatos recebe lista vazia; com candidatos, os mantém', () => {
    const item = {
      clientRef: 'ref',
      entityType: 'nodes',
      entityId: null,
      outcome: 'pending',
      reason: 'Nome repetido',
    };
    expect(importItemSchema.parse(item).candidates).toEqual([]);
    expect(
      importItemSchema.parse({ ...item, candidates: ['a', 'b'] }).candidates,
    ).toEqual(['a', 'b']);
    expect(
      importItemSchema.safeParse({ ...item, candidates: [1] }).success,
    ).toBe(false);
  });

  it('resultado do desfazer exige lote, status "undone" e motivo', () => {
    const result = { batchId: 'b1', status: 'undone', reason: 'engano' };
    expect(undoResultSchema.parse(result)).toEqual(result);
    expect(
      undoResultSchema.safeParse({ ...result, status: 'committed' }).success,
    ).toBe(false);
    expect(
      undoResultSchema.safeParse({ batchId: 'b1', status: 'undone' }).success,
    ).toBe(false);
    expect(
      undoResultSchema.safeParse({ status: 'undone', reason: 'x' }).success,
    ).toBe(false);
  });

  it('`similar` do item do lote: ausente é diferente de lista vazia', () => {
    const item = {
      clientRef: 'ref',
      entityType: 'nodes',
      entityId: 'n1',
      outcome: 'created',
      reason: null,
    };
    expect(importItemSchema.parse(item)).not.toHaveProperty('similar');
    expect(importItemSchema.parse({ ...item, similar: [] }).similar).toEqual(
      [],
    );
    const similar = [{ id: 'n2', label: 'Coniunctio', score: 0.93 }];
    expect(importItemSchema.parse({ ...item, similar }).similar).toEqual(
      similar,
    );
    expect(
      importItemSchema.safeParse({ ...item, similar: [{ id: 'n2' }] }).success,
    ).toBe(false);
    expect(
      importItemSchema.safeParse({
        ...item,
        similar: [{ id: 'n2', label: 'x', score: '0.9' }],
      }).success,
    ).toBe(false);
    expect(
      similarPointSchema.safeParse({ id: 'n2', label: 'x', score: 0.5 })
        .success,
    ).toBe(true);
    const result = {
      batchId: 'b',
      status: 'committed',
      created: 1,
      updated: 0,
      reused: 0,
      pending: 0,
      discarded: 0,
      clientRefToId: {},
      items: [{ ...item, similar }],
      viewUrl: null,
      dryRun: false,
    };
    expect(importResultSchema.parse(result).items[0]?.similar).toEqual(similar);
  });

  it('dispensa de par exige todos os campos', () => {
    const dismissal = {
      id: 'd1',
      a: 'n1',
      b: 'n2',
      kind: 'parallel',
      reason: 'r',
      createdAt: '2026-11-01T12:00:00.000Z',
    };
    expect(parallelDismissalSchema.parse(dismissal)).toEqual(dismissal);
    for (const key of Object.keys(dismissal))
      expect(
        parallelDismissalSchema.safeParse({ ...dismissal, [key]: undefined })
          .success,
      ).toBe(false);
  });
});
