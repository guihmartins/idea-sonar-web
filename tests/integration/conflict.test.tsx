import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import { ApiError } from '../../src/api/client';
import type { Source } from '../../src/api/domain';
it('preserva rascunho no 409 e exige comparação antes de PATCH com versão atual', async () => {
  const services = createFixtureServices();
  await services.session.login();
  const original: Source = {
    id: ids.source,
    title: 'Fonte',
    authorText: 'Autoria fictícia',
    canonicalUrl: 'https://example.com/fonte',
    workNodeId: null,
    publicationLabel: null,
    doi: null,
    accessedAt: null,
    notes: 'Notas iniciais',
    status: 'active',
    version: 1,
    createdAt: '2026-10-24T12:00:00.000Z',
    updatedAt: '2026-10-24T12:00:00.000Z',
  };
  const current: Source = {
    ...original,
    notes: 'Editado em outra sessão',
    version: 2,
  };
  vi.spyOn(services.api, 'detail')
    .mockResolvedValueOnce(original)
    .mockResolvedValue(current);
  const save = vi
    .spyOn(services.api, 'save')
    .mockRejectedValueOnce(new ApiError(409, 'Conflito'))
    .mockResolvedValue({
      ...current,
      notes: 'Meu rascunho',
      version: 3,
    });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[`/edit/sources/${ids.source}`]}>
          <Routes>
            <Route path="/edit/:type/:id" element={<EntityEditor />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  const description = await screen.findByRole('textbox', {
    name: 'Notas',
  });
  await user.clear(description);
  await user.type(description, 'Meu rascunho');
  const button = screen.getByRole('button', { name: 'Salvar registro' });
  await user.click(button);
  const comparison = await screen.findByRole('group', {
    name: 'Conflito de edição',
  });
  expect(comparison).toHaveTextContent('Editado em outra sessão');
  expect(description).toHaveValue('Meu rascunho');
  expect(button).toBeDisabled();
  expect(save).toHaveBeenCalledTimes(1);
  await user.click(
    within(comparison).getByRole('button', {
      name: 'Continuar editando sobre a versão atual',
    }),
  );
  expect(save).toHaveBeenCalledTimes(1);
  await user.click(button);
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Registro salvo.',
  );
  expect(save.mock.calls[1]?.[3]?.version).toBe(2);
});
