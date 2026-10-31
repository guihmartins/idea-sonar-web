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
import type { Catalog, Node, Relation } from '../../src/api/domain';

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

function renderMap(path = '/map') {
  const services = createFixtureServices();
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

async function withRoot() {
  const user = userEvent.setup();
  const utils = renderMap();
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
    expect(
      screen.getByText(/Estado editorial: Ativo · 3 conexões no total/),
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

  it('seleciona uma relação pelo grafo e mostra o painel de evidências', async () => {
    const { user } = await withRoot();
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
        'Trecho fictício: este material existe apenas para teste.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Fonte sintética de demonstração/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Contexto: Contexto fictício/),
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
      screen.getByRole('button', { name: 'Voltar foco' }),
    ).not.toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Voltar foco' }));
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Avançar foco' }));
    expect(screen.getByRole('button', { name: 'Avançar foco' })).toBeDisabled();
  });
});

describe('MapPage — modo lista e grafo', () => {
  it('alterna para o modo lista e seleciona nó e relação pela lista', async () => {
    const { user } = await withRoot();
    await user.click(screen.getByRole('button', { name: /Expandir conexões/ }));
    await screen.findByText('Conexões carregadas.');
    await user.click(screen.getByRole('button', { name: 'Modo lista' }));
    expect(
      screen.getByRole('button', { name: 'Mostrar grafo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Pontos')).toBeInTheDocument();
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
    const relationEntries = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('—'));
    if (relationEntries[0]) await user.click(relationEntries[0]);
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
  });
});

describe('MapPage — filtros', () => {
  it('altera filtros, reseta expansões e mostra a legenda de contextos', async () => {
    const { user } = await withRoot();
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
    expect(screen.getByRole('listitem')).toHaveTextContent('Contexto fictício');
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
  it('salva uma view com o nome informado', async () => {
    const { user, services } = await withRoot();
    const save = vi.spyOn(services.api, 'save');
    const nameInput = screen.getByRole('textbox', { name: 'Nome da view' });
    await user.type(nameInput, 'Minha view');
    await user.click(screen.getByRole('button', { name: 'Salvar view' }));
    expect(await screen.findByText('View salva.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'views',
      expect.objectContaining({ name: 'Minha view', rootNodeId: ids.jung }),
      expect.any(String),
    );
    expect(nameInput).toHaveValue('');
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
