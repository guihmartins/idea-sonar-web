import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import type { Services } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { MapPage } from '../../src/pages/MapPage';
import type { Catalog, Node, Relation } from '../../src/api/domain';

// O Cytoscape real não roda em jsdom: o mapa de teste expõe o que a tela passa
// ao canvas (comandos de zoom, grupos, fluxo) e deixa selecionar por botão.
vi.mock('../../src/graph/GraphCanvas', () => ({
  GraphCanvas: (props: {
    nodes: Node[];
    relations: Relation[];
    catalog: Catalog;
    selected: string;
    onSelect: (id: string, edge: boolean) => void;
    focus: string;
    focusRevision: number;
    fitRevision: number;
    zoomCommand: { revision: number; factor: number };
    flowEnabled: boolean;
    groups: unknown[];
    positions: unknown;
    viewport: unknown;
  }) => (
    <div
      role="img"
      aria-label="canvas"
      data-selected={props.selected}
      data-focus={props.focus}
      data-focus-revision={props.focusRevision}
      data-fit-revision={props.fitRevision}
      data-zoom={JSON.stringify(props.zoomCommand)}
      data-flow={String(props.flowEnabled)}
      data-groups={JSON.stringify(props.groups)}
      data-positions={JSON.stringify(props.positions)}
      data-viewport={JSON.stringify(props.viewport)}
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
    </div>
  ),
}));

const relationIds = {
  first: ids.relation,
  second: '00000000-0000-4000-8000-000000000008',
  parallel: '00000000-0000-4000-8000-000000000009',
  documented: '00000000-0000-4000-8000-000000000010',
};

function renderMap(services: Services = createFixtureServices()) {
  void services.session?.login();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/map']}>
          <ServicesProvider services={services}>{children}</ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<MapPage />, { wrapper: Wrapper });
}
/** Serviços fictícios com trechos da API trocados; `build` recebe a API original. */
function withApi(
  build: (original: Services['api']) => Partial<Services['api']>,
): Services {
  const base = createFixtureServices();
  return { ...base, api: { ...base.api, ...build(base.api) } };
}
const canvas = () => screen.getByRole('img', { name: 'canvas' });
const panel = () => document.getElementById('panel-content') as HTMLElement;
// As linhas da lista de relações, sem as dos pontos parecidos (seção própria).
const relationRows = () =>
  within(
    within(panel()).getByRole('list', { name: 'Relações do ponto' }),
  ).getAllByRole('listitem');

async function pickRoot(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Jung',
) {
  await user.type(await screen.findByLabelText('Buscar ponto'), name);
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await user.click(
    await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
  );
  await screen.findByRole('heading', {
    name: 'Jung (exemplo fictício)',
    level: 2,
  });
}
/** Raiz Jung com as três relações dele carregadas (a API fictícia pagina de 2 em 2). */
async function loadJung(services: Services = createFixtureServices()) {
  const user = userEvent.setup();
  renderMap(services);
  await pickRoot(user);
  await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
  await waitFor(() => expect(relationRows()).toHaveLength(2));
  await user.click(screen.getByRole('button', { name: 'Mais conexões' }));
  await waitFor(() => expect(relationRows()).toHaveLength(3));
  return user;
}

describe('MapPage — trilho de seções', () => {
  it('lista as nove seções com o destino de cada uma', async () => {
    renderMap();
    const rail = await screen.findByRole('navigation', { name: 'Seções' });
    const links = within(rail).getAllByRole('link');
    expect(
      links.map((link) => [
        link.getAttribute('aria-label'),
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['Explorar mapa', '/map'],
      ['Pontos', '/nodes'],
      ['Relações', '/relations'],
      ['Fontes', '/sources'],
      ['Contextos', '/contexts'],
      ['Importações', '/imports'],
      ['Pendências', '/pending'],
      ['Views salvas', '/views'],
      ['Exportar dados', '/export'],
    ]);
  });
});

describe('MapPage — controles do canvas', () => {
  it('zoom e ajuste ficam desligados sem pontos e mandam o comando ao canvas', async () => {
    const user = userEvent.setup();
    renderMap();
    for (const name of [
      'Aumentar zoom',
      'Diminuir zoom',
      'Ajustar mapa à tela',
    ])
      expect(await screen.findByRole('button', { name })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Aumentar zoom' }),
    ).toHaveTextContent('+');
    expect(
      screen.getByRole('button', { name: 'Diminuir zoom' }),
    ).toHaveTextContent('−');
    await pickRoot(user);
    expect(screen.getByRole('button', { name: 'Aumentar zoom' })).toBeEnabled();
    expect(canvas()).toHaveAttribute('data-zoom', '{"revision":0,"factor":1}');
    await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }));
    expect(canvas()).toHaveAttribute(
      'data-zoom',
      '{"revision":1,"factor":1.2}',
    );
    await user.click(screen.getByRole('button', { name: 'Diminuir zoom' }));
    expect(JSON.parse(canvas().getAttribute('data-zoom') ?? '{}')).toEqual({
      revision: 2,
      factor: 1 / 1.2,
    });
    expect(canvas()).toHaveAttribute('data-fit-revision', '0');
    await user.click(
      screen.getByRole('button', { name: 'Ajustar mapa à tela' }),
    );
    expect(canvas()).toHaveAttribute('data-fit-revision', '1');
    await user.click(
      screen.getByRole('button', { name: 'Ajustar mapa à tela' }),
    );
    expect(canvas()).toHaveAttribute('data-fit-revision', '2');
  });

  it('o fluxo começa ligado e o botão alterna; centralizar avança a revisão de foco', async () => {
    const user = userEvent.setup();
    renderMap();
    await pickRoot(user);
    expect(canvas()).toHaveAttribute('data-flow', 'true');
    await user.click(screen.getByRole('button', { name: 'Fluxo' }));
    expect(canvas()).toHaveAttribute('data-flow', 'false');
    expect(screen.getByRole('button', { name: 'Fluxo' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(canvas()).toHaveAttribute('data-focus-revision', '0');
    expect(canvas()).toHaveAttribute('data-focus', ids.jung);
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    expect(canvas()).toHaveAttribute('data-focus-revision', '1');
  });

  it('passa ao canvas um grupo por contexto, com os pontos do primeiro contexto', async () => {
    const user = userEvent.setup();
    renderMap();
    await pickRoot(user);
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await waitFor(() =>
      expect(JSON.parse(canvas().getAttribute('data-groups') ?? '[]')).toEqual([
        {
          id: ids.context,
          label: 'Contexto fictício',
          period: 'Aproximadamente 1 a.C. — 100 d.C.',
          nodeIds: expect.arrayContaining([ids.jung, ids.gnosis]),
        },
      ]),
    );
    const groups = JSON.parse(canvas().getAttribute('data-groups') ?? '[]');
    expect(groups[0].nodeIds).toHaveLength(2);
  });

  it('a legenda mostra a cor de cada contexto e o tipo de cada símbolo', async () => {
    const user = userEvent.setup();
    renderMap();
    await pickRoot(user);
    const legend = await screen.findByText('Como ler o mapa');
    await user.click(legend);
    const dot = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.context-dot');
      if (!found) throw new Error('sem legenda de contexto');
      return found;
    });
    expect(dot.parentElement).toHaveTextContent('Contexto fictício');
    // Primeira cor da paleta (DESIGN.md) e o mesmo tom a 15% de opacidade.
    expect(dot.style.color).toBe('rgb(76, 107, 53)');
    expect(dot.style.background).toBe('rgba(76, 107, 53, 0.15)');
    const glyph = document.querySelector('.kind-key svg');
    expect(glyph).toHaveAttribute('fill', '#767c6b26');
    expect(glyph).toHaveAttribute('stroke', '#767c6b');
  });
});

describe('MapPage — painel do ponto', () => {
  it('mostra tipo, estado, contexto, outros nomes e as ligações do ponto', async () => {
    const services = withApi((original) => ({
      node: async (id, signal) => {
        const node = await original.node(id, signal);
        return id === ids.jung
          ? {
              ...node,
              aliases: [
                { alias: 'Jung', language: 'de' },
                { alias: 'C. G. Jung', language: 'und' },
              ],
            }
          : node;
      },
      detail: (async (type: string, id: string, signal?: AbortSignal) => {
        const found = await original.detail(type as 'contexts', id, signal);
        return type === 'contexts'
          ? { ...found, periodLabel: 'século I' }
          : found;
      }) as Services['api']['detail'],
    }));
    await loadJung(services);
    const details = within(panel());
    expect(details.getByText(/Pessoa · Ativo/)).toHaveTextContent(
      'Pessoa · Ativo · 3 conexões no total',
    );
    await waitFor(() =>
      expect(panel().querySelector('.node-context')).toHaveTextContent(
        'Contexto fictício · século I',
      ),
    );
    expect(details.getByText(/Também chamado/)).toHaveTextContent(
      'Também chamado: Jung, C. G. Jung',
    );
    expect(details.getByRole('link', { name: 'Editar ponto' })).toHaveAttribute(
      'href',
      `/edit/nodes/${ids.jung}`,
    );
    expect(details.getByRole('link', { name: 'Histórico' })).toHaveAttribute(
      'href',
      `/history/nodes/${ids.jung}`,
    );
  });

  it('lista cada relação com o rótulo, o outro ponto, a evidência e a contestação', async () => {
    await loadJung();
    const rows = relationRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      'estudou → Gnosticismo (exemplo fictício)ATR Contestada',
      'estudou → Conceito compartilhado fictícioATR Contestada',
      'estudou → Gnosticismo (exemplo fictício)DOC',
    ]);
    const buttons = rows.map((row) => within(row).getByRole('button'));
    expect(buttons.map((b) => b.className)).toEqual(['active', '', '']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    // O título da seção de fontes nomeia a relação ativa e o outro ponto.
    expect(
      within(panel()).getByRole('heading', { level: 3, name: /^Fontes/ }),
    ).toHaveTextContent('Fontes · estudou Gnosticismo (exemplo fictício)');
  });

  it('a seção de fontes traz índice, título, autor, trecho, tipo e localizador', async () => {
    await loadJung();
    const evidence = await waitFor(() => {
      const found = panel().querySelector<HTMLElement>('.evidence');
      if (!found) throw new Error('evidência ainda não carregou');
      return found;
    });
    await within(evidence).findByText('Autor fictício');
    expect(evidence.querySelector('.evidence-index')).toHaveTextContent('01');
    expect(within(evidence).getByRole('link')).toHaveAttribute(
      'href',
      'https://example.com/fonte-ficticia',
    );
    expect(within(evidence).getByRole('link')).toHaveTextContent(
      'Fonte sintética de demonstração ↗',
    );
    expect(evidence.querySelector('blockquote')).toHaveTextContent(
      'Trecho fictício: este material existe apenas para teste.',
    );
    expect(evidence.querySelector('.evidence-meta')).toHaveTextContent(
      'Contextualiza · Fonte secundária · Página fictícia 12',
    );
    expect(
      within(evidence).getByText('Explicação fictícia da evidência.'),
    ).toBeVisible();
    expect(evidence.querySelector('.evidence-author')).toHaveTextContent(
      'Autor fictício',
    );
  });

  it('o ponto de chegada lê a relação pelo rótulo inverso, exceto nas simétricas', async () => {
    const user = await loadJung();
    await user.click(
      screen.getByRole('button', { name: 'nó Gnosticismo (exemplo fictício)' }),
    );
    await screen.findByRole('heading', {
      name: 'Gnosticismo (exemplo fictício)',
      level: 2,
    });
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await waitFor(() =>
      expect(relationRows().map((row) => row.textContent)).toContain(
        'paralelo a → Conceito compartilhado fictícioINF Contestada',
      ),
    );
    const texts = relationRows().map((row) => row.textContent);
    expect(texts).toContain(
      'leitura inversa: estudou → Jung (exemplo fictício)ATR Contestada',
    );
    expect(texts).toContain(
      'leitura inversa: estudou → Jung (exemplo fictício)DOC',
    );
    // Só as relações que tocam o ponto aparecem.
    expect(texts.join('|')).not.toContain('Conceito compartilhado fictícioATR');
    // Pelo ponto de chegada da simétrica, o rótulo continua sendo o da própria relação.
    await user.click(
      screen.getByRole('button', {
        name: 'nó Conceito compartilhado fictício',
      }),
    );
    await screen.findByRole('heading', {
      name: 'Conceito compartilhado fictício',
      level: 2,
    });
    await waitFor(() =>
      expect(relationRows().map((row) => row.textContent)).toEqual([
        'leitura inversa: estudou → Jung (exemplo fictício)ATR Contestada',
        'paralelo a → Gnosticismo (exemplo fictício)INF Contestada',
      ]),
    );
  });

  it('trocar a relação ativa troca o título da seção de fontes', async () => {
    const user = await loadJung();
    const rows = relationRows();
    await user.click(within(rows[1]!).getByRole('button'));
    expect(
      await within(panel()).findByRole('heading', {
        level: 3,
        name: /^Fontes/,
      }),
    ).toHaveTextContent('Fontes · estudou Conceito compartilhado fictício');
    expect(within(rows[1]!).getByRole('button')).toHaveClass('active');
    expect(within(rows[0]!).getByRole('button')).not.toHaveClass('active');
  });
});

describe('MapPage — painel da relação', () => {
  async function openRelation(id: string) {
    const user = await loadJung();
    await user.click(screen.getByRole('button', { name: `relação ${id}` }));
    return user;
  }

  it('relação contestada: afirmação, metadados, direção, contexto e links', async () => {
    await openRelation(relationIds.first);
    const details = within(panel());
    expect(
      await details.findByRole('heading', {
        level: 2,
        name: 'Afirmação inteiramente fictícia para validar o painel de evidências.',
      }),
    ).toBeVisible();
    expect(details.getByText(/^Relação ·/)).toHaveTextContent(
      'Relação · estudou · Interpretação atribuída · Contestada',
    );
    expect(details.getByText('Estado editorial: Ativo')).toBeVisible();
    expect(details.getByText(/^Intensidade:/)).toHaveTextContent(
      'Intensidade: 2 · Relevância fictícia no cenário de teste.',
    );
    expect(
      details.getByText('Atribuição: Autoria de demonstração'),
    ).toBeVisible();
    expect(details.getByText(/^Contestação:/)).toHaveTextContent(
      'Contestação: Contestação fictícia do cenário de teste.',
    );
    expect(details.getByText(/^Direção:/)).toHaveTextContent(
      'Direção: Jung (exemplo fictício) estudou → Gnosticismo (exemplo fictício). Leitura inversa: Gnosticismo (exemplo fictício) leitura inversa: estudou Jung (exemplo fictício).',
    );
    expect(await details.findByText(/^Contexto:/)).toHaveTextContent(
      'Contexto: Contexto fictício · Região de teste · Aproximadamente 1 a.C. — 100 d.C.',
    );
    expect(
      details.getByRole('link', { name: 'Editar relação' }),
    ).toHaveAttribute('href', `/edit/relations/${relationIds.first}`);
    expect(details.getByRole('link', { name: 'Histórico' })).toHaveAttribute(
      'href',
      `/history/relations/${relationIds.first}`,
    );
    // A seção de fontes não ganha complemento de título quando vem do painel da relação.
    expect(
      await details.findByRole('heading', { level: 3, name: 'Fontes' }),
    ).toBeVisible();
  });

  it('relação documentada e não contestada não mostra contestação', async () => {
    await openRelation(relationIds.documented);
    const details = within(panel());
    expect(await details.findByText(/^Relação ·/)).toHaveTextContent(
      'Relação · estudou · Documentada',
    );
    expect(details.queryByText('Contestada')).not.toBeInTheDocument();
    expect(details.queryByText(/^Contestação:/)).not.toBeInTheDocument();
  });

  it('relação simétrica sem evidência: direção neutra e aviso de fontes', async () => {
    const user = await loadJung();
    await user.click(
      screen.getByRole('button', { name: 'nó Gnosticismo (exemplo fictício)' }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Expandir conexões' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: `relação ${relationIds.parallel}`,
      }),
    );
    const details = within(panel());
    expect(await details.findByText(/^Relação ·/)).toHaveTextContent(
      'Relação · paralelo a · Inferência / hipótese',
    );
    expect(details.getByText(/^Relação simétrica entre/)).toHaveTextContent(
      'Relação simétrica entre Gnosticismo (exemplo fictício) e Conceito compartilhado fictício.',
    );
    expect(
      details.getByText('Atribuição: Autoria de demonstração'),
    ).toBeVisible();
    expect(
      details.getByText(
        'Nenhuma evidência cadastrada. A classificação é informada pela API.',
      ),
    ).toBeVisible();
  });

  it('intensidade e atribuição ausentes viram texto padrão', async () => {
    const services = withApi((original) => ({
      relation: async (id, signal) => ({
        ...(await original.relation(id, signal)),
        intensity: null,
        intensityReason: null,
        attributionText: null,
        inferenceAuthor: null,
        contested: true,
        contestationNote: null,
        evidence: [
          {
            sourceId: null,
            sourceKind: 'conversation' as const,
            stance: 'supports' as const,
            excerpt: null,
            locator: '',
            explanation: '',
            conversationReference: 'Conversa de teste',
          },
        ],
      }),
    }));
    const user = await loadJung(services);
    await user.click(
      screen.getByRole('button', { name: `relação ${relationIds.first}` }),
    );
    const details = within(panel());
    expect(await details.findByText('Intensidade: Não avaliada')).toBeVisible();
    expect(details.getByText('Atribuição: Não informada')).toBeVisible();
    expect(details.queryByText(/^Contestação:/)).not.toBeInTheDocument();
    expect(details.getByText('Evidência sem fonte vinculada')).toBeVisible();
    expect(details.getByText('Conversa: Conversa de teste')).toBeVisible();
    expect(panel().querySelector('.evidence-meta')?.textContent).toBe(
      'Sustenta · Conversa',
    );
    expect(panel().querySelector('.evidence-author')).toBeNull();
    expect(panel().querySelector('blockquote')).toBeNull();
  });
});

describe('MapPage — falhas com nova tentativa', () => {
  it('ponto: mostra o erro e busca de novo ao tentar novamente', async () => {
    const node = vi.fn<Services['api']['node']>();
    const services = withApi((original) => {
      node
        .mockRejectedValueOnce(new ApiError(500, 'Ponto indisponível'))
        .mockImplementation((id, signal) => original.node(id, signal));
      return { node };
    });
    const user = userEvent.setup();
    renderMap(services);
    await user.type(await screen.findByLabelText('Buscar ponto'), 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('Ponto indisponível');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Jung (exemplo fictício)',
        level: 2,
      }),
    ).toBeVisible();
    expect(node).toHaveBeenCalledTimes(2);
  });

  it('fontes da relação ativa: erro e nova tentativa', async () => {
    const relation = vi.fn<Services['api']['relation']>();
    const services = withApi((original) => {
      relation
        .mockRejectedValueOnce(new ApiError(500, 'Fontes indisponíveis'))
        .mockImplementation((id, signal) => original.relation(id, signal));
      return { relation };
    });
    const user = await loadJung(services);
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('Fontes indisponíveis');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await within(panel()).findByRole('heading', {
        level: 3,
        name: /^Fontes/,
      }),
    ).toBeVisible();
  });

  it('painel da relação: erro e nova tentativa', async () => {
    const relation = vi.fn<Services['api']['relation']>();
    const services = withApi((original) => {
      let failed = false;
      relation.mockImplementation(async (id, signal) => {
        if (id === relationIds.second && !failed) {
          failed = true;
          throw new ApiError(500, 'Relação indisponível');
        }
        return original.relation(id, signal);
      });
      return { relation };
    });
    const user = await loadJung(services);
    await user.click(
      screen.getByRole('button', { name: `relação ${relationIds.second}` }),
    );
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('Relação indisponível');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(await within(panel()).findByText(/^Relação ·/)).toBeVisible();
  });

  it('fonte da evidência: erro e nova tentativa', async () => {
    const detail = vi.fn();
    const services = withApi((original) => {
      let failed = false;
      detail.mockImplementation(async (type, id, signal) => {
        if (type === 'sources' && !failed) {
          failed = true;
          throw new ApiError(500, 'Fonte indisponível');
        }
        return original.detail(type, id, signal);
      });
      return { detail } as Partial<Services['api']>;
    });
    const user = await loadJung(services);
    const alert = await within(panel()).findByRole('alert');
    expect(alert).toHaveTextContent('Fonte indisponível');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(await within(panel()).findByText('Autor fictício')).toBeVisible();
  });

  it('contextos: o erro aparece no topo e tentar novamente os carrega', async () => {
    const detail = vi.fn();
    const services = withApi((original) => {
      let failed = false;
      detail.mockImplementation(async (type, id, signal) => {
        if (type === 'contexts' && !failed) {
          failed = true;
          throw new ApiError(500, 'Contextos indisponíveis');
        }
        return original.detail(type, id, signal);
      });
      return { detail } as Partial<Services['api']>;
    });
    const user = userEvent.setup();
    renderMap(services);
    await pickRoot(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Contextos indisponíveis');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    await waitFor(() =>
      expect(panel().querySelector('.node-context')).toHaveTextContent(
        'Contexto fictício',
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('catálogo: o erro tem nova tentativa', async () => {
    const catalog = vi.fn<Services['api']['catalog']>();
    const services = withApi((original) => {
      catalog
        .mockRejectedValueOnce(new ApiError(500, 'Catálogo indisponível'))
        .mockImplementation((signal) => original.catalog(signal));
      return { catalog };
    });
    const user = userEvent.setup();
    renderMap(services);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Catálogo indisponível');
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Aumentar zoom' }),
    ).toBeVisible();
  });
});

describe('MapPage — busca, filtros e modo lista', () => {
  it('cada resultado traz o nome, o tipo com a descrição e o ID', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.type(await screen.findByLabelText('Buscar ponto'), 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const result = await screen.findByRole('button', {
      name: /Jung \(exemplo fictício\)/,
    });
    expect(result.querySelector('strong')).toHaveTextContent(
      'Jung (exemplo fictício)',
    );
    const [kind, id] = Array.from(result.querySelectorAll('small'));
    expect(kind).toHaveTextContent(
      'Pessoa · Registro sintético para testar a interface; não é uma afirmação histórica.',
    );
    expect(id).toHaveTextContent(`ID: ${ids.jung}`);
    // Escolher o resultado limpa o termo e a lista.
    await user.click(result);
    expect(screen.getByLabelText('Buscar ponto')).toHaveValue('');
    expect(
      screen.queryByRole('region', { name: 'Resultados da busca' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.search-results')).toBeNull();
  });

  it('buscar sem termo não abre a lista; o termo é aparado antes de buscar', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByLabelText('Buscar ponto');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(document.querySelector('.search-results')).toBeNull();
    await user.type(screen.getByLabelText('Buscar ponto'), '  Jung ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    ).toBeVisible();
    expect(screen.queryByText('Buscando…')).not.toBeInTheDocument();
  });

  it('os filtros de ano começam vazios e guardam o que se digita', async () => {
    const user = userEvent.setup();
    renderMap();
    const start = await screen.findByLabelText('Ano inicial (astronômico)');
    const end = screen.getByLabelText('Ano final (astronômico)');
    expect(start).toHaveValue(null);
    expect(end).toHaveValue(null);
    await user.type(start, '-50');
    await user.type(end, '120');
    expect(start).toHaveValue(-50);
    expect(end).toHaveValue(120);
    await user.clear(start);
    expect(start).toHaveValue(null);
    expect(screen.getByLabelText('Incluir período desconhecido')).toBeChecked();
    expect(screen.getByLabelText('Mostrar pendentes')).not.toBeChecked();
  });

  it('o modo lista descreve cada relação e esconde os controles do canvas', async () => {
    const user = await loadJung();
    await user.click(screen.getByRole('button', { name: 'Modo lista' }));
    expect(
      screen.getByRole('button', { name: 'Mostrar grafo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByRole('button', { name: 'Aumentar zoom' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Fluxo' }),
    ).not.toBeInTheDocument();
    const list = document.querySelector('.graph-list') as HTMLElement;
    const items = within(list)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(items).toEqual([
      'Jung (exemplo fictício)',
      'Gnosticismo (exemplo fictício)',
      'Conceito compartilhado fictício',
      'Jung (exemplo fictício) — estudou — Gnosticismo (exemplo fictício) (Interpretação atribuída) · Contestada',
      'Jung (exemplo fictício) — estudou — Conceito compartilhado fictício (Interpretação atribuída) · Contestada',
      'Jung (exemplo fictício) — estudou — Gnosticismo (exemplo fictício) (Documentada)',
    ]);
    expect(
      within(list).queryByText('Expanda um ponto para encontrar relações.'),
    ).not.toBeInTheDocument();
    // Escolher uma relação na lista abre o painel dela.
    await user.click(within(list).getAllByRole('button')[5]!);
    expect(await within(panel()).findByText(/^Relação ·/)).toHaveTextContent(
      'Relação · estudou · Documentada',
    );
  });

  it('o modo lista sem relações pede para expandir um ponto', async () => {
    const user = userEvent.setup();
    renderMap();
    await pickRoot(user);
    await user.click(screen.getByRole('button', { name: 'Modo lista' }));
    expect(
      screen.getByText('Expanda um ponto para encontrar relações.'),
    ).toBeVisible();
  });

  it('o painel recolhe e abre, e avisa quando nada está selecionado', async () => {
    const user = userEvent.setup();
    renderMap();
    expect(
      await screen.findByText(
        'Selecione um ponto ou fio para ler os detalhes.',
      ),
    ).toBeVisible();
    const toggle = screen.getByRole('button', { name: 'Recolher painel' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(panel()).toHaveAttribute('hidden');
    expect(
      screen.getByRole('button', { name: 'Abrir painel' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('MapPage — movimento reduzido, expansão e foco', () => {
  it('com preferência por menos movimento o fluxo começa desligado', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
      })),
    );
    try {
      const user = userEvent.setup();
      renderMap();
      await pickRoot(user);
      expect(canvas()).toHaveAttribute('data-flow', 'false');
      expect(screen.getByRole('button', { name: 'Fluxo' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('expansão truncada pela API avisa para refinar os filtros', async () => {
    const services = withApi((original) => ({
      neighbors: async (...args: Parameters<typeof original.neighbors>) => ({
        ...(await original.neighbors(...args)),
        truncated: true,
      }),
    }));
    const user = userEvent.setup();
    renderMap(services);
    await pickRoot(user);
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    expect(
      await screen.findByText(
        'A API limitou esta expansão. Refine os filtros.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Conexões carregadas.')).not.toBeInTheDocument();
  });

  it('o botão de expandir fica ocupado durante a chamada e a mensagem some ao trocar a raiz', async () => {
    const user = userEvent.setup();
    renderMap();
    await pickRoot(user);
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    expect(screen.getByRole('button', { name: 'Carregando…' })).toBeDisabled();
    expect(await screen.findByText('Conexões carregadas.')).toBeVisible();
    await user.type(screen.getByLabelText('Buscar ponto'), 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const results = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('.search-results');
      if (!found) throw new Error('sem resultados ainda');
      return found;
    });
    await user.click(
      await within(results).findByRole('button', {
        name: /Jung \(exemplo fictício\)/,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('Conexões carregadas.'),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Expandir conexões' }),
    ).toBeEnabled();
  });

  it('centralizar empilha o foco; voltar e avançar movem a seleção e a revisão', async () => {
    const user = await loadJung();
    const gnosis = 'nó Gnosticismo (exemplo fictício)';
    const concept = 'nó Conceito compartilhado fictício';
    await user.click(screen.getByRole('button', { name: gnosis }));
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    expect(canvas()).toHaveAttribute('data-focus', ids.gnosis);
    expect(canvas()).toHaveAttribute('data-focus-revision', '1');
    expect(canvas()).toHaveAttribute('data-selected', ids.gnosis);
    await user.click(screen.getByRole('button', { name: 'Voltar foco' }));
    expect(canvas()).toHaveAttribute('data-focus', ids.jung);
    expect(canvas()).toHaveAttribute('data-focus-revision', '2');
    expect(canvas()).toHaveAttribute('data-selected', ids.jung);
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Avançar foco' }));
    expect(canvas()).toHaveAttribute('data-focus', ids.gnosis);
    expect(canvas()).toHaveAttribute('data-focus-revision', '3');
    // Centralizar de novo depois de voltar descarta o futuro do histórico.
    await user.click(screen.getByRole('button', { name: 'Voltar foco' }));
    await user.click(screen.getByRole('button', { name: concept }));
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    expect(canvas()).toHaveAttribute('data-focus', ids.concept);
    expect(screen.getByRole('button', { name: 'Avançar foco' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeEnabled();
  });

  it('recolher a expansão tira do histórico de foco o que deixou de ser visível', async () => {
    const user = await loadJung();
    await user.click(
      screen.getByRole('button', { name: 'nó Gnosticismo (exemplo fictício)' }),
    );
    await user.click(screen.getByRole('button', { name: 'Centralizar' }));
    expect(canvas()).toHaveAttribute('data-focus', ids.gnosis);
    await user.click(
      screen.getByRole('button', { name: 'nó Jung (exemplo fictício)' }),
    );
    await user.click(screen.getByRole('button', { name: 'Recolher expansão' }));
    expect(
      await screen.findByText(
        'Expansão recolhida. Pontos compartilhados preservados.',
      ),
    ).toBeVisible();
    // O foco volta ao único ponto que ficou: a raiz.
    expect(canvas()).toHaveAttribute('data-focus', ids.jung);
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Avançar foco' })).toBeDisabled();
  });
});

describe('MapPage — restaurar view', () => {
  async function savedView(extra: Record<string, unknown> = {}) {
    const services = createFixtureServices();
    await services.session.login();
    const view = await services.api.save(
      'views',
      {
        name: 'Recorte restaurado',
        status: 'active',
        rootNodeId: ids.jung,
        filters: { includePending: true, startYear: -10, endYear: 90 },
        expandedNodes: [],
        positions: { [ids.jung]: { x: 40, y: 50 } },
        viewport: { zoom: 1.5, pan: { x: 8, y: 9 } },
        ...extra,
      },
      'restore-key',
    );
    return { services, view };
  }
  function renderRestore(services: Services, viewId: string) {
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={createQueryClient()}>
          <MemoryRouter initialEntries={[`/map?view=${viewId}`]}>
            <ServicesProvider services={services}>{children}</ServicesProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );
    }
    return render(<MapPage />, { wrapper: Wrapper });
  }

  it('anuncia a restauração, aplica filtros, posições, viewport, seleção e foco', async () => {
    const { services, view } = await savedView();
    renderRestore(services, view.id);
    expect(
      screen.getByText('Restaurando view com dados atuais…'),
    ).toBeVisible();
    expect(
      await screen.findByText('View restaurada com dados atuais.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Restaurando view com dados atuais…'),
    ).not.toBeInTheDocument();
    expect(JSON.parse(canvas().getAttribute('data-positions') ?? '{}')).toEqual(
      {
        [ids.jung]: { x: 40, y: 50 },
      },
    );
    expect(JSON.parse(canvas().getAttribute('data-viewport') ?? '{}')).toEqual({
      zoom: 1.5,
      pan: { x: 8, y: 9 },
    });
    expect(canvas()).toHaveAttribute('data-selected', ids.jung);
    expect(canvas()).toHaveAttribute('data-focus', ids.jung);
    expect(screen.getByLabelText('Mostrar pendentes')).toBeChecked();
    expect(screen.getByLabelText('Ano inicial (astronômico)')).toHaveValue(-10);
    expect(screen.getByLabelText('Ano final (astronômico)')).toHaveValue(90);
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('view inexistente mostra o erro e nenhum ponto', async () => {
    renderRestore(createFixtureServices(), 'nao-existe');
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('img', { name: 'canvas' }),
    ).not.toBeInTheDocument();
  });

  it('trocar o filtro depois de restaurar descarta as expansões e mantém a raiz', async () => {
    const { services, view } = await savedView();
    renderRestore(services, view.id);
    await screen.findByText('View restaurada com dados atuais.');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Incluir período desconhecido'));
    expect(
      await screen.findByText(
        'Filtros alterados. Expansões e cursores anteriores descartados.',
      ),
    ).toBeVisible();
    expect(canvas()).toHaveAttribute('data-selected', ids.jung);
    expect(canvas()).toHaveAttribute('data-focus', ids.jung);
    expect(screen.getByRole('button', { name: 'Voltar foco' })).toBeDisabled();
  });
});
