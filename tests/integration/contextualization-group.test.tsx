import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import type { Services } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import {
  BatchResultPanel,
  ContextualizationGroup,
} from '../../src/pages/editor/Contextualization';
import type { ContextualModel } from '../../src/pages/editor/Contextualization';
import type { BatchOutcome } from '../../src/pages/editor/contextual';
import type { ImportResult, Node, Relation } from '../../src/api/domain';

const at = '2026-10-24T12:00:00.000Z';
function conceptNode(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    version: 1,
    createdAt: at,
    updatedAt: at,
    status: 'pending',
    kind: 'concept',
    label: 'Conceito contextual',
    description: 'd',
    conceptScope: 'contextual',
    startYear: null,
    endYear: null,
    precision: 'unknown',
    periodLabel: null,
    aliases: [],
    identifiers: [],
    contexts: [],
    degreeTotal: 0,
    archivedAt: null,
    ...extra,
  };
}
function link(id: string, targetId: string, claim: string): Relation {
  return {
    id,
    version: 1,
    createdAt: at,
    updatedAt: at,
    status: 'pending',
    sourceId: 'node-1',
    targetId,
    type: 'contextualizes',
    contextId: null,
    claim,
    justification: 'j',
    evidenceStatus: 'inference',
    intensity: null,
    intensityReason: null,
    attributionNodeId: null,
    attributionText: null,
    inferenceAuthor: 'eu',
    contested: false,
    contestationNote: null,
    evidence: [],
    archivedAt: null,
  };
}
function stubModel(overrides: Partial<ContextualModel> = {}): ContextualModel {
  return {
    fields: { evidenceStatus: 'documented' },
    update: vi.fn(),
    // Marca no DOM como cada campo foi pedido ao editor.
    text: (key, label, required, multiline) => (
      <label key={key}>
        {label}
        <input
          data-key={key}
          data-required={String(!!required)}
          data-multiline={String(!!multiline)}
        />
      </label>
    ),
    evidence: [],
    setEvidence: vi.fn(),
    setActionKey: vi.fn(),
    baseline: undefined,
    flow: 'create',
    relationChoice: '',
    setRelationChoice: vi.fn(),
    ...overrides,
  };
}
function renderGroup(model: ContextualModel, services: Services) {
  void services.session?.login();
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ServicesProvider services={services}>
          <ContextualizationGroup model={model} />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function withApi(
  build: (original: Services['api']) => Partial<Services['api']>,
): Services {
  const base = createFixtureServices();
  return { ...base, api: { ...base.api, ...build(base.api) } };
}

describe('ContextualizationGroup — criação', () => {
  it('pede conceito amplo, afirmação e justificativa obrigatórias e a classificação', async () => {
    const search = vi.fn();
    const services = withApi((original) => {
      search.mockImplementation((...args: Parameters<typeof original.search>) =>
        original.search(...args),
      );
      return { search };
    });
    const user = userEvent.setup();
    renderGroup(stubModel(), services);
    expect(
      screen.getByRole('group', { name: 'Contextualização' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /Um conceito contextual ativo precisa de ao menos um contexto/,
      ),
    ).toBeVisible();
    for (const label of [
      'Afirmação da contextualização',
      'Justificativa da contextualização',
    ])
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'data-required',
        'true',
      );
    expect(
      screen.getByLabelText('Afirmação da contextualização'),
    ).toHaveAttribute('data-multiline', 'true');
    expect(
      screen.getByLabelText('Justificativa da contextualização'),
    ).toHaveAttribute('data-multiline', 'true');
    expect(screen.getByLabelText('Classificação da evidência')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Evidências' })).toBeVisible();
    // Sem destino escolhido, nada aparece como selecionado.
    expect(screen.queryByText(/^Selecionado:/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar candidato'), 'Conceito');
    await screen.findByRole('radio', {
      name: /Conceito compartilhado fictício/,
    });
    expect(search.mock.calls[0]?.[1]).toMatchObject({
      kind: 'concept',
      includePending: false,
    });
  });

  it('só oferece como destino o conceito amplo e repassa a escolha', async () => {
    const update = vi.fn();
    const search = vi.fn().mockResolvedValue({
      items: [
        conceptNode('amplo', {
          label: 'Amplo',
          conceptScope: 'broad',
          status: 'active',
        }),
        conceptNode('contextual', { label: 'Contextual', status: 'active' }),
      ],
      nextCursor: null,
    });
    const user = userEvent.setup();
    renderGroup(
      stubModel({ update }),
      withApi(() => ({ search })),
    );
    await user.type(screen.getByLabelText('Buscar candidato'), 'c');
    const only = await screen.findByRole('radio', { name: /^Amplo/ });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    await user.click(only);
    expect(update).toHaveBeenCalledWith('targetId', 'amplo');
  });

  it('mostra o conceito amplo já escolhido pelo nome', async () => {
    renderGroup(
      stubModel({
        fields: { evidenceStatus: 'documented', targetId: ids.concept },
      }),
      createFixtureServices(),
    );
    expect(
      await screen.findByText('Selecionado: Conceito compartilhado fictício'),
    ).toBeVisible();
  });
});

describe('ContextualizationGroup — ativação', () => {
  const node = conceptNode('node-1');
  function activate(
    nodeRelations: Services['api']['nodeRelations'],
    nodeLookup?: Services['api']['node'],
    model: Partial<ContextualModel> = {},
  ) {
    const services = withApi((original) => ({
      nodeRelations,
      node: nodeLookup ?? original.node,
    }));
    return renderGroup(
      stubModel({ flow: 'activate', baseline: node, ...model }),
      services,
    );
  }

  it('sem relação pendente pede uma nova, com os campos obrigatórios', async () => {
    activate(vi.fn().mockResolvedValue({ items: [], nextCursor: null }));
    expect(
      await screen.findByText(
        /Este conceito não tem relação de contextualização pendente/,
      ),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Afirmação da contextualização'),
    ).toHaveAttribute('data-required', 'true');
    expect(screen.getByRole('group', { name: 'Conceito amplo' })).toBeVisible();
  });

  it('enquanto busca, avisa; se falhar, oferece nova tentativa', async () => {
    const nodeRelations = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'Relações fora do ar'))
      .mockResolvedValue({ items: [], nextCursor: null });
    activate(nodeRelations);
    expect(
      screen.getByText('Buscando a relação de contextualização…'),
    ).toBeVisible();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Relações fora do ar');
    await userEvent
      .setup()
      .click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText(
        /Este conceito não tem relação de contextualização pendente/,
      ),
    ).toBeVisible();
    expect(nodeRelations).toHaveBeenCalledTimes(2);
    expect(nodeRelations.mock.calls[0]?.[0]).toBe('node-1');
    expect(nodeRelations.mock.calls[0]?.[1]).toBe('contextualizes');
  });

  it('uma relação pendente: resumo fixo com o conceito amplo e seu estado', async () => {
    activate(
      vi.fn().mockResolvedValue({
        items: [
          link('l1', 'amplo', 'Afirmação da relação'),
          { ...link('l2', 'amplo', 'Já ativa'), status: 'active' },
        ],
        nextCursor: null,
      }),
      vi.fn().mockResolvedValue(
        conceptNode('amplo', {
          label: 'Conceito Amplo',
          conceptScope: 'broad',
          status: 'pending',
        }),
      ),
    );
    expect(
      await screen.findByText(
        /Ao salvar, o ponto e a relação de contextualização pendente são ativados/,
      ),
    ).toBeVisible();
    const summary = await screen.findByText(
      /Conceito amplo: Conceito Amplo · Pendente/,
    );
    expect(summary.parentElement).toHaveClass('link-summary');
    expect(summary.parentElement).toHaveTextContent('Afirmação da relação');
    expect(screen.queryByText('Já ativa')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Há mais de uma relação pendente/),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/O conceito amplo não está ativo/),
    ).toBeVisible();
  });

  it('conceito amplo ativo não gera aviso; sem o nome ainda, mostra o ID', async () => {
    activate(
      vi.fn().mockResolvedValue({
        items: [link('l1', 'amplo', 'Afirmação')],
        nextCursor: null,
      }),
      vi.fn().mockResolvedValue(
        conceptNode('amplo', {
          label: 'Amplo Ativo',
          conceptScope: 'broad',
          status: 'active',
        }),
      ),
    );
    expect(
      await screen.findByText(/Conceito amplo: Amplo Ativo · Ativo/),
    ).toBeVisible();
    expect(
      screen.queryByText(/O conceito amplo não está ativo/),
    ).not.toBeInTheDocument();
  });

  it('o ID aparece enquanto o conceito amplo não carrega, sem estado nem aviso', async () => {
    activate(
      vi.fn().mockResolvedValue({
        items: [link('l1', 'amplo-id', 'Afirmação')],
        nextCursor: null,
      }),
      () => new Promise(() => {}),
    );
    const summary = await screen.findByText(/Conceito amplo: amplo-id/);
    expect(summary).toHaveTextContent('Conceito amplo: amplo-id');
    expect(summary.textContent).not.toContain('·');
    expect(
      screen.queryByText(/O conceito amplo não está ativo/),
    ).not.toBeInTheDocument();
  });

  it('várias relações pendentes: pede a escolha e marca a escolhida', async () => {
    const setRelationChoice = vi.fn();
    const items = [link('l1', 'a', 'Primeira'), link('l2', 'b', 'Segunda')];
    activate(
      vi.fn().mockResolvedValue({ items, nextCursor: null }),
      undefined,
      { setRelationChoice, relationChoice: 'l2' },
    );
    expect(
      await screen.findByText(
        'Há mais de uma relação pendente. Escolha a que será ativada.',
      ),
    ).toBeVisible();
    const radios = await screen.findAllByRole('radio', {
      name: /Relação a ativar|Primeira|Segunda/,
    });
    expect(radios.map((r) => (r as HTMLInputElement).checked)).toEqual([
      false,
      true,
    ]);
    await userEvent.setup().click(radios[0]!);
    expect(setRelationChoice).toHaveBeenCalledWith('l1');
  });

  it('sem escolha explícita, a primeira relação vem marcada', async () => {
    activate(
      vi.fn().mockResolvedValue({
        items: [link('l1', 'a', 'Primeira'), link('l2', 'b', 'Segunda')],
        nextCursor: null,
      }),
    );
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).checked)).toEqual([
      true,
      false,
    ]);
  });
});

describe('ContextualizationGroup — modo ativar sem ponto carregado', () => {
  it('cai no formulário de criação quando ainda não há ponto base', () => {
    renderGroup(
      stubModel({ flow: 'activate', baseline: undefined }),
      createFixtureServices(),
    );
    expect(
      screen.getByText(
        /Um conceito contextual ativo precisa de ao menos um contexto/,
      ),
    ).toBeVisible();
  });
});

describe('BatchResultPanel', () => {
  const result = (items: ImportResult['items']): ImportResult => ({
    batchId: 'lote-9',
    status: items.some((i) => i.outcome === 'pending')
      ? 'committed_with_pending'
      : 'committed',
    created: 1,
    updated: 0,
    reused: 0,
    pending: items.filter((i) => i.outcome === 'pending').length,
    discarded: 0,
    clientRefToId: {},
    items,
    viewUrl: null,
    dryRun: false,
  });
  const item = (
    clientRef: string,
    entityType: string,
    outcome: 'created' | 'pending',
    reason: string | null = null,
  ) => ({
    clientRef,
    entityType,
    entityId: null,
    outcome,
    reason,
    candidates: [],
  });
  function show(outcome: BatchOutcome | null) {
    return render(
      <MemoryRouter>
        <BatchResultPanel outcome={outcome} />
      </MemoryRouter>,
    );
  }

  it('sem resultado não mostra nada', () => {
    const { container } = show(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('criação concluída e ativação concluída têm mensagens próprias, com o link do lote', () => {
    show({ flow: 'create', result: result([item('a', 'nodes', 'created')]) });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      'Conceito contextual criado e ativado. Ver importação',
    );
    expect(
      within(status).getByRole('link', { name: 'Ver importação' }),
    ).toHaveAttribute('href', '/imports/lote-9');
  });

  it('ativação concluída', () => {
    show({ flow: 'activate', result: result([item('a', 'nodes', 'created')]) });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Conceito contextual ativado. Ver importação',
    );
    expect(screen.getByRole('status').textContent).not.toContain('criado');
  });

  it('um item pendente: singular, tipo, referência e motivo', () => {
    show({
      flow: 'create',
      result: result([
        item('a', 'nodes', 'created'),
        item('conceito', 'nodes', 'pending', 'Nome repetido'),
      ]),
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'O lote foi gravado, mas 1 item ficou pendente. A ativação do conceito contextual não foi concluída.',
    );
    expect(
      within(alert)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Ponto conceito: Nome repetido']);
    expect(
      within(alert).getByRole('link', { name: 'Ver importação' }),
    ).toHaveAttribute('href', '/imports/lote-9');
  });

  it('vários pendentes: plural, tipos conhecidos e desconhecidos e motivo ausente', () => {
    show({
      flow: 'activate',
      result: result([
        item('r', 'relations', 'pending', 'Pontos inativos'),
        item('s', 'sources', 'pending'),
        item('c', 'contexts', 'pending', 'x'),
        item('o', 'outros', 'pending', 'y'),
      ]),
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'mas 4 itens ficaram pendentes.',
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [
        'Relação r: Pontos inativos',
        'Fonte s: Sem motivo informado.',
        'Contexto c: x',
        'outros o: y',
      ],
    );
  });
});
