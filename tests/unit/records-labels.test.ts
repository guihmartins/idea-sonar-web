import { describe, expect, it } from 'vitest';

describe('rótulos estáticos dos registros', () => {
  it('associa todos os tipos de entidade aos nomes em português', async () => {
    const { typeLabels } = await import('../../src/pages/RecordsPage');
    expect(typeLabels).toEqual({
      nodes: 'Pontos',
      relations: 'Relações',
      sources: 'Fontes',
      contexts: 'Contextos',
      views: 'Views salvas',
    });
  });
});
