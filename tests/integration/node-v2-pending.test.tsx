import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { ImportPage, PendingPage } from '../../src/pages/RecordsPage';

function renderAt(
  path: string,
  element: ReactElement,
  services = createFixtureServices(),
  route = path,
) {
  void services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return services;
}

describe('importação e pendências — descartar e candidatos', () => {
  it('o detalhe do lote lista os candidatos de cada pendência com link para o editor', async () => {
    renderAt(
      `/imports/${ids.import}`,
      <ImportPage />,
      createFixtureServices(),
      '/imports/:id',
    );
    expect(await screen.findByText('Pendentes')).toBeInTheDocument();
    expect(screen.getByText('Descartados')).toBeInTheDocument();
    const candidates = screen.getByRole('list', {
      name: 'Candidatos de homonimo',
    });
    const link = await within(candidates).findByRole('link', {
      name: 'Jung (exemplo fictício)',
    });
    expect(link).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
    // Itens sem candidatos não ganham lista.
    expect(
      screen.queryByRole('list', { name: 'Candidatos de jung' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o candidato pelo ID enquanto o nome não chega ou se ele não existe mais', async () => {
    const services = createFixtureServices();
    const detail = vi.spyOn(services.api, 'detail');
    detail.mockRejectedValue(new Error('Sem registro'));
    renderAt(
      `/imports/${ids.import}`,
      <ImportPage />,
      services,
      '/imports/:id',
    );
    const link = await screen.findByRole('link', { name: ids.jung });
    expect(link).toHaveAttribute('href', `/edit/nodes/${ids.jung}`);
  });

  it('descartar exige a justificativa, tira a pendência da fila e o lote mostra Descartados', async () => {
    const services = createFixtureServices();
    const discard = vi.spyOn(services.api, 'discard');
    const resolve = vi.spyOn(services.api, 'resolve');
    renderAt('/pending', <PendingPage />, services);
    const user = userEvent.setup();
    await screen.findByRole('heading', {
      level: 2,
      name: 'Jung (exemplo fictício)',
    });
    await user.click(
      screen.getByRole('button', { name: 'Descartar pendência' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe a justificativa da resolução para descartar.',
    );
    expect(discard).not.toHaveBeenCalled();
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa da resolução' }),
      ' Já existe no mapa ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Descartar pendência' }),
    );
    expect(
      await screen.findByText('Pendência descartada.'),
    ).toBeInTheDocument();
    expect(discard).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.pending }),
      'Já existe no mapa',
      expect.any(String),
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Nenhuma pendência encontrada.'),
    ).toBeInTheDocument();
    const batch = await services.api.import(
      ids.import,
      new AbortController().signal,
    );
    expect(batch.result).toMatchObject({ pending: 0, discarded: 1 });
  });

  it('falha ao descartar mostra o erro e reaproveita a chave ao tentar de novo', async () => {
    const services = createFixtureServices();
    const discard = vi
      .spyOn(services.api, 'discard')
      .mockRejectedValueOnce(new Error('Falha ao descartar'));
    renderAt('/pending', <PendingPage />, services);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 2, name: /Jung/ });
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa da resolução' }),
      'Motivo do descarte',
    );
    const button = screen.getByRole('button', { name: 'Descartar pendência' });
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao descartar',
    );
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(
      await screen.findByText('Pendência descartada.'),
    ).toBeInTheDocument();
    expect(discard.mock.calls[1]?.[2]).toBe(discard.mock.calls[0]?.[2]);
  });

  it('desfazer o lote mostra o que estava pendente como descartado ("Lote desfeito")', async () => {
    const services = createFixtureServices();
    renderAt(
      `/imports/${ids.import}`,
      <ImportPage />,
      services,
      '/imports/:id',
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Desfazer importação' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Motivo para desfazer' }),
      'Desfazendo o lote de teste',
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar desfazer lote' }),
    );
    expect(
      await screen.findByText('Esta importação foi desfeita.'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('homonimo (nodes) — Lote desfeito'),
    ).toBeInTheDocument();
  });
});
