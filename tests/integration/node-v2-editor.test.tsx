import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import type { Node } from '../../src/api/domain';

type Services = ReturnType<typeof createFixtureServices>;

function renderEditor(path: string, services: Services) {
  void services.session.login();
  render(
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
const save = () => screen.getByRole('button', { name: 'Salvar registro' });
async function ready(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(save()).not.toBeDisabled());
  return user;
}
async function fillBasics(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.type(await screen.findByRole('textbox', { name: 'Nome' }), label);
  await user.type(
    screen.getByRole('textbox', { name: 'Descrição' }),
    'Registro sintético do E2E.',
  );
}
const identifiers = () =>
  screen.getByRole('group', { name: 'Identificadores' });

describe('ponto — período, identificadores e figura', () => {
  it('Figura é um tipo do catálogo e não pede escopo de conceito', async () => {
    const services = createFixtureServices();
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await fillBasics(user, 'Hermes fictício');
    await screen.findByRole('option', { name: 'Figura' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'figure',
    );
    expect(
      screen.queryByRole('combobox', { name: 'Escopo do conceito' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    await ready(user);
    await user.click(save());
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(saveEntity).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({
        kind: 'figure',
        conceptScope: null,
        startYear: null,
        endYear: null,
        precision: 'unknown',
        periodLabel: null,
        identifiers: [],
      }),
      expect.any(String),
      undefined,
    );
  });

  it('grava o período com a.C. convertido, precisão e rótulo', async () => {
    const services = createFixtureServices();
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await fillBasics(user, 'Pessoa antiga fictícia');
    await user.type(
      screen.getByRole('textbox', { name: 'Rótulo do período' }),
      'séc. V a.C.',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '500',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do início' }),
      'bce',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '400',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do fim' }),
      'bce',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Precisão do período' }),
      'approximate',
    );
    await ready(user);
    await user.click(save());
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(saveEntity).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({
        startYear: -499,
        endYear: -399,
        precision: 'approximate',
        periodLabel: 'séc. V a.C.',
      }),
      expect.any(String),
      undefined,
    );
  });

  it('recusa período fora dos limites ou invertido antes de enviar', async () => {
    const services = createFixtureServices();
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await fillBasics(user, 'Pessoa fora do prazo');
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '3001',
    );
    await ready(user);
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ano fora do intervalo aceito: de 100001 a.C. a 3000 d.C.',
    );
    await user.clear(screen.getByRole('spinbutton', { name: 'Ano inicial' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '50',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '10',
    );
    await user.click(save());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'O fim do período deve ser posterior ao início.',
      ),
    );
    expect(saveEntity).not.toHaveBeenCalled();
  });

  it('o contexto também recusa ano acima de 3000 d.C.', async () => {
    const services = createFixtureServices();
    renderEditor('/edit/contexts', services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Contexto distante',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '3500',
    );
    await ready(user);
    await user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ano fora do intervalo aceito',
    );
  });

  it('edita identificadores: esquemas do catálogo, adicionar, remover e forma normalizada após salvar', async () => {
    const services = createFixtureServices();
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await fillBasics(user, 'Pessoa com identificadores');
    const group = identifiers();
    expect(within(group).queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Adicionar identificador' }),
      ).toBeEnabled(),
    );
    await user.click(
      within(group).getByRole('button', { name: 'Adicionar identificador' }),
    );
    const schemes = within(group).getByRole('combobox', { name: 'Esquema 1' });
    expect(
      within(schemes)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Wikidata', 'VIAF', 'ISNI', 'ISBN', 'DOI', 'Open Library']);
    await user.type(
      within(group).getByRole('textbox', { name: 'Valor 1' }),
      'https://www.wikidata.org/wiki/q1000002',
    );
    await user.click(
      within(group).getByRole('button', { name: 'Adicionar identificador' }),
    );
    await user.selectOptions(
      within(group).getByRole('combobox', { name: 'Esquema 2' }),
      'doi',
    );
    await user.type(
      within(group).getByRole('textbox', { name: 'Valor 2' }),
      '10.1000/abc',
    );
    await user.click(
      within(group).getByRole('button', { name: 'Adicionar identificador' }),
    );
    expect(
      within(group).getByRole('textbox', { name: 'Valor 3' }),
    ).toBeInTheDocument();
    await user.click(
      within(group).getByRole('button', { name: 'Remover identificador 3' }),
    );
    expect(
      within(group).queryByRole('textbox', { name: 'Valor 3' }),
    ).not.toBeInTheDocument();
    await ready(user);
    await user.click(save());
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(saveEntity).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({
        identifiers: [
          {
            scheme: 'wikidata',
            value: 'https://www.wikidata.org/wiki/q1000002',
          },
          { scheme: 'doi', value: '10.1000/abc' },
        ],
      }),
      expect.any(String),
      undefined,
    );
    // A API guarda a forma normalizada e devolve ordenada por esquema (DOI antes
    // de Wikidata); o formulário passa a mostrar exatamente isso.
    const saved = identifiers();
    expect(
      within(saved).getByRole('combobox', { name: 'Esquema 1' }),
    ).toHaveValue('doi');
    expect(within(saved).getByRole('textbox', { name: 'Valor 1' })).toHaveValue(
      '10.1000/abc',
    );
    expect(
      within(saved).getByRole('combobox', { name: 'Esquema 2' }),
    ).toHaveValue('wikidata');
    expect(within(saved).getByRole('textbox', { name: 'Valor 2' })).toHaveValue(
      'Q1000002',
    );
  });

  it('mostra o erro da API na linha do identificador, mesmo com linha em branco antes', async () => {
    const services = createFixtureServices();
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await fillBasics(user, 'Pessoa com identificador ruim');
    const group = identifiers();
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Adicionar identificador' }),
      ).toBeEnabled(),
    );
    const add = () =>
      user.click(
        within(group).getByRole('button', { name: 'Adicionar identificador' }),
      );
    await add();
    await add();
    await user.type(
      within(group).getByRole('textbox', { name: 'Valor 2' }),
      'abc',
    );
    await ready(user);
    await user.click(save());
    const row = await within(group).findByText(
      'Identificador inválido para wikidata',
    );
    expect(row).toBeInTheDocument();
    expect(
      within(group).getByRole('textbox', { name: 'Valor 2' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      within(group).getByRole('textbox', { name: 'Valor 1' }),
    ).not.toHaveAttribute('aria-invalid');
    expect(
      within(group).getByRole('textbox', { name: 'Valor 2' }),
    ).toHaveAccessibleDescription('Identificador inválido para wikidata');
    // A lista de campos da API também aparece no alerta geral.
    expect(screen.getByRole('alert')).toHaveTextContent('identifiers.0.value');
  });

  it('identificador de outro ponto: 409 DUPLICATE na mensagem geral, sem comparação de versão', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const key = () => crypto.randomUUID();
    const base = {
      kind: 'person',
      description: 'Registro sintético.',
      conceptScope: null,
      aliases: [],
      contexts: [],
      status: 'active',
    };
    await services.api.save(
      'nodes',
      {
        ...base,
        label: 'Dono do identificador',
        identifiers: [{ scheme: 'viaf', value: '123456' }],
      },
      key(),
    );
    const other = (await services.api.save(
      'nodes',
      { ...base, label: 'Outro ponto', identifiers: [] },
      key(),
    )) as Node;
    renderEditor(`/edit/nodes/${other.id}`, services);
    const user = userEvent.setup();
    const group = await screen.findByRole('group', { name: 'Identificadores' });
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Adicionar identificador' }),
      ).toBeEnabled(),
    );
    await user.click(
      within(group).getByRole('button', { name: 'Adicionar identificador' }),
    );
    await user.selectOptions(
      within(group).getByRole('combobox', { name: 'Esquema 1' }),
      'viaf',
    );
    await user.type(
      within(group).getByRole('textbox', { name: 'Valor 1' }),
      'https://viaf.org/viaf/123456/',
    );
    await ready(user);
    await user.click(save());
    expect(
      await within(group).findByText(
        'Identificador já cadastrado em outro ponto',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Conflito de edição' }),
    ).not.toBeInTheDocument();
  });

  it('mostra período e identificadores de um ponto existente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const saved = (await services.api.save(
      'nodes',
      {
        kind: 'figure',
        label: 'Figura datada',
        description: 'Figura com período.',
        conceptScope: null,
        startYear: -99,
        endYear: 10,
        precision: 'range',
        periodLabel: 'virada da era',
        aliases: [],
        identifiers: [{ scheme: 'wikidata', value: 'Q1000004' }],
        contexts: [],
        status: 'active',
      },
      crypto.randomUUID(),
    )) as Node;
    renderEditor(`/edit/nodes/${saved.id}`, services);
    expect(
      await screen.findByRole('spinbutton', { name: 'Ano inicial' }),
    ).toHaveValue(100);
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'bce',
    );
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      10,
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'ce',
    );
    expect(
      screen.getByRole('combobox', { name: 'Precisão do período' }),
    ).toHaveValue('range');
    expect(
      screen.getByRole('textbox', { name: 'Rótulo do período' }),
    ).toHaveValue('virada da era');
    expect(
      within(identifiers()).getByRole('textbox', { name: 'Valor 1' }),
    ).toHaveValue('Q1000004');
  });
});
