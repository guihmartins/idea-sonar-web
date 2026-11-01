import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import type { Services } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import {
  ExportPage,
  HistoryPage,
  ImportPage,
  ImportsPage,
  PendingPage,
  RecordsPage,
} from '../../src/pages/RecordsPage';

function renderAt(path: string, routes: ReactElement, services: Services) {
  void services.session?.login();
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>{routes}</ServicesProvider>
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const empty = { items: [], nextCursor: null };

describe('RecordsPage — estados da lista', () => {
  it('avisa o carregamento e o tira quando os registros chegam', async () => {
    const gate = deferred<typeof empty>();
    renderAt(
      '/nodes',
      <RecordsPage type="nodes" />,
      withApi(() => ({ list: () => gate.promise }) as Partial<Services['api']>),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    gate.resolve(empty);
    await screen.findByText('Nenhum registro encontrado.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lista vazia de pontos não sugere salvar um recorte; a de views sim', async () => {
    const services = withApi(
      () => ({ list: async () => empty }) as Partial<Services['api']>,
    );
    const nodes = renderAt('/nodes', <RecordsPage type="nodes" />, services);
    expect(
      await screen.findByText('Nenhum registro encontrado.'),
    ).toBeVisible();
    expect(screen.queryByText(/Salve um recorte/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute(
      'href',
      '/edit/nodes',
    );
    nodes.unmount();
    renderAt('/views', <RecordsPage type="views" />, services);
    expect(
      await screen.findByText(
        'Nenhum registro encontrado. Salve um recorte na tela Explorar mapa.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Cadastrar' }),
    ).not.toBeInTheDocument();
  });

  it('cada registro leva ao editor; cada view leva ao mapa restaurado', async () => {
    const services = createFixtureServices();
    const nodes = renderAt('/nodes', <RecordsPage type="nodes" />, services);
    const first = (
      await screen.findAllByRole('link', { name: 'Ver e editar' })
    )[0];
    expect(first).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
    expect(
      screen.queryByRole('link', { name: 'Restaurar view' }),
    ).not.toBeInTheDocument();
    nodes.unmount();
    const views = withApi((original) => ({
      list: async (type, cursor, signal) =>
        type === 'views'
          ? {
              items: [
                {
                  id: 'view-1',
                  name: 'Minha view',
                  status: 'active' as const,
                  version: 1,
                  createdAt: '2026-10-24T12:00:00.000Z',
                  updatedAt: '2026-10-24T12:00:00.000Z',
                  rootNodeId: null,
                  filters: {},
                  expandedNodes: [],
                  positions: {},
                  viewport: { zoom: 1, pan: { x: 0, y: 0 } },
                },
              ],
              nextCursor: null,
            }
          : original.list(type, cursor, signal),
    }));
    renderAt('/views', <RecordsPage type="views" />, views);
    expect(
      await screen.findByRole('link', { name: 'Restaurar view' }),
    ).toHaveAttribute('href', '/map?view=view-1');
    expect(
      screen.queryByRole('link', { name: 'Ver e editar' }),
    ).not.toBeInTheDocument();
  });
});

describe('ImportsPage', () => {
  it('avisa o carregamento, o vazio e descreve cada lote', async () => {
    const gate = deferred<typeof empty>();
    const pending = renderAt(
      '/imports',
      <ImportsPage />,
      withApi(
        () => ({ imports: () => gate.promise }) as Partial<Services['api']>,
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Carregando importações…',
    );
    gate.resolve(empty);
    expect(
      await screen.findByText('Nenhuma importação encontrada.'),
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    pending.unmount();
    renderAt('/imports', <ImportsPage />, createFixtureServices());
    const link = await screen.findByRole('link', {
      name: 'Importação fictícia',
    });
    expect(link).toHaveAttribute('href', `/imports/${ids.import}`);
    expect(
      screen.queryByText('Nenhuma importação encontrada.'),
    ).not.toBeInTheDocument();
    const meta = link.closest('article')?.querySelector('p');
    expect(meta?.textContent).toBe(
      `${new Date('2026-10-24T12:00:00.000Z').toLocaleString('pt-BR')} · Chat · Aplicada com pendências`,
    );
  });
});

describe('ImportPage — desfazer', () => {
  function renderDetail(services: Services = createFixtureServices()) {
    return renderAt(
      `/imports/${ids.import}`,
      <Routes>
        <Route path="/imports/:id" element={<ImportPage />} />
      </Routes>,
      services,
    );
  }

  it('mostra o carregamento e só abre a confirmação ao pedir; cancelar fecha', async () => {
    const gate = deferred<unknown>();
    const services = withApi((original) => ({
      import: (async (id: string, signal: AbortSignal) => {
        await gate.promise;
        return original.import(id, signal);
      }) as Services['api']['import'],
    }));
    renderDetail(services);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    gate.resolve(undefined);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const form = screen.getByRole('group', { name: 'Confirmar desfazer' });
    expect(form).toBeVisible();
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar desfazer' }),
    ).not.toBeInTheDocument();
  });

  it('sem pedir, não há formulário; desfazer envia a versão e o motivo aparado, e avisa', async () => {
    const undo = vi.fn();
    const services = withApi((original) => ({
      undo: undo.mockImplementation(
        (...args: Parameters<typeof original.undo>) => original.undo(...args),
      ),
    }));
    renderDetail(services);
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Desfazer importação' });
    expect(
      screen.queryByRole('group', { name: 'Confirmar desfazer' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Importação desfeita pela API.'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Desfazer importação' }),
    );
    await user.type(
      screen.getByLabelText('Motivo para desfazer'),
      '  engano  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(
      await screen.findByText('Importação desfeita pela API.'),
    ).toBeVisible();
    expect(undo).toHaveBeenCalledTimes(1);
    expect(undo.mock.calls[0]?.slice(0, 3)).toEqual([ids.import, 1, 'engano']);
    expect(
      screen.queryByRole('group', { name: 'Confirmar desfazer' }),
    ).not.toBeInTheDocument();
  });

  it('falha ao desfazer mostra o erro e reabilita os botões', async () => {
    const services = withApi(() => ({
      undo: async () => {
        throw new ApiError(409, 'Registros editados depois');
      },
    }));
    renderDetail(services);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    await user.type(screen.getByLabelText('Motivo para desfazer'), 'x');
    await user.click(
      screen.getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Registros editados depois',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirmar desfazer lote' }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(
      screen.queryByText('Importação desfeita pela API.'),
    ).not.toBeInTheDocument();
  });

  it('o link de volta e os candidatos de cada item apontam para o editor', async () => {
    renderDetail();
    expect(
      await screen.findByRole('link', { name: 'Voltar às importações' }),
    ).toHaveAttribute('href', '/imports');
    const list = await screen.findByRole('list', {
      name: 'Candidatos de homonimo',
    });
    expect(
      await within(list).findByRole('link', { name: /Jung/ }),
    ).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
  });
});

describe('PendingPage, HistoryPage e ExportPage', () => {
  it('pendências: carregamento, vazio e mensagem de resultado', async () => {
    const gate = deferred<typeof empty>();
    const loading = renderAt(
      '/pending',
      <PendingPage />,
      withApi(
        () => ({ pending: () => gate.promise }) as Partial<Services['api']>,
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    gate.resolve(empty);
    expect(
      await screen.findByText('Nenhuma pendência encontrada.'),
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    loading.unmount();
    renderAt('/pending', <PendingPage />, createFixtureServices());
    expect(
      await screen.findByRole('button', { name: 'Descartar pendência' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Nenhuma pendência encontrada.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('descartar sem justificativa avisa; com justificativa descarta e informa', async () => {
    const discard = vi.fn();
    const services = withApi((original) => ({
      discard: discard.mockImplementation(
        (...args: Parameters<typeof original.discard>) =>
          original.discard(...args),
      ),
    }));
    renderAt('/pending', <PendingPage />, services);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Descartar pendência' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe a justificativa da resolução para descartar.',
    );
    expect(discard).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText('Justificativa da resolução'),
      '  duplicado ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Descartar pendência' }),
    );
    expect(await screen.findByText('Pendência descartada.')).toBeVisible();
    expect(discard.mock.calls[0]?.[1]).toBe('duplicado');
  });

  it('histórico: carregamento, vazio e erro com nova tentativa', async () => {
    const gate = deferred<typeof empty>();
    const loading = renderAt(
      `/history/nodes/${ids.jung}`,
      <Routes>
        <Route path="/history/:type/:id" element={<HistoryPage />} />
      </Routes>,
      withApi(
        () => ({ history: () => gate.promise }) as Partial<Services['api']>,
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Carregando histórico…',
    );
    gate.resolve(empty);
    expect(
      await screen.findByText('Sem alterações registradas.'),
    ).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    loading.unmount();

    const history = vi.fn();
    const services = withApi((original) => {
      history
        .mockRejectedValueOnce(new ApiError(500, 'Histórico fora do ar'))
        .mockImplementation((...args: Parameters<typeof original.history>) =>
          original.history(...args),
        );
      return { history } as Partial<Services['api']>;
    });
    renderAt(
      `/history/relations/${ids.relation}`,
      <Routes>
        <Route path="/history/:type/:id" element={<HistoryPage />} />
      </Routes>,
      services,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Histórico fora do ar');
    await userEvent
      .setup()
      .click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2));
    expect(history.mock.calls[1]?.[0]).toBe('relations');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('exportação: o botão avisa que prepara, baixa o arquivo e confirma; erro tem nova tentativa', async () => {
    const data = deferred<unknown>();
    const exportData = vi.fn();
    const services = withApi(
      () => ({ export: exportData }) as Partial<Services['api']>,
    );
    exportData.mockReturnValueOnce(data.promise);
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    renderAt('/export', <ExportPage />, services);
    const user = userEvent.setup();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Baixar exportação' }));
    expect(screen.getByRole('button', { name: 'Preparando…' })).toBeDisabled();
    data.resolve({ nodes: [] });
    expect(
      await screen.findByText('Exportação preparada para download.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Baixar exportação' }),
    ).toBeEnabled();

    exportData.mockRejectedValueOnce(new ApiError(500, 'Exportação falhou'));
    await user.click(screen.getByRole('button', { name: 'Baixar exportação' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Exportação falhou');
    exportData.mockResolvedValueOnce({ nodes: [] });
    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );
    await waitFor(() => expect(exportData).toHaveBeenCalledTimes(3));
  });
});
