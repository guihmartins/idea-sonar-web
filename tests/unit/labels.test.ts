import { describe, expect, it } from 'vitest';
import {
  entitySummary,
  entityTitle,
  pendingProposal,
  pendingTitle,
} from '../../src/components/labels';
import type { PendingItem } from '../../src/api/domain';
import type {
  Context,
  Node,
  Relation,
  SavedView,
  Source,
} from '../../src/api/domain';

const base = {
  version: 1,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const node: Node = {
  ...base,
  id: 'n1',
  label: 'Nó',
  kind: 'person',
  description: 'Descrição do nó',
  conceptScope: null,
  aliases: [],
  contexts: [],
  degreeTotal: 0,
  archivedAt: null,
};

const context: Context = {
  ...base,
  id: 'c1',
  label: 'Contexto',
  traditionNodeId: null,
  startYear: 0,
  endYear: 10,
  precision: 'exact',
  periodLabel: null,
  regionLabel: 'Região X',
  notes: null,
};

const source: Source = {
  ...base,
  id: 's1',
  title: 'Título da fonte',
  authorText: 'Autor X',
  workNodeId: null,
  canonicalUrl: null,
  publicationLabel: null,
  doi: null,
  accessedAt: null,
  notes: null,
};

const relation: Relation = {
  ...base,
  id: 'r1',
  sourceId: 'n1',
  targetId: 'n2',
  type: 'influenced',
  contextId: null,
  claim: 'Afirmação X',
  justification: 'Justificativa X',
  evidenceStatus: 'documented',
  intensity: null,
  intensityReason: null,
  attributionNodeId: null,
  attributionText: null,
  inferenceAuthor: null,
  contested: false,
  contestationNote: null,
  evidence: [],
  archivedAt: null,
};

const view: SavedView = {
  ...base,
  id: 'v1',
  name: 'View X',
  rootNodeId: null,
  filters: {},
  expandedNodes: ['a', 'b'],
  positions: {},
  viewport: { zoom: 1, pan: { x: 0, y: 0 } },
};

describe('entityTitle / entitySummary', () => {
  it('resolve título e resumo para cada tipo de entidade', () => {
    expect(entityTitle('nodes', node)).toBe('Nó');
    expect(entitySummary('nodes', node)).toBe('Pessoa · Descrição do nó');

    expect(entityTitle('contexts', context)).toBe('Contexto');
    expect(entitySummary('contexts', context)).toBe(
      'Região X · 1 a.C. — 10 d.C.',
    );

    expect(entityTitle('sources', source)).toBe('Título da fonte');
    expect(entitySummary('sources', source)).toBe('Autor X');

    expect(entityTitle('relations', relation)).toBe('Afirmação X');
    expect(entitySummary('relations', relation)).toBe('Justificativa X');

    expect(entityTitle('views', view)).toBe('View X');
    expect(entitySummary('views', view)).toBe('2 pontos expandidos');
  });

  it('localiza a proposta pelo clientRef e escolhe o primeiro título disponível', () => {
    const item: PendingItem = {
      id: 'p1',
      batchId: 'batch-1',
      batchVersion: 1,
      entityType: 'nodes',
      clientRef: 'target',
      reason: null,
      dependencies: [],
      payload: {
        nodes: [
          { clientRef: 'other', label: 'Ignorado' },
          { clientRef: 'target', title: 'Título proposto', claim: 'Afirmação' },
        ],
      },
    };
    expect(pendingProposal(item)).toEqual({
      clientRef: 'target',
      title: 'Título proposto',
      claim: 'Afirmação',
    });
    expect(pendingTitle(item)).toBe('Título proposto');
    expect(pendingTitle({ ...item, payload: { nodes: [] } })).toBe('target');
  });

  it('usa cada campo de título aceito quando ele é o único disponível', () => {
    const item: PendingItem = {
      id: 'p2',
      batchId: 'batch-2',
      batchVersion: 1,
      entityType: 'nodes',
      clientRef: 'target',
      reason: null,
      dependencies: [],
      payload: { nodes: [{ clientRef: 'target', label: 'Rótulo' }] },
    };
    expect(pendingTitle(item)).toBe('Rótulo');
    expect(
      pendingTitle({
        ...item,
        payload: { nodes: [{ clientRef: 'target', title: 'Título' }] },
      }),
    ).toBe('Título');
    expect(
      pendingTitle({
        ...item,
        entityType: 'relations',
        payload: { relations: [{ clientRef: 'target', claim: 'Afirmação' }] },
      }),
    ).toBe('Afirmação');
  });
});
