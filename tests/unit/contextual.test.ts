import { describe, expect, it } from 'vitest';
import {
  NODE_REF,
  RELATION_REF,
  activateContextualBatch,
  contextualFlow,
  createContextualBatch,
  isContextualConcept,
  pendingContextualizations,
  pendingItems,
  savedNodeId,
} from '../../src/pages/editor/contextual';
import { emptyEvidence } from '../../src/pages/editor/payload';
import type { EditorDraft } from '../../src/pages/editor/payload';
import type { ImportResult, Node, Relation } from '../../src/api/domain';

const CONTEXT = '00000000-0000-4000-8000-000000000006';
const OTHER_CONTEXT = '00000000-0000-4000-8000-000000000016';
const BROAD = '00000000-0000-4000-8000-000000000003';
const SOURCE = '00000000-0000-4000-8000-000000000005';
const NODE = '00000000-0000-4000-8000-000000000031';
const LINK = '00000000-0000-4000-8000-000000000032';

function draft(
  fields: Record<string, string> = {},
  extra: Partial<EditorDraft> = {},
): EditorDraft {
  return {
    fields: {
      kind: 'concept',
      conceptScope: 'contextual',
      status: 'active',
      label: '  Gênese contextual  ',
      description: ' Descrição do conceito ',
      aliases: 'Genesis (en), Origem',
      precision: 'unknown',
      targetId: BROAD,
      claim: ' Contextualiza o conceito amplo ',
      justification: ' Justificativa da contextualização ',
      evidenceStatus: 'inference',
      inferenceAuthor: ' Curadoria ',
      attributionText: 'texto de outra classificação',
      ...fields,
    },
    contexts: [CONTEXT],
    evidence: [],
    contested: false,
    identifiers: [],
    ...extra,
  };
}

const node: Node = {
  id: NODE,
  version: 4,
  status: 'pending',
  createdAt: '2026-10-24T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
  kind: 'concept',
  label: 'Gênese contextual',
  description: 'Descrição do conceito',
  conceptScope: 'contextual',
  startYear: null,
  endYear: null,
  precision: 'unknown',
  periodLabel: null,
  aliases: [{ alias: 'Genesis', language: 'en' }],
  identifiers: [],
  contexts: [CONTEXT],
  degreeTotal: 0,
  archivedAt: null,
};
const link: Relation = {
  id: LINK,
  version: 2,
  status: 'pending',
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
  sourceId: NODE,
  targetId: BROAD,
  type: 'contextualizes',
  contextId: null,
  claim: 'Contextualiza',
  justification: 'Justificativa',
  evidenceStatus: 'inference',
  intensity: null,
  intensityReason: null,
  attributionNodeId: null,
  attributionText: null,
  inferenceAuthor: 'Curadoria',
  contested: false,
  contestationNote: null,
  evidence: [],
  archivedAt: null,
};

describe('contextualFlow', () => {
  const contextual = { kind: 'concept', conceptScope: 'contextual' };
  it('só vale para ponto, conceito contextual e estado ativo', () => {
    expect(
      contextualFlow('nodes', { ...contextual, status: 'active' }, undefined),
    ).toBe('create');
    expect(
      contextualFlow(
        'relations',
        { ...contextual, status: 'active' },
        undefined,
      ),
    ).toBeNull();
    expect(
      contextualFlow(
        'nodes',
        { kind: 'concept', conceptScope: 'broad', status: 'active' },
        undefined,
      ),
    ).toBeNull();
    expect(
      contextualFlow(
        'nodes',
        { kind: 'person', conceptScope: '', status: 'active' },
        undefined,
      ),
    ).toBeNull();
    expect(
      contextualFlow('nodes', { ...contextual, status: 'pending' }, undefined),
    ).toBeNull();
  });
  it('ativação vale para ponto pendente ou arquivado; ponto ativo segue o REST', () => {
    const fields = { ...contextual, status: 'active' };
    expect(contextualFlow('nodes', fields, node)).toBe('activate');
    expect(
      contextualFlow('nodes', fields, { ...node, status: 'archived' }),
    ).toBe('activate');
    expect(
      contextualFlow('nodes', fields, { ...node, status: 'active' }),
    ).toBeNull();
  });
  it('isContextualConcept exige conceito e escopo contextual', () => {
    expect(isContextualConcept(contextual)).toBe(true);
    expect(
      isContextualConcept({ kind: 'concept', conceptScope: 'broad' }),
    ).toBe(false);
    expect(
      isContextualConcept({ kind: 'work', conceptScope: 'contextual' }),
    ).toBe(false);
  });
});

describe('createContextualBatch', () => {
  it('monta um lote manual com o ponto e a contextualização', () => {
    expect(createContextualBatch(draft(), 'chave-1')).toEqual({
      contractVersion: '1',
      policyVersion: '1',
      idempotencyKey: 'chave-1',
      origin: 'manual',
      inputSummary: 'Conceito contextual criado no editor',
      dryRun: false,
      nodes: [
        {
          op: 'create',
          clientRef: NODE_REF,
          kind: 'concept',
          label: 'Gênese contextual',
          description: 'Descrição do conceito',
          conceptScope: 'contextual',
          startYear: null,
          endYear: null,
          precision: 'unknown',
          periodLabel: null,
          aliases: [
            { alias: 'Genesis', language: 'en' },
            { alias: 'Origem', language: 'und' },
          ],
          identifiers: [],
          contexts: [{ id: CONTEXT }],
          status: 'active',
        },
      ],
      relations: [
        {
          op: 'create',
          clientRef: RELATION_REF,
          type: 'contextualizes',
          source: { clientRef: NODE_REF },
          target: { id: BROAD },
          claim: 'Contextualiza o conceito amplo',
          justification: 'Justificativa da contextualização',
          evidenceStatus: 'inference',
          intensity: null,
          attributionText: null,
          inferenceAuthor: 'Curadoria',
          contested: false,
          status: 'active',
          evidence: [],
        },
      ],
    });
  });
  it('manda só a atribuição de interpretação atribuída e a fonte como referência', () => {
    const body = createContextualBatch(
      draft(
        {
          evidenceStatus: 'attributed_interpretation',
          attributionText: ' Pesquisadora ',
          inferenceAuthor: 'deve sumir',
        },
        {
          evidence: [
            {
              ...emptyEvidence,
              sourceId: SOURCE,
              locator: ' p. 3 ',
              explanation: ' Explica ',
            },
          ],
        },
      ),
      'k',
    );
    expect(body.relations?.[0]).toMatchObject({
      evidenceStatus: 'attributed_interpretation',
      attributionText: 'Pesquisadora',
      inferenceAuthor: null,
      evidence: [
        {
          sourceId: { id: SOURCE },
          sourceKind: 'secondary',
          stance: 'supports',
          locator: 'p. 3',
          excerpt: null,
          explanation: 'Explica',
          conversationReference: null,
        },
      ],
    });
  });
  it('evidência sem fonte vai com sourceId nulo', () => {
    const body = createContextualBatch(
      draft(
        {},
        {
          evidence: [
            { ...emptyEvidence, locator: 'p. 1', explanation: 'Sem fonte' },
          ],
        },
      ),
      'k',
    );
    expect(body.relations?.[0]).toMatchObject({
      evidence: [{ sourceId: null, locator: 'p. 1' }],
    });
  });
  it('documentada com fonte que sustenta passa', () => {
    const body = createContextualBatch(
      draft(
        { evidenceStatus: 'documented' },
        {
          evidence: [
            {
              ...emptyEvidence,
              sourceId: SOURCE,
              locator: 'p. 9',
              explanation: 'Sustenta',
            },
          ],
        },
      ),
      'k',
    );
    expect(body.relations?.[0]).toMatchObject({ evidenceStatus: 'documented' });
  });
  it.each([
    [
      'sem contexto',
      draft({}, { contexts: [] }),
      'Conceito contextual ativo exige ao menos um contexto.',
    ],
    [
      'sem conceito amplo',
      draft({ targetId: '' }),
      'Selecione o conceito amplo que contextualiza este conceito.',
    ],
    [
      'sem afirmação',
      draft({ claim: '   ' }),
      'Informe a afirmação e a justificativa da contextualização.',
    ],
    [
      'sem justificativa',
      draft({ justification: '' }),
      'Informe a afirmação e a justificativa da contextualização.',
    ],
    [
      'documentada sem evidência',
      draft({ evidenceStatus: 'documented' }),
      'Uma fonte é obrigatória para relação documentada ou interpretação atribuída: adicione evidência que a sustente.',
    ],
    [
      'inferência sem autoria',
      draft({ inferenceAuthor: ' ' }),
      'Inferência exige autoria da inferência.',
    ],
    [
      'atribuída sem atribuição',
      draft(
        { evidenceStatus: 'attributed_interpretation', attributionText: '' },
        {
          evidence: [
            {
              ...emptyEvidence,
              sourceId: SOURCE,
              locator: 'p.',
              explanation: 'x',
            },
          ],
        },
      ),
      'Interpretação atribuída exige a atribuição.',
    ],
    [
      'evidência sem localizador',
      draft({}, { evidence: [{ ...emptyEvidence, explanation: 'x' }] }),
      'Cada evidência exige localizador e explicação.',
    ],
    [
      'sem escopo',
      draft({ conceptScope: '' }),
      'Conceitos exigem escopo: amplo ou contextualizado.',
    ],
  ])('recusa antes de enviar: %s', (_name, input, message) => {
    expect(() => createContextualBatch(input, 'k')).toThrow(message);
  });
});

describe('período e identificadores no lote', () => {
  const dated = {
    start: '500',
    startEra: 'bce',
    end: '400',
    endEra: 'bce',
    precision: 'approximate',
    periodLabel: ' séc. V a.C. ',
  };
  const ids = [
    { scheme: 'wikidata', value: ' Q1000001 ' },
    { scheme: 'viaf', value: '  ' },
  ] as const;
  it('a criação leva o período e os identificadores (linhas em branco fora)', () => {
    const body = createContextualBatch(
      draft(dated, { identifiers: [...ids] }),
      'k',
    );
    expect(body.nodes?.[0]).toMatchObject({
      startYear: -499,
      endYear: -399,
      precision: 'approximate',
      periodLabel: 'séc. V a.C.',
      identifiers: [{ scheme: 'wikidata', value: 'Q1000001' }],
    });
  });
  it('a mesma lista em outra ordem não é mudança (a API devolve ordenado)', () => {
    const stored = {
      ...node,
      aliases: [
        { alias: 'Genesis', language: 'en' },
        { alias: 'Origem', language: 'und' },
      ],
      identifiers: [
        { scheme: 'openlibrary', value: 'OL1A' },
        { scheme: 'wikidata', value: 'Q1000001' },
      ],
    } as const;
    const body = activateContextualBatch(
      draft(
        { aliases: 'Origem, Genesis (en)' },
        {
          identifiers: [
            { scheme: 'wikidata', value: 'Q1000001' },
            { scheme: 'openlibrary', value: 'OL1A' },
          ],
        },
      ),
      {
        ...stored,
        aliases: [...stored.aliases],
        identifiers: [...stored.identifiers],
      },
      link,
      'k',
    );
    expect(body.nodes?.[0]).not.toHaveProperty('aliases');
    expect(body.nodes?.[0]).not.toHaveProperty('identifiers');
  });
  it('a ativação só leva o que mudou no período e nos identificadores', () => {
    const unchanged = activateContextualBatch(
      draft({ aliases: 'Genesis (en)' }),
      node,
      link,
      'k',
    );
    for (const key of [
      'startYear',
      'endYear',
      'precision',
      'periodLabel',
      'identifiers',
    ])
      expect(unchanged.nodes?.[0]).not.toHaveProperty(key);
    const changed = activateContextualBatch(
      draft({ ...dated, aliases: 'Genesis (en)' }, { identifiers: [ids[0]] }),
      node,
      link,
      'k',
    );
    expect(changed.nodes?.[0]).toMatchObject({
      startYear: -499,
      endYear: -399,
      precision: 'approximate',
      periodLabel: 'séc. V a.C.',
      identifiers: [{ scheme: 'wikidata', value: 'Q1000001' }],
    });
    const only = activateContextualBatch(
      draft({ aliases: 'Genesis (en)', end: '300', endEra: 'ce' }),
      { ...node, startYear: null, endYear: 100 },
      link,
      'k',
    );
    expect(only.nodes?.[0]).toMatchObject({ endYear: 300 });
    expect(only.nodes?.[0]).not.toHaveProperty('startYear');
  });
});

describe('activateContextualBatch', () => {
  it('com relação pendente, só muda o estado dos dois, em update parcial', () => {
    expect(
      activateContextualBatch(
        draft({ aliases: 'Genesis (en)' }),
        node,
        link,
        'k2',
      ),
    ).toEqual({
      contractVersion: '1',
      policyVersion: '1',
      idempotencyKey: 'k2',
      origin: 'manual',
      inputSummary: 'Conceito contextual ativado no editor',
      dryRun: false,
      nodes: [
        {
          op: 'update',
          clientRef: NODE_REF,
          id: NODE,
          expectedVersion: 4,
          status: 'active',
        },
      ],
      relations: [
        {
          op: 'update',
          clientRef: RELATION_REF,
          id: LINK,
          expectedVersion: 2,
          status: 'active',
        },
      ],
    });
  });
  it('leva junto o que o formulário mudou no ponto, e só isso', () => {
    const body = activateContextualBatch(
      draft(
        {
          label: 'Novo nome',
          description: 'Nova descrição',
          aliases: 'Genesis (en), Outro',
        },
        { contexts: [OTHER_CONTEXT, CONTEXT] },
      ),
      node,
      link,
      'k',
    );
    expect(body.nodes?.[0]).toEqual({
      op: 'update',
      clientRef: NODE_REF,
      id: NODE,
      expectedVersion: 4,
      status: 'active',
      label: 'Novo nome',
      description: 'Nova descrição',
      aliases: [
        { alias: 'Genesis', language: 'en' },
        { alias: 'Outro', language: 'und' },
      ],
      contexts: [{ id: OTHER_CONTEXT }, { id: CONTEXT }],
    });
  });
  it('mesmos contextos em outra ordem não contam como mudança', () => {
    const body = activateContextualBatch(
      draft({}, { contexts: [CONTEXT] }),
      { ...node, contexts: [CONTEXT] },
      link,
      'k',
    );
    expect(body.nodes?.[0]).not.toHaveProperty('contexts');
    const reordered = activateContextualBatch(
      draft({}, { contexts: [OTHER_CONTEXT, CONTEXT] }),
      { ...node, contexts: [CONTEXT, OTHER_CONTEXT] },
      link,
      'k',
    );
    expect(reordered.nodes?.[0]).not.toHaveProperty('contexts');
  });
  it('sem relação pendente, cria a contextualização apontando para o ponto pelo ID', () => {
    const body = activateContextualBatch(draft(), node, undefined, 'k3');
    expect(body.nodes).toHaveLength(1);
    expect(body.relations?.[0]).toMatchObject({
      op: 'create',
      clientRef: RELATION_REF,
      type: 'contextualizes',
      source: { id: NODE },
      target: { id: BROAD },
      status: 'active',
    });
  });
  it('recusa sem contexto, mesmo havendo relação pendente', () => {
    expect(() =>
      activateContextualBatch(draft({}, { contexts: [] }), node, link, 'k'),
    ).toThrow('Conceito contextual ativo exige ao menos um contexto.');
  });
  it('sem relação pendente, exige os dados da relação nova', () => {
    expect(() =>
      activateContextualBatch(draft({ targetId: '' }), node, undefined, 'k'),
    ).toThrow('Selecione o conceito amplo');
  });
});

describe('leitura do resultado', () => {
  const result: ImportResult = {
    batchId: 'b1',
    status: 'committed_with_pending',
    created: 1,
    updated: 0,
    reused: 0,
    pending: 1,
    discarded: 0,
    clientRefToId: { [NODE_REF]: NODE },
    items: [
      {
        clientRef: NODE_REF,
        entityType: 'nodes',
        entityId: NODE,
        outcome: 'created',
        reason: null,
        candidates: [],
      },
      {
        clientRef: RELATION_REF,
        entityType: 'relations',
        entityId: null,
        outcome: 'pending',
        reason: 'Relação ativa exige pontos ativos',
        candidates: [],
      },
    ],
    viewUrl: null,
    dryRun: false,
  };
  it('lista só os itens pendentes', () => {
    expect(pendingItems(result).map((item) => item.clientRef)).toEqual([
      RELATION_REF,
    ]);
  });
  it('acha o ponto criado pelo clientRef e o ativado pelo baseline', () => {
    expect(savedNodeId('create', undefined, result)).toBe(NODE);
    expect(
      savedNodeId('create', undefined, { ...result, clientRefToId: {} }),
    ).toBeNull();
    expect(savedNodeId('activate', node, result)).toBe(NODE);
    expect(savedNodeId('activate', undefined, result)).toBeNull();
  });
  it('só as contextualizações pendentes que partem do ponto', () => {
    const others: Relation[] = [
      link,
      { ...link, id: 'ativa', status: 'active' },
      { ...link, id: 'outro-tipo', type: 'influenced' },
      { ...link, id: 'chega', sourceId: BROAD, targetId: NODE },
    ];
    expect(pendingContextualizations(others, node)).toEqual([link]);
  });
});
