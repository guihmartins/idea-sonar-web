import { describe, expect, it, vi } from 'vitest';
import {
  buildEditorBody,
  emptyEvidence,
  evidenceDraft,
  formatAliases,
  parseAliases,
  type EditorDraft,
} from '../../src/pages/editor/payload';
import type { Api } from '../../src/api/adapter';
import type { Catalog, Evidence, Node } from '../../src/api/domain';

function draft(overrides: Partial<EditorDraft> = {}): EditorDraft {
  return {
    fields: {},
    contexts: [],
    evidence: [],
    contested: false,
    ...overrides,
  };
}

const catalog: Catalog = {
  nodeKinds: ['person', 'tradition', 'concept', 'work'],
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
      aliases: [{ alias: 'Jung', language: 'de' }],
      contexts: ['ctx-1'],
    });
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
