import { describe, expect, it } from 'vitest';
import {
  importItemSchema,
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
});
