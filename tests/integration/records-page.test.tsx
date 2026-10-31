import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
});

function renderImportPage(services = createFixtureServices()) {
  return renderAt(
    `/imports/${ids.import}`,
    <Routes>
      <Route path="/imports/:id" element={<ImportPage />} />
    </Routes>,
    services,
  );
}

describe('ImportPage', () => {
  it('mostra os detalhes do lote agrupados por resultado', async () => {
    renderImportPage();
    expect(await screen.findByText('Criados')).toBeInTheDocument();
    expect(screen.getByText('jung (nodes)')).toBeInTheDocument();
    expect(
      screen.getByText(
        'homonimo (nodes) — Nome já existente; selecionar ID explicitamente',
      ),
    ).toBeInTheDocument();
  });

  it('desfaz a importação após confirmação com motivo', async () => {
    renderImportPage();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    const form = screen.getByRole('group', { name: 'Confirmar desfazer' });
    await user.type(
      within(form).getByRole('textbox', { name: 'Motivo para desfazer' }),
      'motivo de teste',
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
});

describe('PendingPage', () => {
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
    const user = userEvent.setup();
    await user.selectOptions(select, ids.jung);
    const reason = screen.getByRole('textbox', {
      name: 'Justificativa da resolução',
    });
    await user.type(reason, 'Resolvido no teste');
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
          beforeData: null,
          afterData: { label: 'Novo rótulo', version: 1 },
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
    expect(screen.getByText('Versão 1 · campos: label')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'outra-operacao' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Versão 2')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar ao registro' }),
    ).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
  });

  it('mostra estado vazio e pagina o histórico', async () => {
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
    const createObjectURL = vi.fn().mockReturnValue('blob:fixture');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    renderAt('/export', <ExportPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Baixar exportação' }));
    expect(
      await screen.findByText('Exportação preparada para download.'),
    ).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalled();
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
