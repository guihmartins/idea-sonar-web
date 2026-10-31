import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import {
  ExportPage,
  HistoryPage,
  ImportPage,
  ImportsPage,
  PendingPage,
  RecordsPage,
} from '../../src/pages/RecordsPage';
import type { EntityType, PendingItem } from '../../src/api/domain';

function renderAt(
  path: string,
  routes: ReactElement,
  services = createFixtureServices(),
) {
  void services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>{routes}</ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { services };
}

describe('RecordsPage', () => {
  it('isola o cache por tipo ao alternar da lista de pontos para fontes', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const list = vi.spyOn(services.api, 'list');
    const queryClient = createQueryClient();
    const page = (type: EntityType) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/${type}`]}>
          <ServicesProvider services={services}>
            <RecordsPage type={type} />
          </ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(page('nodes'));
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();

    rerender(page('sources'));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Fonte sintética de demonstração',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('sources', null, expect.anything());
  });

  it('lista pontos com paginação e link de edição', async () => {
    renderAt('/nodes', <RecordsPage type="nodes" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pontos' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute(
      'href',
      '/edit/nodes',
    );
    const first = await screen.findByRole('heading', {
      level: 2,
      name: 'Jung (exemplo fictício)',
    });
    expect(first).toBeInTheDocument();
    expect(screen.queryByText('Nenhum registro encontrado.')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/Pessoa ·/)).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Ver e editar' })[0],
    ).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: /Obra/ }),
    ).toBeInTheDocument();
  });

  it.each([
    {
      type: 'relations',
      heading: 'Relações',
      title:
        'Afirmação inteiramente fictícia para validar o painel de evidências.',
      id: ids.relation,
    },
    {
      type: 'sources',
      heading: 'Fontes',
      title: 'Fonte sintética de demonstração',
      id: ids.source,
    },
    {
      type: 'contexts',
      heading: 'Contextos',
      title: 'Contexto fictício',
      id: ids.context,
    },
  ] as const)(
    'lista $type com rótulo e links correspondentes',
    async ({ type, heading, title, id }) => {
      renderAt(`/${type}`, <RecordsPage type={type} />);
      expect(
        await screen.findByRole('heading', { level: 1, name: heading }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute(
        'href',
        `/edit/${type}`,
      );
      expect(
        (await screen.findAllByRole('heading', { level: 2 })).map(
          (recordHeading) => recordHeading.textContent,
        ),
      ).toContain(title);
      expect(
        screen.getAllByRole('link', { name: 'Ver e editar' })[0],
      ).toHaveAttribute('href', `/edit/${type}/${id}`);
    },
  );

  it('não mostra link de cadastro para views e usa rótulo de restaurar', async () => {
    renderAt('/views', <RecordsPage type="views" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Views salvas' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Cadastrar' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        'Nenhum registro encontrado. Salve um recorte na tela Explorar mapa.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra falha ao carregar e permite tentar novamente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const list = vi
      .spyOn(services.api, 'list')
      .mockRejectedValueOnce(new Error('Falha ao listar'))
      .mockResolvedValue({ items: [], nextCursor: null });
    renderAt('/sources', <RecordsPage type="sources" />, services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao listar',
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('mostra orientação quando a lista de views está vazia', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'list').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderAt('/views', <RecordsPage type="views" />, services);
    expect(
      await screen.findByText(
        'Nenhum registro encontrado. Salve um recorte na tela Explorar mapa.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cadastrar' })).toBeNull();
  });
});

describe('ImportsPage', () => {
  it('lista importações e link de detalhes', async () => {
    renderAt('/imports', <ImportsPage />);
    expect(
      await screen.findByRole('link', { name: 'Importação fictícia' }),
    ).toHaveAttribute('href', `/imports/${ids.import}`);
    expect(screen.getByText(/Chat/)).toBeInTheDocument();
  });

  it('mostra mensagem quando não há importações', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'imports').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderAt('/imports', <ImportsPage />, services);
    expect(
      await screen.findByText('Nenhuma importação encontrada.'),
    ).toBeInTheDocument();
  });

  it('mostra estado de carregamento enquanto as importações respondem', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'imports').mockReturnValue(new Promise(() => {}));
    renderAt('/imports', <ImportsPage />, services);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Carregando importações…',
    );
  });

  it('recupera a lista de importações após falha temporária', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const imports = vi
      .spyOn(services.api, 'imports')
      .mockRejectedValueOnce(new Error('Falha temporária nas importações'))
      .mockResolvedValue({ items: [], nextCursor: null });
    renderAt('/imports', <ImportsPage />, services);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha temporária nas importações',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText('Nenhuma importação encontrada.'),
    ).toBeInTheDocument();
    expect(imports).toHaveBeenCalledTimes(2);
  });

  it('busca a próxima página de importações', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const imports = vi
      .spyOn(services.api, 'imports')
      .mockResolvedValueOnce({ items: [], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    renderAt('/imports', <ImportsPage />, services);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Mais importações' }));
    expect(imports).toHaveBeenCalledTimes(2);
  });
});

function renderImportPage(
  services = createFixtureServices(),
  routes: ReactElement = (
    <Routes>
      <Route path="/imports/:id" element={<ImportPage />} />
    </Routes>
  ),
) {
  return renderAt(`/imports/${ids.import}`, routes, services);
}

describe('ImportPage', () => {
  it('mantém os detalhes isolados por lote ao mudar o parâmetro da rota', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const original = await services.api.import(
      ids.import,
      new AbortController().signal,
    );
    const secondId = 'importação-segunda';
    const load = vi
      .spyOn(services.api, 'import')
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce({
        ...original,
        id: secondId,
        inputSummary: 'Segunda importação',
      });
    const route = (
      <Routes>
        <Route
          path="/imports/:id"
          element={
            <>
              <Link to={`/imports/${secondId}`}>Abrir outra importação</Link>
              <ImportPage />
            </>
          }
        />
      </Routes>
    );
    renderImportPage(services, route);
    expect(await screen.findByText('Importação fictícia')).toBeInTheDocument();

    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Abrir outra importação' }));

    expect(await screen.findByText('Segunda importação')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(secondId, expect.anything());
  });

  it('mostra os detalhes do lote agrupados por resultado', async () => {
    renderImportPage();
    expect(
      screen.queryByRole('group', { name: 'Confirmar desfazer' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Criados')).toBeInTheDocument();
    expect(screen.getByText('Atualizados')).toBeInTheDocument();
    expect(screen.getByText('Reutilizados')).toBeInTheDocument();
    expect(screen.getByText('Pendentes')).toBeInTheDocument();
    expect(screen.getByText('jung (nodes)')).toBeInTheDocument();
    expect(
      screen.getByText(
        'homonimo (nodes) — Nome já existente; selecionar ID explicitamente',
      ),
    ).toBeInTheDocument();
  });

  it('desfaz a importação após confirmação com motivo', async () => {
    const { services } = renderImportPage();
    const undo = vi.spyOn(services.api, 'undo');
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    const form = screen.getByRole('group', { name: 'Confirmar desfazer' });
    await user.type(
      within(form).getByRole('textbox', { name: 'Motivo para desfazer' }),
      ' motivo de teste ',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(
      await screen.findByText('Importação desfeita pela API.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Esta importação foi desfeita.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Desfazer importação' }),
    ).not.toBeInTheDocument();
    expect(undo).toHaveBeenCalledWith(
      ids.import,
      1,
      'motivo de teste',
      expect.any(String),
    );
  });

  it('desabilita os controles enquanto a API desfaz a importação', async () => {
    const { services } = renderImportPage();
    vi.spyOn(services.api, 'undo').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    const form = screen.getByRole('group', { name: 'Confirmar desfazer' });
    await user.type(
      within(form).getByRole('textbox', { name: 'Motivo para desfazer' }),
      'motivo',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(
      within(form).getByRole('button', { name: 'Confirmar desfazer lote' }),
    ).toBeDisabled();
    expect(
      within(form).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
  });

  it('cancela a confirmação de desfazer', async () => {
    renderImportPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar desfazer' }),
    ).not.toBeInTheDocument();
  });

  it('mostra erro ao falhar o desfazimento', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'undo').mockRejectedValueOnce(
      new Error('Lote alterado'),
    );
    renderImportPage(services);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    const form = screen.getByRole('group', { name: 'Confirmar desfazer' });
    expect(
      within(form).getByRole('textbox', { name: 'Motivo para desfazer' }),
    ).toHaveValue('');
    await user.type(
      within(form).getByRole('textbox', { name: 'Motivo para desfazer' }),
      'motivo',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Lote alterado');
  });

  it('mostra falha ao carregar o lote', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'import').mockRejectedValue(
      new Error('Falha ao carregar lote'),
    );
    renderImportPage(services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao carregar lote',
    );
  });

  it('permite tentar novamente após falha ao carregar o lote', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const getImport = vi
      .spyOn(services.api, 'import')
      .mockRejectedValueOnce(new Error('Falha temporária'));
    renderImportPage(services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha temporária',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    ).toBeInTheDocument();
    expect(getImport).toHaveBeenCalledTimes(2);
  });
});

describe('PendingPage', () => {
  it('mantém candidatos separados por tipo e proposta', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const firstNode = await services.api.node(ids.jung);
    const secondNode = await services.api.node(ids.gnosis);
    const firstPending: PendingItem = {
      id: 'pending-jung',
      batchId: ids.import,
      batchVersion: 1,
      clientRef: 'Jung proposto',
      entityType: 'nodes',
      reason: null,
      dependencies: [],
      payload: {
        nodes: [
          {
            clientRef: 'Jung proposto',
            kind: 'person',
            label: 'Jung proposto',
          },
        ],
      },
    };
    const secondPending: PendingItem = {
      ...firstPending,
      id: 'pending-gnosis',
      clientRef: 'Gnosticismo proposto',
      payload: {
        nodes: [
          {
            clientRef: 'Gnosticismo proposto',
            kind: 'tradition',
            label: 'Gnosticismo proposto',
          },
        ],
      },
    };
    const candidates = vi
      .spyOn(services.api, 'candidates')
      .mockImplementation(async (_type, term) => ({
        items: [term === 'Jung proposto' ? firstNode : secondNode],
        nextCursor: null,
      }));
    vi.spyOn(services.api, 'pending').mockResolvedValue({
      items: [firstPending, secondPending],
      nextCursor: null,
    });

    renderAt('/pending', <PendingPage />, services);

    const firstCard = (
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung proposto',
      })
    ).closest('form');
    const secondCard = (
      await screen.findByRole('heading', {
        level: 2,
        name: 'Gnosticismo proposto',
      })
    ).closest('form');
    if (!firstCard || !secondCard) throw new Error('cartão pendente ausente');
    expect(
      within(firstCard).getByText('Sem motivo informado.'),
    ).toBeInTheDocument();
    expect(
      await within(firstCard).findByRole('option', {
        name: /Jung \(exemplo fictício\)/,
      }),
    ).toBeInTheDocument();
    expect(
      await within(secondCard).findByRole('option', {
        name: /Gnosticismo \(exemplo fictício\)/,
      }),
    ).toBeInTheDocument();
    expect(candidates).toHaveBeenCalledWith(
      'nodes',
      'Jung proposto',
      expect.anything(),
    );
    expect(candidates).toHaveBeenCalledWith(
      'nodes',
      'Gnosticismo proposto',
      expect.anything(),
    );
  });

  it('resolve uma pendência de ponto escolhendo um candidato', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const resolve = vi.spyOn(services.api, 'resolve');
    renderAt('/pending', <PendingPage />, services);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Jung (exemplo fictício)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nome já existente; selecionar ID explicitamente'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver importação de origem' }),
    ).toHaveAttribute('href', `/imports/${ids.import}`);
    const select = screen.getByRole('combobox', { name: 'Candidato' });
    await screen.findByRole('option', { name: /Jung \(exemplo fictício\)/ });
    expect(
      screen.queryByText(/Nenhum candidato com nome semelhante/),
    ).toBeNull();
    const user = userEvent.setup();
    await user.selectOptions(select, ids.jung);
    const reason = screen.getByRole('textbox', {
      name: 'Justificativa da resolução',
    });
    await user.type(reason, ' Resolvido no teste ');
    await user.click(
      screen.getByRole('button', { name: 'Resolver pendência' }),
    );
    expect(
      await screen.findByText('Pendência resolvida pela API.'),
    ).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.pending }),
      ids.jung,
      'Resolvido no teste',
      expect.any(String),
    );
  });

  it('permite tentar resolver novamente e troca a chave idempotente após editar', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const resolve = vi
      .spyOn(services.api, 'resolve')
      .mockRejectedValueOnce(new Error('Resolução recusada'));
    renderAt('/pending', <PendingPage />, services);
    await screen.findByRole('heading', {
      level: 2,
      name: 'Jung (exemplo fictício)',
    });
    const select = screen.getByRole('combobox', { name: 'Candidato' });
    await screen.findByRole('option', { name: /Jung \(exemplo fictício\)/ });
    const user = userEvent.setup();
    await user.selectOptions(select, ids.jung);
    const reason = screen.getByRole('textbox', {
      name: 'Justificativa da resolução',
    });
    await user.type(reason, 'Primeira justificativa');
    const button = screen.getByRole('button', { name: 'Resolver pendência' });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Resolução recusada',
    );
    const firstKey = resolve.mock.calls[0]?.[3];
    await user.type(reason, ' atualizada');
    await user.click(button);
    expect(
      await screen.findByText('Pendência resolvida pela API.'),
    ).toBeInTheDocument();
    expect(resolve.mock.calls[1]?.[3]).not.toBe(firstKey);
  });

  it('mostra que não há candidatos semelhantes com a proposta original', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'candidates').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderAt('/pending', <PendingPage />, services);
    expect(
      await screen.findByText(/Nenhum candidato com nome semelhante/),
    ).toBeInTheDocument();
  });

  it('usa campo de ID livre para pendências de relação', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const relationPending: PendingItem = {
      id: 'pending-relation',
      batchId: ids.import,
      batchVersion: 1,
      clientRef: 'rel-pendente',
      entityType: 'relations',
      reason: null,
      dependencies: [],
      payload: { relations: [] },
    };
    vi.spyOn(services.api, 'pending').mockResolvedValue({
      items: [relationPending],
      nextCursor: null,
    });
    renderAt('/pending', <PendingPage />, services);
    const idField = await screen.findByRole('textbox', {
      name: 'ID da relação existente',
    });
    await userEvent.setup().type(idField, ` ${ids.relation} `);
    expect(idField).toHaveValue(ids.relation);
  });

  it('mostra falha ao carregar pendências e vazio quando não há nenhuma', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'pending')
      .mockRejectedValueOnce(new Error('Falha ao listar pendências'))
      .mockResolvedValue({ items: [], nextCursor: null });
    renderAt('/pending', <PendingPage />, services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao listar pendências',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText('Nenhuma pendência encontrada.'),
    ).toBeInTheDocument();
  });

  it('busca a próxima página de pendências', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const pending = vi
      .spyOn(services.api, 'pending')
      .mockResolvedValueOnce({ items: [], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ items: [], nextCursor: null });
    renderAt('/pending', <PendingPage />, services);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Mais pendências' }));
    expect(pending).toHaveBeenCalledTimes(2);
  });

  it('mostra falha de candidatos e recupera a lista ao tentar novamente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const candidates = vi
      .spyOn(services.api, 'candidates')
      .mockRejectedValueOnce(new Error('Falha ao buscar candidatos'));
    renderAt('/pending', <PendingPage />, services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao buscar candidatos',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('option', { name: /Jung \(exemplo fictício\)/ }),
    ).toBeInTheDocument();
    expect(candidates).toHaveBeenCalledTimes(2);
  });
});

function renderHistory(
  type: string,
  id: string,
  services?: ReturnType<typeof createFixtureServices>,
) {
  return renderAt(
    `/history/${type}/${id}`,
    <Routes>
      <Route path="/history/:type/:id" element={<HistoryPage />} />
    </Routes>,
    services,
  );
}

describe('HistoryPage', () => {
  it('rejeita tipos de histórico inválidos', async () => {
    renderHistory('sources' as EntityType, ids.source);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tipo de histórico inválido',
      }),
    ).toBeInTheDocument();
  });

  it('carrega o histórico de relações com o tipo correto da API', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const history = vi.spyOn(services.api, 'history').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderHistory('relations', ids.relation, services);
    expect(
      await screen.findByText('Sem alterações registradas.'),
    ).toBeInTheDocument();
    expect(history).toHaveBeenCalledWith(
      'relations',
      ids.relation,
      null,
      expect.any(AbortSignal),
    );
  });

  it('mostra entradas de histórico com os campos alterados', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'history').mockResolvedValue({
      items: [
        {
          id: 'h1',
          operation: 'create',
          createdAt: '2026-01-01T00:00:00.000Z',
          versionAfter: 1,
          batchId: null,
          beforeData: { label: 'Rótulo antigo', description: 'Antes' },
          afterData: {
            label: 'Novo rótulo',
            description: 'Depois',
            version: 1,
            updatedAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
        {
          id: 'h2',
          operation: 'outra-operacao',
          createdAt: '2026-01-02T00:00:00.000Z',
          versionAfter: 2,
          batchId: null,
          beforeData: { label: 'Novo rótulo' },
          afterData: { label: 'Novo rótulo' },
        },
      ],
      nextCursor: null,
    });
    renderHistory('nodes', ids.jung, services);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Criação' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Versão 1 · campos: label, description'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'outra-operacao' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Versão 2')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar ao registro' }),
    ).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
  });

  it('mostra o histórico vazio quando não há alterações', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'history').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderHistory('nodes', ids.jung, services);
    expect(
      await screen.findByText('Sem alterações registradas.'),
    ).toBeInTheDocument();
  });

  it('busca a página seguinte de histórico e lista as novas entradas', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const history = vi
      .spyOn(services.api, 'history')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'history-page-1',
            operation: 'create',
            createdAt: '2026-01-01T00:00:00.000Z',
            versionAfter: 1,
            batchId: null,
            beforeData: null,
            afterData: { label: 'Primeira entrada' },
          },
        ],
        nextCursor: 'next-page',
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 'history-page-2',
            operation: 'update',
            createdAt: '2026-01-02T00:00:00.000Z',
            versionAfter: 2,
            batchId: null,
            beforeData: { label: 'Antes' },
            afterData: { label: 'Depois', updatedAt: 'não listado' },
          },
        ],
        nextCursor: null,
      });
    renderHistory('nodes', ids.jung, services);
    expect(
      await screen.findByText('Versão 1 · campos: label'),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Mais histórico' }));
    expect(
      await screen.findByText('Versão 2 · campos: label'),
    ).toBeInTheDocument();
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('mostra falha ao carregar o histórico', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'history').mockRejectedValue(
      new Error('Falha no histórico'),
    );
    renderHistory('nodes', ids.jung, services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha no histórico',
    );
  });
});

describe('ExportPage', () => {
  it('baixa a exportação com sucesso', async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((data: Blob | MediaSource) => {
      if (data instanceof Blob) blobs.push(data);
      return 'blob:fixture';
    });
    const revokeObjectURL = vi.fn();
    let downloadedName = '';
    let downloadedUrl = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
      downloadedUrl = this.href;
    });
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    renderAt('/export', <ExportPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Baixar exportação' }));
    expect(
      await screen.findByText('Exportação preparada para download.'),
    ).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();
    expect(downloadedName).toBe('idea-sonar-export.json');
    expect(downloadedUrl).toBe('blob:fixture');
    const blob = blobs[0];
    if (!blob) throw new Error('arquivo de exportação não foi criado');
    expect(blob.type).toBe('application/json');
    expect(await blob.text()).toContain('contractVersion');
    await waitFor(
      () => expect(revokeObjectURL).toHaveBeenCalledWith('blob:fixture'),
      { timeout: 2500 },
    );
  });

  it('mostra erro e permite tentar novamente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'export')
      .mockRejectedValueOnce(new Error('Falha na exportação'))
      .mockResolvedValue({});
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fixture');
    URL.revokeObjectURL = vi.fn();
    renderAt('/export', <ExportPage />, services);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Baixar exportação' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha na exportação',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByText('Exportação preparada para download.'),
    ).toBeInTheDocument();
  });
});
