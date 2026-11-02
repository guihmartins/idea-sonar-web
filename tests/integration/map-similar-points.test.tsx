import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import type { SemanticResults } from '../../src/api/domain';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { formatScore } from '../../src/components/semantic';
import { createFixtureServices } from '../../src/dev/fixtures';
import { MapPage } from '../../src/pages/MapPage';

// "Pontos parecidos" no painel do ponto: GET /nodes/{id}/similar?limit=5 ao abrir,
// linhas com nome, tipo e pontuação, e o mesmo gesto da busca do mapa ao ativar.
type Services = ReturnType<typeof createFixtureServices>;
async function openMap(
  prepare: (services: Services, real: Services['api']) => void = () => {},
) {
  const services = createFixtureServices();
  await services.session.login();
  const real = { ...services.api };
  const similar = vi.spyOn(services.api, 'similarNodes');
  prepare(services, real);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/map']}>
        <ServicesProvider services={services}>
          <MapPage />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { services, similar, user: userEvent.setup() };
}
const panel = () => document.getElementById('panel-content') as HTMLElement;
async function pick(
  user: ReturnType<typeof userEvent.setup>,
  term: string,
  title: RegExp,
) {
  // Modo lista evita montar o Cytoscape real (sem canvas 2D em jsdom).
  await user.click(await screen.findByRole('button', { name: 'Modo lista' }));
  await user.type(screen.getByLabelText('Buscar ponto'), term);
  await user.click(screen.getByRole('button', { name: 'Buscar' }));
  await user.click(await screen.findByRole('button', { name: title }));
}
const section = () =>
  within(panel()).getByRole('heading', { level: 3, name: 'Pontos parecidos' })
    .parentElement as HTMLElement;
const rows = () =>
  within(
    within(panel()).getByRole('list', { name: 'Pontos parecidos com este' }),
  ).getAllByRole('listitem');
const unavailable = () =>
  new ApiError(503, 'Modelo fora do ar.', { code: 'SEMANTIC_UNAVAILABLE' });
// Os nomes têm parênteses: viram texto literal no padrão.
const named = (label: string) =>
  new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const kindName = {
  concept: 'Conceito',
  person: 'Pessoa',
  tradition: 'Tradição',
  work: 'Obra',
  figure: 'Figura',
};
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';

describe('painel do ponto — Pontos parecidos', () => {
  it('pede 5 parecidos ao abrir o painel e lista nome, tipo e pontuação, melhor primeiro', async () => {
    const { user, similar, services } = await openMap();
    await pick(user, 'Individua', /Individuação/);
    await screen.findByRole('heading', { level: 2, name: individuation });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(similar).toHaveBeenCalledTimes(1);
    expect(similar).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000030',
      5,
      expect.anything(),
    );
    const expected = await services.api.similarNodes(
      '00000000-0000-4000-8000-000000000030',
      5,
      new AbortController().signal,
    );
    expect(rows()).toHaveLength(5);
    expect(rows()[0]).toHaveTextContent(`${coniunctio} Conceito semelhança 0,`);
    expect(
      rows().map((row) => within(row).getByRole('button').textContent),
    ).toEqual(
      expected.items.map(
        ({ node, score }) =>
          `${node.label} ${kindName[node.kind]} semelhança ${formatScore(score)}`,
      ),
    );
    // O próprio ponto nunca aparece.
    expect(
      within(section()).queryByRole('button', {
        name: named(individuation),
      }),
    ).toBeNull();
    expect(
      within(section()).getByText(
        'Pistas pelo sentido do texto; não indicam relação.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Nenhum ponto parecido.')).toBeNull();
    expect(screen.queryByText('Procurando pontos parecidos…')).toBeNull();
  });

  it('cada ponto tem a sua consulta: o painel do novo ponto não mostra a lista do anterior', async () => {
    const { user } = await openMap((services, real) => {
      vi.spyOn(services.api, 'similarNodes').mockImplementation(
        (id, ...rest) =>
          id === '00000000-0000-4000-8000-000000000031'
            ? new Promise<SemanticResults>(() => {})
            : real.similarNodes(id, ...rest),
      );
    });
    await pick(user, 'Individua', /Individuação/);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(rows()[0]!).getByRole('button'));
    await screen.findByRole('heading', { level: 2, name: coniunctio });
    expect(
      await screen.findByText('Procurando pontos parecidos…'),
    ).toBeVisible();
    expect(
      within(panel()).queryByRole('list', {
        name: 'Pontos parecidos com este',
      }),
    ).toBeNull();
  });

  it('a seção vem depois das relações e antes dos links do ponto', async () => {
    const { user } = await openMap();
    await pick(user, 'Individua', /Individuação/);
    await screen.findByRole('heading', { level: 3, name: 'Pontos parecidos' });
    const headings = within(panel())
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(['Relações', 'Pontos parecidos']);
    const all = Array.from(panel().querySelectorAll('h3, .links'));
    expect(all.map((el) => el.textContent?.slice(0, 11))).toEqual([
      'Relações',
      'Pontos pare',
      'Editar pont',
    ]);
  });

  it('ativar uma linha traz o ponto para o mapa como a busca do mapa faz', async () => {
    const { user, similar } = await openMap();
    await pick(user, 'Individua', /Individuação/);
    await screen.findByRole('heading', { level: 2, name: individuation });
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(
      within(rows()[0]!).getByRole('button', { name: named(coniunctio) }),
    );
    // O ponto vira a raiz: painel, título do mapa e lista passam a ser dele.
    await screen.findByRole('heading', { level: 2, name: coniunctio });
    expect(
      screen.queryByRole('heading', { level: 2, name: individuation }),
    ).toBeNull();
    const list = document.querySelector('.graph-list') as HTMLElement;
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([coniunctio]);
    expect(screen.getByLabelText('Buscar ponto')).toHaveValue('');
    // Os parecidos do novo ponto são pedidos pelo id dele.
    await waitFor(() =>
      expect(similar).toHaveBeenLastCalledWith(
        '00000000-0000-4000-8000-000000000031',
        5,
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(
        within(rows()[0]!).getByRole('button', {
          name: named(individuation),
        }),
      ).toBeVisible(),
    );
  });

  it('carregando, mostra a espera; vazio, diz que não há parecidos', async () => {
    let release!: (value: SemanticResults) => void;
    const { user } = await openMap((services) => {
      vi.spyOn(services.api, 'similarNodes').mockImplementation(
        () => new Promise<SemanticResults>((resolve) => (release = resolve)),
      );
    });
    await pick(user, 'Jung', /Jung/);
    expect(
      await screen.findByText('Procurando pontos parecidos…'),
    ).toBeVisible();
    release({ model: 'm', items: [] });
    expect(await screen.findByText('Nenhum ponto parecido.')).toBeVisible();
    expect(screen.queryByText('Procurando pontos parecidos…')).toBeNull();
    expect(
      screen.queryByText('Pistas pelo sentido do texto; não indicam relação.'),
    ).toBeNull();
    expect(
      screen.queryByRole('list', { name: 'Pontos parecidos com este' }),
    ).toBeNull();
  });

  it('503 SEMANTIC_UNAVAILABLE: nota quieta, sem alerta e sem nova tentativa', async () => {
    const { user, similar } = await openMap((services) => {
      vi.spyOn(services.api, 'similarNodes').mockRejectedValue(unavailable());
    });
    await pick(user, 'Jung', /Jung/);
    const note = await within(panel()).findByText(
      'Busca por significado indisponível: o modelo da API não está ativo.',
    );
    expect(note).toBeVisible();
    expect(within(panel()).queryByRole('alert')).toBeNull();
    expect(
      within(section()).queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
    expect(similar).toHaveBeenCalledTimes(1);
    // O resto do painel segue inteiro.
    expect(
      within(panel()).getByRole('link', { name: 'Editar ponto' }),
    ).toBeVisible();
  });

  it('outro erro mostra o Failure com nova tentativa', async () => {
    const { user } = await openMap((services) => {
      vi.spyOn(services.api, 'similarNodes')
        .mockRejectedValueOnce(
          new ApiError(500, 'Falha interna.', { code: 'INTERNAL' }),
        )
        .mockResolvedValue({ model: 'm', items: [] });
    });
    await pick(user, 'Jung', /Jung/);
    expect(await within(panel()).findByRole('alert')).toHaveTextContent(
      'Falha interna.',
    );
    await user.click(
      within(panel()).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(await screen.findByText('Nenhum ponto parecido.')).toBeVisible();
    expect(within(panel()).queryByRole('alert')).toBeNull();
  });
});
