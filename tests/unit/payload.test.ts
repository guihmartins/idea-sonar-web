import { describe, expect, it, vi } from 'vitest';
import {
  buildEditorBody,
  emptyEvidence,
  evidenceDraft,
  formatAliases,
  identifierIssues,
  identifiersBody,
  parseAliases,
  type EditorDraft,
} from '../../src/pages/editor/payload';
import type { Api } from '../../src/api/adapter';
import { ApiError } from '../../src/api/client';
import type { Catalog, Evidence, Node } from '../../src/api/domain';

function draft(overrides: Partial<EditorDraft> = {}): EditorDraft {
  return {
    fields: {},
    contexts: [],
    evidence: [],
    contested: false,
    identifiers: [],
    ...overrides,
  };
}

const catalog: Catalog = {
  nodeKinds: ['person', 'tradition', 'concept', 'work', 'figure'],
  identifierSchemes: ['wikidata', 'viaf', 'isni', 'isbn', 'doi', 'openlibrary'],
  relationTypes: [
    {
      code: 'influenced',
      label: 'influenciou',
      inverseLabel: 'foi influenciado por',
      symmetric: false,
      allowedEndpoints: [{ source: 'person', target: 'person' }],
    },
    {
      code: 'parallel_to',
      label: 'paralelo a',
      inverseLabel: 'paralelo a',
      symmetric: true,
      allowedEndpoints: [{ source: 'person', target: 'concept' }],
    },
  ],
  evidenceStatuses: ['documented', 'attributed_interpretation', 'inference'],
  editorialStatuses: ['active', 'pending', 'archived'],
  intensities: [{ value: 1, label: 'pontual' }],
};

function fakeApi(kinds: Record<string, Node['kind']>): Api {
  return {
    node: (id: string) =>
      Promise.resolve({ kind: kinds[id] } as unknown as Node),
  } as unknown as Api;
}

describe('evidenceDraft', () => {
  it('normaliza campos nulos para string vazia', () => {
    const entry: Evidence = {
      sourceId: null,
      sourceKind: 'primary',
      stance: 'supports',
      locator: 'p.1',
      excerpt: null,
      explanation: 'explica',
      conversationReference: null,
    };
    expect(evidenceDraft(entry)).toEqual({
      ...entry,
      sourceId: '',
      excerpt: '',
      conversationReference: '',
    });
  });
});

describe('parseAliases / formatAliases', () => {
  it('extrai idioma entre parênteses e ignora entradas vazias', () => {
    expect(parseAliases('Jung (de), , C.G. Jung')).toEqual([
      { alias: 'Jung', language: 'de' },
      { alias: 'C.G. Jung', language: 'und' },
    ]);
  });

  it('aceita subtags BCP 47 compostas', () => {
    expect(parseAliases('Nome (en-US)')).toEqual([
      { alias: 'Nome', language: 'en-US' },
    ]);
  });

  it('formata sem idioma quando und, e com idioma quando informado', () => {
    expect(
      formatAliases([
        { alias: 'Jung', language: 'de' },
        { alias: 'C.G. Jung', language: 'und' },
      ]),
    ).toBe('Jung (de), C.G. Jung');
  });
});

describe('buildEditorBody — nodes', () => {
  it('exige escopo para conceitos', async () => {
    await expect(
      buildEditorBody(
        'nodes',
        draft({ fields: { status: 'active', kind: 'concept', label: 'X' } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('Conceitos exigem escopo');
  });

  it('monta o corpo com aliases e contexto para não-conceitos', async () => {
    const body = await buildEditorBody(
      'nodes',
      draft({
        fields: {
          status: 'active',
          kind: 'person',
          label: ' Jung ',
          description: 'desc',
          aliases: 'Jung (de)',
          precision: 'unknown',
        },
        contexts: ['ctx-1'],
      }),
      catalog,
      fakeApi({}),
    );
    expect(body).toEqual({
      status: 'active',
      kind: 'person',
      label: 'Jung',
      description: 'desc',
      conceptScope: null,
      startYear: null,
      endYear: null,
      precision: 'unknown',
      periodLabel: null,
      aliases: [{ alias: 'Jung', language: 'de' }],
      identifiers: [],
      contexts: ['ctx-1'],
    });
  });
});

describe('buildEditorBody — período e identificadores do ponto', () => {
  const fields = {
    status: 'active',
    kind: 'figure',
    label: 'Hermes',
    description: 'Figura mítica',
    aliases: '',
    precision: 'approximate',
    periodLabel: ' séc. V a.C. ',
    start: '500',
    startEra: 'bce',
    end: '400',
    endEra: 'bce',
  };
  it('converte a.C. em ano astronômico e leva rótulo, precisão e figura sem escopo', async () => {
    const body = await buildEditorBody(
      'nodes',
      draft({ fields, contexts: [] }),
      catalog,
      fakeApi({}),
    );
    expect(body).toMatchObject({
      kind: 'figure',
      conceptScope: null,
      startYear: -499,
      endYear: -399,
      precision: 'approximate',
      periodLabel: 'séc. V a.C.',
    });
  });
  it('período vazio vira nulo e a ordem do período é conferida', async () => {
    const empty = await buildEditorBody(
      'nodes',
      draft({ fields: { ...fields, start: '', end: '', periodLabel: '' } }),
      catalog,
      fakeApi({}),
    );
    expect(empty).toMatchObject({
      startYear: null,
      endYear: null,
      periodLabel: null,
    });
    await expect(
      buildEditorBody(
        'nodes',
        draft({ fields: { ...fields, start: '400', end: '500' } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('O fim do período deve ser posterior ao início.');
  });
  it.each([
    ['depois de 3000 d.C.', { start: '3001', startEra: 'ce' }],
    ['antes de 100001 a.C.', { end: '100002', endEra: 'bce', start: '' }],
  ])('recusa ano fora dos limites da API: %s', async (_name, change) => {
    await expect(
      buildEditorBody(
        'nodes',
        draft({ fields: { ...fields, ...change } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('Ano fora do intervalo aceito');
  });
  it('contextos também respeitam os limites de ano', async () => {
    await expect(
      buildEditorBody(
        'contexts',
        draft({
          fields: {
            label: 'Contexto',
            precision: 'unknown',
            start: '3001',
            startEra: 'ce',
          },
        }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('Ano fora do intervalo aceito');
  });
  it('identificadores: tira espaços e descarta linhas em branco', () => {
    expect(
      identifiersBody([
        { scheme: 'wikidata', value: ' Q1000001 ' },
        { scheme: 'viaf', value: '   ' },
        { scheme: 'doi', value: '10.1000/x' },
      ]),
    ).toEqual([
      { scheme: 'wikidata', value: 'Q1000001' },
      { scheme: 'doi', value: '10.1000/x' },
    ]);
  });
});

describe('identifierIssues', () => {
  const identifiers = [
    { scheme: 'wikidata', value: 'Q1' },
    { scheme: 'viaf', value: '' },
    { scheme: 'isbn', value: '123' },
  ] as const;
  const failure = (details: unknown, status = 400, code = 'VALIDATION_ERROR') =>
    new ApiError(status, 'x', { code, details });
  it('liga o erro à linha enviada, pulando linhas em branco, com ou sem prefixo de lote', () => {
    const issues = identifierIssues(
      failure([
        {
          path: 'identifiers.1.value',
          message: 'Identificador inválido para isbn',
        },
        {
          path: 'nodes.0.identifiers.0.value',
          message: 'Identificador inválido para wikidata',
        },
        { path: 'identifiers', message: 'Identificadores duplicados' },
        { path: 'label', message: 'outro campo' },
      ]),
      [...identifiers],
    );
    expect(issues.rows).toEqual({
      2: 'Identificador inválido para isbn',
      0: 'Identificador inválido para wikidata',
    });
    expect(issues.general).toEqual(['Identificadores duplicados']);
  });
  it('erro de linha inexistente ou que não é da API não aparece', () => {
    expect(
      identifierIssues(
        failure([{ path: 'identifiers.9.value', message: 'x' }]),
        [...identifiers],
      ),
    ).toEqual({ rows: {}, general: [] });
    expect(identifierIssues(new Error('x'), [...identifiers])).toEqual({
      rows: {},
      general: [],
    });
  });
  it('409 DUPLICATE vira mensagem geral', () => {
    const issues = identifierIssues(
      failure(
        [
          {
            path: 'identifiers',
            message: 'Identificador já cadastrado em outro ponto',
          },
        ],
        409,
        'DUPLICATE',
      ),
      [...identifiers],
    );
    expect(issues.general).toEqual([
      'Identificador já cadastrado em outro ponto',
    ]);
  });
});

describe('buildEditorBody — sources', () => {
  it('rejeita URL que não é http(s)', async () => {
    await expect(
      buildEditorBody(
        'sources',
        draft({
          fields: { status: 'active', canonicalUrl: 'ftp://example.com' },
        }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('URL HTTP(S)');
  });

  it('exige ao menos uma referência recuperável', async () => {
    await expect(
      buildEditorBody(
        'sources',
        draft({ fields: { status: 'active' } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('fonte seja recuperável');
  });

  it('monta corpo válido com DOI', async () => {
    const body = await buildEditorBody(
      'sources',
      draft({
        fields: {
          status: 'active',
          title: 'Título',
          authorText: 'Autor',
          doi: '10.1/x',
        },
      }),
      catalog,
      fakeApi({}),
    );
    expect(body).toEqual({
      status: 'active',
      title: 'Título',
      authorText: 'Autor',
      canonicalUrl: null,
      publicationLabel: null,
      doi: '10.1/x',
      notes: null,
    });
  });
});

describe('buildEditorBody — contexts', () => {
  it('rejeita fim anterior ao início', async () => {
    await expect(
      buildEditorBody(
        'contexts',
        draft({
          fields: {
            status: 'active',
            start: '100',
            startEra: 'ce',
            end: '50',
            endEra: 'ce',
          },
        }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('fim do período deve ser posterior');
  });

  it('monta corpo válido com período aberto', async () => {
    const body = await buildEditorBody(
      'contexts',
      draft({
        fields: {
          status: 'active',
          label: 'Contexto',
          precision: 'approximate',
        },
      }),
      catalog,
      fakeApi({}),
    );
    expect(body).toEqual({
      status: 'active',
      label: 'Contexto',
      startYear: null,
      endYear: null,
      precision: 'approximate',
      periodLabel: null,
      regionLabel: null,
      notes: null,
    });
  });
});

describe('buildEditorBody — relations', () => {
  const baseFields = {
    status: 'active',
    sourceId: 'a',
    targetId: 'b',
    type: 'influenced',
    claim: 'afirmação',
    justification: 'justificativa',
    evidenceStatus: 'documented',
  };

  it('exige origem, destino, predicado, afirmação e justificativa', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({ fields: { status: 'active' } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('Selecione origem, destino');
  });

  it('rejeita predicado fora do catálogo', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({ fields: { ...baseFields, type: 'inexistente' } }),
        catalog,
        fakeApi({}),
      ),
    ).rejects.toThrow('predicado do catálogo');
  });

  it('rejeita tipos de endpoint incompatíveis com o predicado', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({ fields: baseFields }),
        catalog,
        fakeApi({ a: 'work', b: 'work' }),
      ),
    ).rejects.toThrow('Tipos incompatíveis');
  });

  it('exige evidência de suporte fora de inferência', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({ fields: baseFields }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('fonte é obrigatória');
  });

  it('dispensa evidência de suporte para inferência', async () => {
    const body = await buildEditorBody(
      'relations',
      draft({
        fields: {
          ...baseFields,
          evidenceStatus: 'inference',
          inferenceAuthor: 'Alguém',
        },
      }),
      catalog,
      fakeApi({ a: 'person', b: 'person' }),
    );
    expect(body).toMatchObject({ evidenceStatus: 'inference' });
  });

  it('exige autoria para inferência', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({ fields: { ...baseFields, evidenceStatus: 'inference' } }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('Inferência exige autoria');
  });

  it('exige atribuição para interpretação atribuída', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({
          fields: {
            ...baseFields,
            evidenceStatus: 'attributed_interpretation',
          },
          evidence: [
            {
              ...emptyEvidence,
              sourceId: 's',
              stance: 'supports',
              sourceKind: 'secondary',
              locator: 'p.1',
              explanation: 'ok',
            },
          ],
        }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('Interpretação atribuída exige a atribuição');
  });

  it('exige justificativa da intensidade quando informada', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({
          fields: { ...baseFields, intensity: '2' },
          evidence: [
            {
              ...emptyEvidence,
              sourceId: 's',
              stance: 'supports',
              sourceKind: 'secondary',
              locator: 'p.1',
              explanation: 'ok',
            },
          ],
        }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('Justifique a intensidade');
  });

  it('cada evidência exige localizador e explicação', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({
          fields: baseFields,
          evidence: [{ ...emptyEvidence, locator: '' }],
        }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('localizador e explicação');
  });

  it('contestação exige evidência pró e contra, e nota', async () => {
    await expect(
      buildEditorBody(
        'relations',
        draft({
          fields: baseFields,
          contested: true,
          evidence: [
            {
              ...emptyEvidence,
              sourceId: 's',
              stance: 'supports',
              sourceKind: 'secondary',
              locator: 'p.1',
              explanation: 'ok',
            },
          ],
        }),
        catalog,
        fakeApi({ a: 'person', b: 'person' }),
      ),
    ).rejects.toThrow('sustentam e que contestam');
  });

  it('monta corpo completo válido com contestação', async () => {
    const api = fakeApi({ a: 'person', b: 'person' });
    const node = vi.spyOn(api, 'node');
    const body = await buildEditorBody(
      'relations',
      draft({
        fields: {
          ...baseFields,
          contextId: 'ctx',
          intensity: '2',
          intensityReason: 'motivo',
          contestationNote: 'nota',
        },
        contested: true,
        evidence: [
          {
            ...emptyEvidence,
            sourceId: 's1',
            stance: 'supports',
            sourceKind: 'secondary',
            locator: 'p.1',
            explanation: 'ok',
          },
          {
            ...emptyEvidence,
            sourceId: 's2',
            stance: 'challenges',
            sourceKind: 'primary',
            locator: 'p.2',
            explanation: 'ok também',
          },
        ],
      }),
      catalog,
      api,
    );
    expect(node).toHaveBeenCalledWith('a');
    expect(node).toHaveBeenCalledWith('b');
    expect(body).toMatchObject({
      sourceId: 'a',
      targetId: 'b',
      type: 'influenced',
      contextId: 'ctx',
      contested: true,
      contestationNote: 'nota',
      intensity: 2,
      intensityReason: 'motivo',
    });
    expect((body.evidence as unknown[]).length).toBe(2);
  });

  it('não exige suporte de evidência pró/contra quando não contestada', async () => {
    const body = await buildEditorBody(
      'relations',
      draft({
        fields: baseFields,
        evidence: [
          {
            ...emptyEvidence,
            sourceId: 's',
            stance: 'supports',
            sourceKind: 'secondary',
            locator: 'p.1',
            explanation: 'ok',
          },
        ],
      }),
      catalog,
      fakeApi({ a: 'person', b: 'person' }),
    );
    expect(body).toMatchObject({ contested: false, contestationNote: null });
  });
});

describe('payload — bordas que as regras sobrepostas escondiam', () => {
  it('nome com idioma sem espaço antes do parêntese, e parêntese no meio não é idioma', () => {
    expect(parseAliases('Jung(de)')).toEqual([
      { alias: 'Jung', language: 'de' },
    ]);
    expect(parseAliases('Jung (de) filho')).toEqual([
      { alias: 'Jung (de) filho', language: 'und' },
    ]);
    expect(parseAliases('(de)')).toEqual([{ alias: '(de)', language: 'und' }]);
    expect(parseAliases('Carl  (pt-BR)')).toEqual([
      { alias: 'Carl', language: 'pt-BR' },
    ]);
  });

  it('período com início e fim no mesmo ano é aceito; o fim anterior não', async () => {
    const base = {
      kind: 'person',
      label: 'X',
      description: 'd',
      precision: 'exact',
      startEra: 'ce',
      endEra: 'ce',
    };
    const body = (await buildEditorBody(
      'nodes',
      draft({ fields: { ...base, start: '50', end: '50' } }),
      catalog,
      {} as Api,
    )) as { startYear: number; endYear: number };
    expect([body.startYear, body.endYear]).toEqual([50, 50]);
    await expect(
      buildEditorBody(
        'nodes',
        draft({ fields: { ...base, start: '50', end: '49' } }),
        catalog,
        {} as Api,
      ),
    ).rejects.toThrow('O fim do período deve ser posterior ao início.');
  });

  it('sem era informada, o ano vale como d.C.; campos de ano ausentes são período aberto', async () => {
    const body = (await buildEditorBody(
      'nodes',
      draft({
        fields: {
          kind: 'person',
          label: 'X',
          description: 'd',
          precision: 'approximate',
          start: '10',
        },
      }),
      catalog,
      {} as Api,
    )) as { startYear: number | null; endYear: number | null };
    expect(body.startYear).toBe(10);
    expect(body.endYear).toBeNull();
    const bce = (await buildEditorBody(
      'nodes',
      draft({
        fields: {
          kind: 'person',
          label: 'X',
          description: 'd',
          precision: 'approximate',
          start: '10',
          startEra: 'bce',
        },
      }),
      catalog,
      {} as Api,
    )) as { startYear: number };
    expect(bce.startYear).toBe(-9);
  });

  it('erros de identificador com índice de dois dígitos e sem prefixo de campo', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      scheme: 'wikidata' as const,
      value: `Q${i}`,
    }));
    const error = new ApiError(400, 'inválido', {
      details: [
        { path: 'identifiers.10.value', message: 'décima primeira linha' },
        { path: 'identifiers.1.value', message: 'segunda linha' },
        { path: 'xidentifiers.3.value', message: 'não é do campo' },
        { path: 'identifiers.3.valuex', message: 'sufixo estranho' },
      ],
    } as never);
    const issues = identifierIssues(error, rows);
    expect(issues.rows[10]).toBe('décima primeira linha');
    expect(issues.rows[1]).toBe('segunda linha');
    expect(Object.keys(issues.rows)).toEqual(['1', '10']);
    expect(issues.general).toEqual([]);
  });
});
