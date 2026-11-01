import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import { ApiError } from '../../src/api/client';
import type { Entity } from '../../src/api/domain';

async function openConflict(
  type: 'nodes' | 'relations',
  id: string,
  change: (original: Entity) => Entity,
  edit: (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
) {
  const services = createFixtureServices();
  await services.session.login();
  const real = services.api.detail;
  const original = await real(type, id);
  let loads = 0;
  // Só o registro editado muda; os seletores continuam lendo a API de verdade.
  vi.spyOn(services.api, 'detail').mockImplementation((kind, key, signal) => {
    if (kind !== type || key !== id) return real(kind, key, signal);
    loads += 1;
    return Promise.resolve(
      loads === 1
        ? original
        : ({ ...change(original), version: original.version + 1 } as Entity),
    ) as ReturnType<typeof real>;
  });
  vi.spyOn(services.api, 'save').mockRejectedValue(
    new ApiError(409, 'Conflito'),
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ServicesProvider services={services}>
        <MemoryRouter initialEntries={[`/edit/${type}/${id}`]}>
          <Routes>
            <Route path="/edit/:type/:id" element={<EntityEditor />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Salvar registro' });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Salvar registro' }),
    ).toBeEnabled(),
  );
  await edit(user);
  await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
  return screen.findByRole('group', { name: 'Conflito de edição' });
}
const differences = (group: HTMLElement) =>
  Object.fromEntries(
    Array.from(group.querySelectorAll('dl > div')).map((row) => [
      row.querySelector('dt')?.textContent,
      Array.from(row.querySelectorAll('dd')).map((dd) => dd.textContent),
    ]),
  );

it('ponto: mostra só o que difere, com (vazio), identificadores e contextos formatados', async () => {
  const group = await openConflict(
    'nodes',
    ids.jung,
    (node) =>
      ({
        ...node,
        label: 'Nome em outra sessão',
        description: '',
        contexts: ['ctx-a', 'ctx-b'],
        identifiers: [
          { scheme: 'wikidata', value: 'Q1' },
          { scheme: 'viaf', value: '123' },
        ],
      }) as Entity,
    async (user) => {
      const name = await screen.findByLabelText('Nome');
      await user.clear(name);
      await user.type(name, 'Meu nome');
    },
  );
  expect(differences(group)).toEqual({
    label: ['Seu rascunho: Meu nome', 'Versão atual: Nome em outra sessão'],
    version: ['Seu rascunho: 1', 'Versão atual: 2'],
    description: [
      'Seu rascunho: Registro sintético para testar a interface; não é uma afirmação histórica.',
      'Versão atual: (vazio)',
    ],
    Contextos: [`Seu rascunho: ${ids.context}`, 'Versão atual: ctx-a, ctx-b'],
    Identificadores: [
      'Seu rascunho: (vazio)',
      'Versão atual: wikidata: Q1, viaf: 123',
    ],
  });
});

it('relação: contestação como Sim/Não e evidências em bloco', async () => {
  const group = await openConflict(
    'relations',
    ids.relation,
    (relation) =>
      ({
        ...relation,
        contested: true,
        evidence: [],
      }) as Entity,
    async (user) => {
      await user.click(await screen.findByLabelText('Relação contestada'));
      // A interpretação atribuída exige uma fonte que sustente a relação.
      await user.selectOptions(
        screen.getByLabelText('Papel da evidência'),
        'supports',
      );
    },
  );
  const rows = differences(group);
  expect(rows.Contestação).toEqual(['Seu rascunho: Não', 'Versão atual: Sim']);
  expect(rows.Evidências?.[0]).toMatch(/^Seu rascunho: \[\n/);
  expect(rows.Evidências?.[1]).toBe('Versão atual: []');
  expect(group.querySelectorAll('dl pre')).toHaveLength(2);
});
