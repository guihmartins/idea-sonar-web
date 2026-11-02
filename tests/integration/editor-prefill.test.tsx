import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';

// Editor de relação aberto por link: `type`, `sourceId`, `targetId` e
// `evidenceStatus` pré-preenchem só a relação nova, valor inválido é ignorado e
// nada é salvo sozinho.
async function openApp(path: string) {
  const services = createFixtureServices();
  await services.session.login();
  const save = vi.spyOn(services.api, 'save');
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <App />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { services, save, user: userEvent.setup() };
}
const source = () => screen.getByRole('group', { name: 'Ponto de origem' });
const target = () => screen.getByRole('group', { name: 'Ponto de destino' });
const predicate = () => screen.getByRole('combobox', { name: 'Predicado' });
const status = () =>
  screen.getByRole('combobox', { name: 'Classificação da evidência' });
const query = (values: Record<string, string>) =>
  `/edit/relations?${new URLSearchParams(values)}`;
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';

describe('editor de relação — pré-preenchimento pela URL', () => {
  it('preenche tipo, origem, destino e inferência, sem salvar nem preencher o resto', async () => {
    const { save } = await openApp(
      query({
        type: 'parallel_to',
        sourceId: ids.individuation,
        targetId: ids.coniunctio,
        evidenceStatus: 'inference',
      }),
    );
    await screen.findByRole('group', { name: 'Ponto de origem' });
    await waitFor(() =>
      expect(
        within(source()).getByText(`Selecionado: ${individuation}`),
      ).toBeVisible(),
    );
    expect(
      await within(target()).findByText(`Selecionado: ${coniunctio}`),
    ).toBeVisible();
    await waitFor(() => expect(predicate()).toHaveValue('parallel_to'));
    expect(status()).toHaveValue('inference');
    // O usuário ainda escreve afirmação, autoria e justificativa.
    expect(screen.getByRole('textbox', { name: 'Afirmação' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Justificativa' })).toHaveValue(
      '',
    );
    expect(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
    ).toHaveValue('');
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cadastrar relação' }),
    ).toBeVisible();
  });

  it('valores inválidos são ignorados, um a um, sem erro na tela', async () => {
    const { save } = await openApp(
      query({
        type: 'predicado_inexistente',
        sourceId: 'não-é-uuid',
        targetId: ids.coniunctio,
        evidenceStatus: 'certeza',
      }),
    );
    await screen.findByRole('group', { name: 'Ponto de origem' });
    expect(
      await within(target()).findByText(`Selecionado: ${coniunctio}`),
    ).toBeVisible();
    expect(within(source()).queryByText(/Selecionado:/)).toBeNull();
    expect(predicate()).toHaveValue('');
    // O padrão da relação nova segue valendo.
    expect(status()).toHaveValue('inference');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('a classificação da URL vale quando é conhecida', async () => {
    await openApp(query({ evidenceStatus: 'documented' }));
    await screen.findByRole('group', { name: 'Ponto de origem' });
    expect(status()).toHaveValue('documented');
    expect(
      screen.queryByRole('textbox', { name: 'Autoria da inferência' }),
    ).toBeNull();
  });

  it('destino igual à origem é ignorado', async () => {
    await openApp(
      query({ sourceId: ids.jung, targetId: ids.jung.toUpperCase() }),
    );
    await screen.findByRole('group', { name: 'Ponto de origem' });
    expect(
      await within(source()).findByText('Selecionado: Jung (exemplo fictício)'),
    ).toBeVisible();
    expect(within(target()).queryByText(/Selecionado:/)).toBeNull();
  });

  it('só vale para relação nova: editar uma relação existente ignora a URL', async () => {
    await openApp(
      `/edit/relations/${ids.relation}?${new URLSearchParams({
        type: 'parallel_to',
        sourceId: ids.individuation,
        targetId: ids.coniunctio,
        evidenceStatus: 'documented',
      })}`,
    );
    await screen.findByRole('heading', { level: 1, name: 'Editar relação' });
    expect(
      await within(source()).findByText('Selecionado: Jung (exemplo fictício)'),
    ).toBeVisible();
    expect(
      await within(target()).findByText(
        'Selecionado: Gnosticismo (exemplo fictício)',
      ),
    ).toBeVisible();
    await waitFor(() => expect(predicate()).toHaveValue('studied'));
    expect(status()).toHaveValue('attributed_interpretation');
  });

  it('outros tipos de cadastro ignoram os parâmetros', async () => {
    await openApp(
      `/edit/nodes?${new URLSearchParams({
        type: 'parallel_to',
        sourceId: ids.individuation,
        evidenceStatus: 'documented',
      })}`,
    );
    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue(
      '',
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue(
        'person',
      ),
    );
    expect(screen.queryByText(/Selecionado:/)).toBeNull();
  });

  it('sem parâmetros, a relação nova abre como sempre', async () => {
    await openApp('/edit/relations');
    await screen.findByRole('group', { name: 'Ponto de origem' });
    expect(within(source()).queryByText(/Selecionado:/)).toBeNull();
    expect(predicate()).toHaveValue('');
  });
});

describe('Sugestões → Registrar paralelo → salvar', () => {
  it('abre o editor preenchido; ao salvar, o par some da lista de sugestões', async () => {
    const { user, save } = await openApp('/sugestoes');
    await user.click(
      await screen.findByRole('link', { name: 'Registrar paralelo' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Cadastrar relação' });
    await waitFor(() => expect(predicate()).toHaveValue('parallel_to'));
    expect(
      await within(source()).findByText(`Selecionado: ${individuation}`),
    ).toBeVisible();
    expect(
      await within(target()).findByText(`Selecionado: ${coniunctio}`),
    ).toBeVisible();
    expect(save).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole('textbox', { name: 'Afirmação' }),
      'As duas descrevem a união de contrários.',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
      'Curadoria',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa' }),
      'Leitura comparada dos dois textos.',
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Salvar registro' }),
      ).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      'relations',
      expect.objectContaining({
        type: 'parallel_to',
        sourceId: ids.individuation,
        targetId: ids.coniunctio,
        claim: 'As duas descrevem a união de contrários.',
        justification: 'Leitura comparada dos dois textos.',
        evidenceStatus: 'inference',
        inferenceAuthor: 'Curadoria',
      }),
      expect.any(String),
      undefined,
    );

    // De volta às sugestões, o par já tem relação e não aparece mais.
    await user.click(screen.getByRole('link', { name: 'Sugestões' }));
    expect(await screen.findByText(/Nenhuma sugestão agora\./)).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
  });
});
