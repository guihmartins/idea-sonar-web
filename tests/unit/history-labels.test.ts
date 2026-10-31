import { describe, expect, it } from 'vitest';

describe('rótulos históricos', () => {
  it('preserva os nomes dos eventos da API em português', async () => {
    const { historyLabels } = await import('../../src/components/labels');
    expect(historyLabels).toEqual({
      create: 'Criação',
      update: 'Edição',
      undo: 'Reversão de importação',
      resolve: 'Resolução de pendência',
    });
    expect(historyLabels.delete).toBeUndefined();
  });
});
