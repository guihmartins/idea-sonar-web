import { describe, expect, it } from 'vitest';

describe('valores estáticos do payload do editor', () => {
  it('define todos os campos seguros de uma evidência vazia', async () => {
    const { emptyEvidence } = await import('../../src/pages/editor/payload');
    expect(emptyEvidence).toEqual({
      sourceId: '',
      sourceKind: 'secondary',
      stance: 'supports',
      locator: '',
      excerpt: '',
      explanation: '',
      conversationReference: '',
    });
  });

  it('reconhece sufixos de idioma válidos e deixa idiomas inválidos literais', async () => {
    const { parseAliases } = await import('../../src/pages/editor/payload');
    expect(
      parseAliases('Nome (pt), Pessoa (en-US), Abc (toolongtag), Outro (1)'),
    ).toEqual([
      { alias: 'Nome', language: 'pt' },
      { alias: 'Pessoa', language: 'en-US' },
      { alias: 'Abc (toolongtag)', language: 'und' },
      { alias: 'Outro (1)', language: 'und' },
    ]);
  });
});
