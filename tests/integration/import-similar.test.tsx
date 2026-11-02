import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ImportDetail } from '../../src/api/domain';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { ImportPage } from '../../src/pages/RecordsPage';

// Detalhe do lote: itens criados com `similar` não vazio ganham "Parecido com:";
// o aviso é pista, não desfecho, e os demais itens ficam como estavam.
type Services = ReturnType<typeof createFixtureServices>;
async function open(
  edit: (detail: ImportDetail) => ImportDetail = (detail) => detail,
) {
  const services: Services = createFixtureServices();
  await services.session.login();
  const original = services.api.import.bind(services.api);
  vi.spyOn(services.api, 'import').mockImplementation(async (id, signal) =>
    edit(await original(id, signal)),
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/imports/${ids.import}`]}>
        <ServicesProvider services={services}>
          <Routes>
            <Route path="/imports/:id" element={<ImportPage />} />
          </Routes>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 3, name: 'Criados' });
  return services;
}
const item = (ref: string) =>
  screen.getByText(new RegExp(`^${ref} \\(`)).closest('li') as HTMLElement;
const created = () =>
  screen.getByRole('heading', { level: 3, name: 'Criados' })
    .parentElement as HTMLElement;

describe('detalhe da importação — Parecido com', () => {
  it('mostra os pontos parecidos de um item criado, com link para o editor e a pontuação', async () => {
    await open();
    const row = within(item('individuacao'));
    expect(row.getByText('Parecido com:')).toBeVisible();
    const list = row.getByRole('list', { name: 'Parecidos com individuacao' });
    expect(list).toHaveClass('candidate-links');
    const link = within(list).getByRole('link', {
      name: 'Coniunctio (exemplo fictício)',
    });
    expect(link).toHaveAttribute('href', `/edit/nodes/${ids.coniunctio}`);
    expect(within(list).getByText(/^semelhança 0,\d\d$/)).toBeVisible();
    expect(
      row.getByText('Aviso, não desfecho: confira se não é o mesmo ponto.'),
    ).toBeVisible();
  });

  it('lista vazia, itens sem o campo e itens que não criaram ponto não mostram nada novo', async () => {
    await open();
    // Jung foi criado mas nada fora do lote lê parecido (lista vazia).
    expect(within(item('jung')).queryByText('Parecido com:')).toBeNull();
    // Atualizado, reutilizado e pendente não carregam `similar`.
    for (const ref of ['gnose', 'fonte', 'homonimo'])
      expect(within(item(ref)).queryByText('Parecido com:')).toBeNull();
    expect(screen.getAllByText('Parecido com:')).toHaveLength(1);
    expect(screen.getAllByText(/^Aviso, não desfecho/)).toHaveLength(1);
  });

  it('o aviso não muda o desfecho: o item segue em "Criados"', async () => {
    await open();
    expect(
      within(created()).getByText(/^individuacao \(nodes\)/),
    ).toBeVisible();
    expect(within(created()).getByText('Parecido com:')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Desfazer importação' }),
    ).toBeEnabled();
  });

  it('mostra até 3 parecidos, na ordem em que a API manda', async () => {
    await open((detail) => ({
      ...detail,
      result: {
        ...detail.result,
        items: detail.result.items.map((entry) =>
          entry.clientRef === 'jung'
            ? {
                ...entry,
                similar: [
                  { id: 'p1', label: 'Primeiro', score: 0.97 },
                  { id: 'p2', label: 'Segundo', score: 0.95 },
                  { id: 'p3', label: 'Terceiro', score: 0.94 },
                ],
              }
            : entry,
        ),
      },
    }));
    const list = within(item('jung')).getByRole('list', {
      name: 'Parecidos com jung',
    });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      'Primeiro semelhança 0,97',
      'Segundo semelhança 0,95',
      'Terceiro semelhança 0,94',
    ]);
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/edit/nodes/p1', '/edit/nodes/p2', '/edit/nodes/p3']);
  });

  it('lote desfeito não traz aviso', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const detail = await services.api.import(
      ids.import,
      new AbortController().signal,
    );
    await services.api.undo(ids.import, detail.version, 'Engano', 'k');
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[`/imports/${ids.import}`]}>
          <ServicesProvider services={services}>
            <Routes>
              <Route path="/imports/:id" element={<ImportPage />} />
            </Routes>
          </ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText('Esta importação foi desfeita.'),
    ).toBeVisible();
    expect(screen.queryByText('Parecido com:')).toBeNull();
  });
});
