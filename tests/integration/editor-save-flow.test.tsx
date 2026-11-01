import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import type { Services } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import type { Entity } from '../../src/api/domain';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function editor(path: string, services: Services) {
  void services.session?.login();
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <Routes>
            <Route path="/edit/:type" element={<EntityEditor />} />
            <Route path="/edit/:type/:id" element={<EntityEditor />} />
          </Routes>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
/** Fonte existente, com `save` observável e controlável. */
function sourceEditor(
  save: (...args: Parameters<Services['api']['save']>) => Promise<Entity>,
) {
  const base = createFixtureServices();
  const spy = vi.fn(save);
  const services: Services = { ...base, api: { ...base.api, save: spy } };
  editor(`/edit/sources/${ids.source}`, services);
  return spy;
}
const saveButton = () =>
  screen.getByRole('button', { name: 'Salvar registro' });
async function ready() {
  const title = await screen.findByLabelText('Título');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  return title;
}
const saved = (entity: Entity, patch: Partial<Entity> = {}): Entity =>
  ({ ...entity, ...patch, version: entity.version + 1 }) as Entity;

describe('EntityEditor — ciclo de salvar', () => {
  it('trava o formulário enquanto salva, avisa e libera; o segundo salvamento usa versão e chave novas', async () => {
    const gate = deferred<Entity>();
    const save = sourceEditor((_type, _body, _key, entity) =>
      save.mock.calls.length === 1
        ? gate.promise
        : Promise.resolve(
            saved(entity!, { title: 'Segundo' } as Partial<Entity>),
          ),
    );
    const user = userEvent.setup();
    const title = await ready();
    await user.clear(title);
    await user.type(title, 'Primeiro');
    await user.click(saveButton());
    expect(saveButton()).toBeDisabled();
    expect(
      screen.getByRole('group', { name: 'Dados do registro' }),
    ).toBeDisabled();
    expect(screen.queryByText('Registro salvo.')).not.toBeInTheDocument();
    const first = save.mock.calls[0];
    gate.resolve(saved(first![3]!, { title: 'Primeiro' } as Partial<Entity>));
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.clear(title);
    await user.type(title, 'Segundo');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    const second = save.mock.calls[1];
    expect(second![3]!.version).toBe(2);
    expect(second![2]).not.toBe(first![2]);
  });

  it('um novo envio limpa o aviso e o erro anteriores', async () => {
    const save = sourceEditor((_type, _body, _key, entity) =>
      save.mock.calls.length === 2
        ? Promise.reject(new ApiError(500, 'Falha no segundo envio'))
        : Promise.resolve(saved(entity!)),
    );
    const user = userEvent.setup();
    await ready();
    await user.click(saveButton());
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha no segundo envio',
    );
    expect(screen.queryByText('Registro salvo.')).not.toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('o envio repetido depois de falhar reaproveita a chave de idempotência', async () => {
    const save = sourceEditor((_type, _body, _key, entity) =>
      save.mock.calls.length === 1
        ? Promise.reject(new ApiError(500, 'Falhou'))
        : Promise.resolve(saved(entity!)),
    );
    const user = userEvent.setup();
    await ready();
    await user.click(saveButton());
    await screen.findByRole('alert');
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![2]).toBe(save.mock.calls[0]![2]);
  });
});

describe('EntityEditor — arquivar', () => {
  it('pede confirmação, trava durante a chamada e fecha a confirmação ao concluir', async () => {
    const gate = deferred<Entity>();
    const save = sourceEditor(() => gate.promise);
    const user = userEvent.setup();
    await ready();
    expect(
      screen.queryByRole('group', { name: 'Confirmar arquivamento' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Arquivar registro' }));
    const confirm = screen.getByRole('group', {
      name: 'Confirmar arquivamento',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar arquivamento' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Arquivar registro' }));
    const again = screen.getByRole('group', { name: 'Confirmar arquivamento' });
    await user.click(
      within(again).getByRole('button', { name: 'Confirmar arquivamento' }),
    );
    expect(
      within(again).getByRole('button', { name: 'Confirmar arquivamento' }),
    ).toBeDisabled();
    expect(
      within(again).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Arquivar registro' }),
    ).toBeDisabled();
    gate.resolve(
      saved(save.mock.calls[0]![3]!, { status: 'archived' } as Partial<Entity>),
    );
    expect(
      await screen.findByText('Registro arquivado pela API.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Confirmar arquivamento' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Estado editorial')).toHaveValue('archived');
    expect(
      screen.getByRole('button', { name: 'Arquivar registro' }),
    ).toBeDisabled();
    expect(save.mock.calls[0]![1]).toEqual({ status: 'archived' });
  });

  it('falha ao arquivar mostra o erro, mantém a confirmação e libera os botões', async () => {
    sourceEditor(() => Promise.reject(new ApiError(409, 'Há dependências')));
    const user = userEvent.setup();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Arquivar registro' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar arquivamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Há dependências',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Confirmar arquivamento' }),
      ).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(
      screen.queryByText('Registro arquivado pela API.'),
    ).not.toBeInTheDocument();
  });
});

describe('EntityEditor — conflito', () => {
  it('"Usar dados atuais" substitui o rascunho e fecha a comparação', async () => {
    const base = createFixtureServices();
    await base.session.login();
    const original = await base.api.detail('sources', ids.source);
    const real = base.api.detail;
    let loads = 0;
    const services: Services = {
      ...base,
      api: {
        ...base.api,
        detail: ((kind: string, key: string, signal?: AbortSignal) => {
          if (kind !== 'sources') return real(kind as 'sources', key, signal);
          loads += 1;
          return Promise.resolve(
            loads === 1
              ? original
              : { ...original, title: 'Título da outra sessão', version: 2 },
          );
        }) as Services['api']['detail'],
        save: async () => {
          throw new ApiError(409, 'Conflito');
        },
      },
    };
    editor(`/edit/sources/${ids.source}`, services);
    const user = userEvent.setup();
    const title = await ready();
    await user.clear(title);
    await user.type(title, 'Meu título');
    await user.click(saveButton());
    const group = await screen.findByRole('group', {
      name: 'Conflito de edição',
    });
    await user.click(
      within(group).getByRole('button', {
        name: 'Usar dados atuais e descartar rascunho',
      }),
    );
    expect(
      screen.queryByRole('group', { name: 'Conflito de edição' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue(
      'Título da outra sessão',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
