import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { MapPage } from '../../src/pages/MapPage';
import type { Positions, Viewport } from '../../src/graph/layout/positions';
import { defaultFilters } from '../../src/api/domain';
import type { Catalog, Node, Relation, Source } from '../../src/api/domain';

vi.mock('../../src/graph/GraphCanvas', () => ({
  GraphCanvas: (props: {
    nodes: Node[];
    relations: Relation[];
    catalog: Catalog;
    selected: string;
    onSelect: (id: string, edge: boolean) => void;
    onSnapshot: (positions: Positions, viewport: Viewport) => void;
    focus: string;
    focusRevision: number;
    fitRevision: number;
  }) => (
    <div
      role="img"
      aria-label={`grafo com ${props.nodes.length} nós e ${props.relations.length} relações, foco ${props.focus}, revisão ${props.focusRevision}-${props.fitRevision}`}
    >
      {props.nodes.map((n) => (
        <button key={n.id} onClick={() => props.onSelect(n.id, false)}>
          nó {n.label}
        </button>
      ))}
      {props.relations.map((r) => (
        <button key={r.id} onClick={() => props.onSelect(r.id, true)}>
          relação {r.id}
        </button>
      ))}
      <button
        onClick={() =>
          props.onSnapshot(
            { [props.nodes[0]?.id ?? 'x']: { x: 1, y: 2 } },
            { zoom: 2, pan: { x: 3, y: 4 } },
          )
        }
      >
        snapshot
      </button>
    </div>
  ),
}));

function renderMap(path = '/map', services = createFixtureServices()) {
  void services.session.login();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <ServicesProvider services={services}>{children}</ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { services, ...render(<MapPage />, { wrapper: Wrapper }) };
}

async function withRoot(services = createFixtureServices()) {
  const user = userEvent.setup();
  const utils = renderMap('/map', services);
  const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
  await user.type(input, 'Jung');
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  const result = await screen.findByRole('button', {
    name: /Jung \(exemplo fictício\)/,
  });
  await user.click(result);
  return { user, ...utils };
}

describe('MapPage — busca e seleção de raiz', () => {
  it('mostra carregamento inicial do catálogo', () => {
    renderMap();
    expect(screen.getByText('Carregando catálogo…')).toBeInTheDocument();
  });

  it('busca, lista resultados e escolhe uma raiz', async () => {
    const { user } = await withRoot();
    expect(
      await screen.findByRole('img', { name: /grafo com 1 nós/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('1/500 pontos · 0 relações')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Buscar ponto' }));
  });

  it('mostra "Nenhum ponto encontrado" quando a busca não encontra nada', async () => {
    const user = userEvent.setup();
    renderMap();
    const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
    await user.type(input, 'zzz-inexistente');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(
      await screen.findByText('Nenhum ponto encontrado.'),
    ).toBeInTheDocument();
  });

  it('remove espaços ao redor do termo de busca', async () => {
    const user = userEvent.setup();
    renderMap();
    const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
    await user.type(input, '  Jung  ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    ).toBeInTheDocument();
  });

  it('pagina resultados de busca com "Mais resultados"', async () => {
    const user = userEvent.setup();
    renderMap();
    const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
    await user.type(input, 'fictício');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const more = await screen.findByRole('button', {
      name: 'Mais resultados',
    });
    await user.click(more);
    expect(
      await screen.findByText(/Conceito compartilhado fictício/),
    ).toBeInTheDocument();
  });
});

describe('MapPage — painel de detalhes', () => {
  it('exibe detalhes do nó selecionado', async () => {
    const { user } = await withRoot();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Também chamado: Jung')).toBeInTheDocument();
    const details = screen.getByRole('complementary', {
      name: 'Detalhes e evidências',
    });
    expect(
      within(details).getByText('Contexto fictício', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pessoa · Ativo · 3 conexões no total/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar ponto' })).toHaveAttribute(
      'href',
      `/edit/nodes/${ids.jung}`,
    );
    await user.click(screen.getByRole('button', { name: 'Recolher painel' }));
    expect(
      screen.getByRole('button', { name: 'Abrir painel' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('exibe o escopo do conceito e os metadados do contexto associado', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.type(
      await screen.findByRole('textbox', { name: 'Buscar ponto' }),
      'Conceito compartilhado',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', {
        name: /Conceito compartilhado fictício/,
      }),
    );
    expect(
      await screen.findByText('Escopo: Conceito amplo'),
    ).toBeInTheDocument();
  });

  it('omite aliases vazios e preserva o ID de contexto ausente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const node = await services.api.node(ids.jung);
    vi.spyOn(services.api, 'node').mockResolvedValue({
      ...node,
      aliases: [],
      contexts: ['contexto-removido'],
    });
    await withRoot(services);

    expect(
      await screen.findByRole('heading', { name: node.label }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Também chamado:/)).not.toBeInTheDocument();
    expect(screen.getByText('contexto-removido')).toBeInTheDocument();
  });

  it('expande conexões, paginando até esgotar, e recolhe a expansão', async () => {
    const { user } = await withRoot();
    const expand = () =>
      screen.getByRole('button', { name: /Expandir conexões|Mais conexões/ });
    await user.click(expand());
    expect(await screen.findByText('Conexões carregadas.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mais conexões' }),
    ).toBeInTheDocument();
    await user.click(expand());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Mais conexões' }),
      ).toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Recolher expansão' }));
    expect(
      await screen.findByText(
        'Expansão recolhida. Pontos compartilhados preservados.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Expandir conexões' }),
    ).toBeInTheDocument();
  });

  it('ignora uma expansão que termina após a troca de filtros', async () => {
    const { user, services } = await withRoot();
    const page = await services.api.neighbors(
      ids.jung,
      defaultFilters,
      null,
      new AbortController().signal,
    );
    let finishExpansion: ((value: typeof page) => void) | undefined;
    const neighbors = vi
      .spyOn(services.api, 'neighbors')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishExpansion = resolve;
          }),
      );

    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await waitFor(() => expect(neighbors).toHaveBeenCalledOnce());
    await user.click(screen.getByText('Filtros do mapa'));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'tradition',
    );
    expect(
      await screen.findByText(
        'Filtros alterados. Expansões e cursores anteriores descartados.',
      ),
    ).toBeInTheDocument();

    finishExpansion?.(page);

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: /grafo com 1 nós e 0 relações/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /nó Gnosticismo/ })).toBeNull();
  });

  it('ignora uma expansão cancelada ao centralizar a raiz', async () => {
    const { user, services } = await withRoot();
    const page = await services.api.neighbors(
      ids.jung,
      defaultFilters,
      null,
      new AbortController().signal,
    );
    let finishExpansion: ((value: typeof page) => void) | undefined;
    const neighbors = vi
      .spyOn(services.api, 'neighbors')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishExpansion = resolve;
          }),
      );

    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await waitFor(() => expect(neighbors).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    finishExpansion?.(page);

    await waitFor(() =>
      expect(
        screen.getByRole('img', { name: /grafo com 1 nós e 0 relações/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('Conexões carregadas.')).toBeNull();
    expect(screen.queryByRole('button', { name: /nó Gnosticismo/ })).toBeNull();
  });

  it.each([
    { neighbors: 499, expected: 500, limited: false },
    { neighbors: 500, expected: 1, limited: true },
  ])(
    'respeita o limite de 500 pontos com $neighbors candidatos retornados',
    async ({ neighbors: neighborCount, expected, limited }) => {
      const { user, services } = await withRoot();
      const root = await services.api.node(ids.jung);
      vi.spyOn(services.api, 'neighbors').mockResolvedValueOnce({
        nodes: Array.from({ length: neighborCount }, (_, index) => ({
          ...root,
          id: `limite-${index}`,
          label: `Ponto do limite ${index}`,
        })),
        relations: [],
        nextCursor: null,
        truncated: false,
      });

      await user.click(
        screen.getByRole('button', { name: 'Expandir conexões' }),
      );

      if (limited) {
        expect(
          await screen.findByText(
            'Limite de 500 pontos atingido. Recolha conexões ou refine os filtros.',
          ),
        ).toBeInTheDocument();
      } else {
        expect(
          await screen.findByText('Conexões carregadas.'),
        ).toBeInTheDocument();
      }
      expect(
        screen.getByRole('img', {
          name: new RegExp(`grafo com ${expected} nós`),
        }),
      ).toBeInTheDocument();
    },
  );

  it('seleciona uma relação pelo grafo e mostra o painel de evidências', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const relation = await services.api.relation(ids.relation);
    vi.spyOn(services.api, 'relation').mockResolvedValue({
      ...relation,
      evidence: [
        {
          sourceId: ids.source,
          sourceKind: 'secondary',
          stance: 'contextualizes',
          excerpt: 'Trecho fictício: este material existe apenas para teste.',
          locator: 'Página fictícia 12',
          explanation: 'Explicação fictícia da evidência.',
          conversationReference: null,
        },
      ],
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    const relationButton = screen.getAllByRole('button', {
      name: /^relação /,
    })[0];
    if (!relationButton) throw new Error('relação não encontrada no grafo');
    await user.click(relationButton);
    expect(
      await screen.findByText(
        'Afirmação inteiramente fictícia para validar o painel de evidências.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Contestada')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Contestação: Contestação fictícia do cenário de teste.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Relação · .* · Interpretação atribuída/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Intensidade: 2 · Relevância fictícia no cenário de teste.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Atribuição: Autoria de demonstração'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent?.includes(
            'Direção: Jung (exemplo fictício) estudou → Gnosticismo (exemplo fictício).',
          ) === true &&
          element.textContent.includes('Leitura inversa:'),
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === 'BLOCKQUOTE' &&
          element.textContent?.includes(
            'Trecho fictício: este material existe apenas para teste.',
          ) === true,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Fonte sintética de demonstração/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Contexto: Contexto fictício · Região de teste · Aproximadamente 1 a.C. — 100 d.C.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Contexto: Contexto fictício · Região de teste · Aproximadamente 1 a.C. — 100 d.C.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra relação simétrica sem indicar uma direção', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const [catalog, relation] = await Promise.all([
      services.api.catalog(),
      services.api.relation(ids.relation),
    ]);
    vi.spyOn(services.api, 'catalog').mockResolvedValue({
      ...catalog,
      relationTypes: catalog.relationTypes.map((type) =>
        type.code === relation.type ? { ...type, symmetric: true } : type,
      ),
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getAllByRole('button', { name: /^relação / })[0]!);

    expect(
      await screen.findByText(/Relação simétrica entre .* e .*/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Direção:/)).not.toBeInTheDocument();
  });

  it('exibe referência de conversa e omite trecho ausente da evidência', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const relation = await services.api.relation(ids.relation);
    vi.spyOn(services.api, 'relation').mockResolvedValue({
      ...relation,
      contextId: null,
      contested: false,
      contestationNote: null,
      evidence: [
        {
          sourceId: null,
          sourceKind: 'conversation',
          stance: 'supports',
          excerpt: null,
          locator: 'mensagem 42',
          explanation: 'Registro de teste da conversa.',
          conversationReference: 'sessão de teste, mensagem 42',
        },
      ],
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getAllByRole('button', { name: /^relação / })[0]!);

    expect(
      await screen.findByText('Conversa: sessão de teste, mensagem 42'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sustenta · Conversa · mensagem 42'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Registro de teste da conversa.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('blockquote')).not.toBeInTheDocument();
    expect(screen.queryByText(/Contestação:/)).not.toBeInTheDocument();
  });

  it('não mostra nota de contestação quando a relação não está contestada', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const relation = await services.api.relation(ids.relation);
    vi.spyOn(services.api, 'relation').mockResolvedValue({
      ...relation,
      contested: false,
      contestationNote: 'Nota antiga sem contestação ativa.',
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getAllByRole('button', { name: /^relação / })[0]!);

    expect(await screen.findByText(relation.claim)).toBeInTheDocument();
    expect(
      screen.queryByText('Contestação: Nota antiga sem contestação ativa.'),
    ).not.toBeInTheDocument();
  });

  it('mostra alternativas quando a relação não tem evidências nem intensidade', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const relation = await services.api.relation(ids.relation);
    vi.spyOn(services.api, 'relation').mockResolvedValue({
      ...relation,
      type: 'tipo-ausente-no-catálogo',
      contextId: null,
      intensity: null,
      intensityReason: null,
      attributionText: null,
      inferenceAuthor: null,
      contested: false,
      contestationNote: null,
      evidence: [],
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getAllByRole('button', { name: /^relação / })[0]!);
    expect(
      await screen.findByText(
        'Nenhuma evidência cadastrada. A classificação é informada pela API.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Intensidade: Não avaliada')).toBeInTheDocument();
    expect(screen.getByText('Atribuição: Não informada')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Relação · tipo-ausente-no-catálogo · Interpretação atribuída/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contestada')).not.toBeInTheDocument();
    expect(screen.queryByText(/Contexto:/)).not.toBeInTheDocument();
  });

  it('mostra DOI como referência e texto sem link quando a fonte não tem URL', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const source = (await services.api.detail('sources', ids.source)) as Source;
    vi.spyOn(services.api, 'detail').mockResolvedValue({
      ...source,
      canonicalUrl: null,
      publicationLabel: null,
      doi: '10.5555/fonte-teste',
    });
    const { user } = await withRoot(services);
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getAllByRole('button', { name: /^relação / })[0]!);
    expect(
      await screen.findByText(
        (_content, element) =>
          element?.classList.contains('evidence-author') === true &&
          element.textContent?.includes('10.5555/fonte-teste') === true,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Fonte sintética de demonstração').closest('a'),
    ).toBeNull();
  });

  it('mostra falha ao carregar contextos e permite tentar novamente', async () => {
    const services = createFixtureServices();
    const list = vi.spyOn(services.api, 'list');
    list.mockRejectedValueOnce(new Error('Falha ao carregar contextos'));
    renderMap('/map', services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao carregar contextos',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Filtros do mapa')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('mostra falha no detalhe do ponto e recupera ao tentar novamente', async () => {
    const services = createFixtureServices();
    const node = vi.spyOn(services.api, 'node');
    node.mockRejectedValueOnce(new Error('Falha ao abrir ponto'));
    const user = userEvent.setup();
    renderMap('/map', services);
    const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
    await user.type(input, 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao abrir ponto',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();
  });

  it('centraliza e navega pelo histórico de foco', async () => {
    const { user } = await withRoot();
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    const gnosisButton = screen.getByRole('button', {
      name: /nó Gnosticismo/,
    });
    await user.click(gnosisButton);
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    expect(
      screen.getByRole('img', { name: new RegExp(`foco ${ids.gnosis}`) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Voltar foco' }),
    ).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Voltar foco' }));
    expect(
      screen.getByRole('img', { name: new RegExp(`foco ${ids.jung}`) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Avançar foco' }));
    expect(
      screen.getByRole('img', { name: new RegExp(`foco ${ids.gnosis}`) }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Gnosticismo (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avançar foco' })).toBeDisabled();
  });
});

describe('MapPage — modo lista e grafo', () => {
  it('alterna para o modo lista e seleciona nó e relação pela lista', async () => {
    const { user } = await withRoot();
    await user.click(screen.getByRole('button', { name: 'Modo lista' }));
    expect(
      screen.getByText('Expanda um ponto para encontrar relações.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar grafo' }));
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getByRole('button', { name: 'Modo lista' }));
    expect(
      screen.getByRole('button', { name: 'Mostrar grafo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pontos' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Expanda um ponto para encontrar relações.'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Gnosticismo (exemplo fictício)',
      }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Gnosticismo (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    const relation = screen.getByRole('button', {
      name: /Jung \(exemplo fictício\) — estudou — Gnosticismo \(exemplo fictício\) \(Interpretação atribuída\) · Contestada/,
    });
    await user.click(relation);
    expect(
      await screen.findByText(
        'Afirmação inteiramente fictícia para validar o painel de evidências.',
      ),
    ).toBeInTheDocument();
  });

  it('ajusta o mapa à tela apenas quando há nós fora do modo lista', async () => {
    const user = userEvent.setup();
    renderMap();
    expect(
      await screen.findByRole('button', { name: 'Ajustar mapa à tela' }),
    ).toBeDisabled();
    await user.type(
      await screen.findByRole('textbox', { name: 'Buscar ponto' }),
      'Jung',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );
    const fit = screen.getByRole('button', { name: 'Ajustar mapa à tela' });
    expect(fit).not.toBeDisabled();
    await user.click(fit);
    expect(
      screen.getByRole('img', { name: /revisão 0-1/ }),
    ).toBeInTheDocument();
  });

  it('mostra o estado vazio quando nenhum ponto está visível', async () => {
    renderMap();
    expect(await screen.findByText('Uma ideia é o começo')).toBeInTheDocument();
    expect(screen.getByText('Sem raiz')).toBeInTheDocument();
  });
});

describe('MapPage — filtros', () => {
  it('altera filtros, reseta expansões e mostra a legenda de contextos', async () => {
    const services = createFixtureServices();
    const { user } = await withRoot(services);
    const search = vi.spyOn(services.api, 'search');
    await user.type(
      screen.getByRole('textbox', { name: 'Buscar ponto' }),
      'Jung',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await within(screen.getByLabelText('Resultados da busca')).findByRole(
      'button',
      { name: /Jung \(exemplo fictício\)/ },
    );
    await user.click(screen.getByText('Filtros do mapa'));
    const kindSelect = screen.getByRole('combobox', { name: 'Tipo' });
    await user.selectOptions(kindSelect, 'tradition');
    expect(
      await screen.findByText(
        'Filtros alterados. Expansões e cursores anteriores descartados.',
      ),
    ).toBeInTheDocument();
    const contextSelect = screen.getByRole('combobox', { name: 'Contexto' });
    await user.selectOptions(contextSelect, ids.context);
    const startYear = screen.getByRole('spinbutton', {
      name: 'Ano inicial (astronômico)',
    });
    await user.type(startYear, '10');
    const endYear = screen.getByRole('spinbutton', {
      name: 'Ano final (astronômico)',
    });
    await user.type(endYear, '20');
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir período desconhecido' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Mostrar pendentes' }),
    );
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        'Jung',
        {
          kind: 'tradition',
          contextId: ids.context,
          startYear: 10,
          endYear: 20,
          includeUnknownPeriod: false,
          includePending: true,
        },
        null,
        expect.anything(),
      ),
    );
    await user.clear(startYear);
    await user.clear(endYear);
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        'Jung',
        {
          kind: 'tradition',
          contextId: ids.context,
          startYear: null,
          endYear: null,
          includeUnknownPeriod: false,
          includePending: true,
        },
        null,
        expect.anything(),
      ),
    );
    expect(
      screen.getByText('Contexto fictício', { selector: '.legend-dots li' }),
    ).toBeInTheDocument();
  });

  it('reseta a seleção quando não há raiz ao mudar filtros', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(await screen.findByText('Filtros do mapa'));
    const kindSelect = screen.getByRole('combobox', { name: 'Tipo' });
    await screen.findByRole('option', { name: 'Pessoa' });
    await user.selectOptions(kindSelect, 'person');
    expect(
      await screen.findByText(
        'Filtros alterados. Expansões e cursores anteriores descartados.',
      ),
    ).toBeInTheDocument();
  });
});

describe('MapPage — salvar view', () => {
  it('zera posições e viewport ao escolher outra raiz', async () => {
    const { user, services } = await withRoot();
    const save = vi.spyOn(services.api, 'save');
    await user.click(screen.getByRole('button', { name: 'snapshot' }));
    const input = screen.getByRole('textbox', { name: 'Buscar ponto' });
    await user.clear(input);
    await user.type(input, 'Gnosticismo');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', {
        name: /Gnosticismo \(exemplo fictício\)/,
      }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Nome da view' }),
      'Outra raiz',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar view' }));
    expect(await screen.findByText('View salva.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'views',
      expect.objectContaining({
        rootNodeId: ids.gnosis,
        expandedNodes: [],
        positions: {},
        viewport: { zoom: 1, pan: { x: 0, y: 0 } },
      }),
      expect.any(String),
    );
  });

  it('salva uma view com o nome informado', async () => {
    const { user, services } = await withRoot();
    const save = vi.spyOn(services.api, 'save');
    await user.click(screen.getByRole('button', { name: 'snapshot' }));
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await screen.findByText('Conexões carregadas.');
    const nameInput = screen.getByRole('textbox', { name: 'Nome da view' });
    await user.type(nameInput, 'Minha view');
    await user.click(screen.getByRole('button', { name: 'Salvar view' }));
    expect(await screen.findByText('View salva.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'views',
      expect.objectContaining({
        name: 'Minha view',
        status: 'active',
        rootNodeId: ids.jung,
        expandedNodes: [ids.jung],
        positions: { [ids.jung]: { x: 1, y: 2 } },
        viewport: { zoom: 2, pan: { x: 3, y: 4 } },
      }),
      expect.any(String),
    );
    expect(nameInput).toHaveValue('');
  });

  it('mostra falha ao salvar uma view e mantém o nome para nova tentativa', async () => {
    const { user, services } = await withRoot();
    vi.spyOn(services.api, 'save').mockRejectedValueOnce(
      new Error('Falha ao salvar view'),
    );
    const name = screen.getByRole('textbox', { name: 'Nome da view' });
    await user.type(name, 'Recorte importante');
    await user.click(screen.getByRole('button', { name: 'Salvar view' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao salvar view',
    );
    expect(name).toHaveValue('Recorte importante');
  });

  it('restaura ponto, recorte e foco a partir de uma view salva', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const view = await services.api.save(
      'views',
      {
        name: 'Recorte restaurado',
        status: 'active',
        rootNodeId: ids.jung,
        filters: { includePending: true },
        expandedNodes: [],
        positions: { [ids.jung]: { x: 40, y: 50 } },
        viewport: { zoom: 1.5, pan: { x: 8, y: 9 } },
      },
      'restore-view-key',
    );
    renderMap(`/map?view=${view.id}`, services);

    expect(
      await screen.findByText('View restaurada com dados atuais.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: new RegExp(`foco ${ids.jung}`) }),
    ).toBeInTheDocument();
  });

  it('marca restauração parcial quando um ponto expandido não está no recorte', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const view = await services.api.save(
      'views',
      {
        name: 'Recorte parcial',
        status: 'active',
        rootNodeId: ids.jung,
        filters: {},
        expandedNodes: ['ausente'],
        positions: {},
        viewport: { zoom: 1, pan: { x: 0, y: 0 } },
      },
      'partial-view-key',
    );
    renderMap(`/map?view=${view.id}`, services);
    expect(
      await screen.findByText(
        'View restaurada parcialmente: há registros ausentes, arquivados ou acima do limite.',
      ),
    ).toBeInTheDocument();
  });

  it('desabilita salvar sem raiz escolhida', async () => {
    renderMap();
    expect(
      await screen.findByRole('button', { name: 'Salvar view' }),
    ).toBeDisabled();
  });
});

describe('MapPage — erros', () => {
  it('mostra falha de catálogo com opção de tentar novamente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'catalog').mockRejectedValue(
      new Error('Falha no catálogo'),
    );
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={createQueryClient()}>
          <MemoryRouter initialEntries={['/map']}>
            <ServicesProvider services={services}>{children}</ServicesProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );
    }
    render(<MapPage />, { wrapper: Wrapper });
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Falha no catálogo')).toBeInTheDocument();
  });

  it('mostra erro de busca e tenta novamente após nova consulta', async () => {
    const services = createFixtureServices();
    const search = vi.spyOn(services.api, 'search');
    search.mockRejectedValueOnce(new Error('Busca indisponível'));
    const user = userEvent.setup();
    renderMap('/map', services);
    const input = await screen.findByRole('textbox', { name: 'Buscar ponto' });
    await user.type(input, 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Busca indisponível',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    ).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('mostra falha ao expandir conexões e permite nova tentativa', async () => {
    const { user, services } = await withRoot();
    vi.spyOn(services.api, 'neighbors').mockRejectedValueOnce(
      new Error('Falha ao expandir'),
    );
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao expandir',
    );
  });
});
