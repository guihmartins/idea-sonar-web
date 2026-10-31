import { describe, expect, it } from 'vitest';

describe('rótulos editoriais', () => {
  it('preserva os três estados editoriais visíveis', async () => {
    const { editorialLabels } = await import('../../src/components/Feedback');
    expect(editorialLabels).toEqual({
      active: 'Ativo',
      pending: 'Pendente',
      archived: 'Arquivado',
    });
  });
});
