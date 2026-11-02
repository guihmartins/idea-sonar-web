import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import type { Node, ParallelSuggestions } from '../../src/api/domain';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { SuggestionsPage } from '../../src/pages/SuggestionsPage';

// Sugestões de paralelo: lista com os dois pontos e a pontuação, "Registrar
// paralelo" como link para o editor preenchido e "Dispensar" com motivo.
type Services = ReturnType<typeof createFixtureServices>;
async function setup(prepare: (services: Services) => void = () => {}) {
  const services = createFixtureServices();
  await services.session.login();
  const parallels = vi.spyOn(services.api, 'parallels');
  const dismiss = vi.spyOn(services.api, 'dismissParallel');
  prepare(services);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/sugestoes']}>
        <ServicesProvider services={services}>
          <SuggestionsPage />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { services, parallels, dismiss, user: userEvent.setup() };
}
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';
const emptyMessage =
  'Nenhuma sugestão agora. Elas aparecem quando há pontos com textos parecidos e sem relação entre si.';
const pairs = () => screen.queryAllByRole('article');
const dismissButton = () => screen.getByRole('button', { name: 'Dispensar' });
const unavailable = () =>
  new ApiError(503, 'Modelo fora do ar.', { code: 'SEMANTIC_UNAVAILABLE' });

const anyNode = (services: Services) =>
  services.api.node(ids.jung, new AbortController().signal);
function manyPairs(total: number, base: Node): ParallelSuggestions {
  return {
    model: 'm',
    items: Array.from({ length: total }, (_, index) => ({
      a: { ...base, id: `a-${index}`, label: `A${index}` },
      b: { ...base, id: `b-${index}`, label: `B${index}` },
      score: 0.99 - index / 1000,
    })),
  };
}

describe('Sugestões — a lista', () => {
  it('explica em duas frases o que são os pares e que semelhança não prova influência', async () => {
    await setup();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sugestões' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Pares de pontos cujos textos se parecem e que ainda não têm relação entre si. Semelhança não prova influência: um paralelo só vira relação se você o registrar, como inferência, com autoria e justificativa.',
      ),
    ).toBeVisible();
  });

  it('pede 20 pares com o limiar da API e mostra os dois pontos, a pontuação e a contagem', async () => {
    const { parallels } = await setup();
    await screen.findByRole('article');
    expect(parallels).toHaveBeenCalledTimes(1);
    expect(parallels).toHaveBeenCalledWith({ limit: 20 }, expect.anything());
    expect(pairs()).toHaveLength(1);
    const pair = within(pairs()[0]!);
    // Rótulo, tipo e descrição curta dos dois, cada um com link para o ponto.
    expect(pair.getByRole('link', { name: individuation })).toHaveAttribute(
      'href',
      `/edit/nodes/${ids.individuation}`,
    );
    expect(pair.getByRole('link', { name: coniunctio })).toHaveAttribute(
      'href',
      `/edit/nodes/${ids.coniunctio}`,
    );
    expect(pair.getAllByText('Conceito')).toHaveLength(2);
    expect(pair.getByText(/união de opostos como caminho/)).toBeVisible();
    expect(pair.getByText(/união de contrários como caminho/)).toBeVisible();
    expect(pair.getByText(/^semelhança 0,\d\d$/)).toBeVisible();
    expect(document.querySelector('.record-count')).toHaveTextContent(
      '1 par sugerido',
    );
    // Só as ações previstas, nenhuma delas primária.
    expect(
      within(pairs()[0]!)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Dispensar']);
    expect(document.querySelectorAll('.primary')).toHaveLength(0);
  });

  it('"Registrar paralelo" é um link para o editor com tipo, origem, destino e inferência', async () => {
    await setup();
    const link = await screen.findByRole('link', {
      name: 'Registrar paralelo',
    });
    expect(link).toHaveAttribute(
      'href',
      `/edit/relations?type=parallel_to&sourceId=${ids.individuation}&targetId=${ids.coniunctio}&evidenceStatus=inference`,
    );
    expect(link).toHaveClass('button');
  });

  it('sem sugestões: mostra o estado vazio e nenhuma ação', async () => {
    await setup((services) => {
      vi.spyOn(services.api, 'parallels').mockResolvedValue({
        model: 'm',
        items: [],
      });
    });
    expect(await screen.findByText(emptyMessage)).toBeVisible();
    expect(pairs()).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.record-count')).toHaveTextContent(
      '0 pares sugeridos',
    );
  });

  it('espera a resposta com "Carregando sugestões…"', async () => {
    let release!: (value: ParallelSuggestions) => void;
    await setup((services) => {
      vi.spyOn(services.api, 'parallels').mockImplementation(
        () =>
          new Promise<ParallelSuggestions>((resolve) => (release = resolve)),
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Carregando sugestões…',
    );
    expect(screen.queryByText(emptyMessage)).toBeNull();
    release({ model: 'm', items: [] });
    await screen.findByText(emptyMessage);
    expect(screen.queryByText('Carregando sugestões…')).toBeNull();
  });

  it('mostra no máximo 20 e "Mostrar mais" pede 50', async () => {
    const { user, parallels } = await setup((services) => {
      vi.spyOn(services.api, 'parallels').mockImplementation(async (filters) =>
        manyPairs(filters.limit === 50 ? 50 : 20, await anyNode(services)),
      );
    });
    await waitFor(() => expect(pairs()).toHaveLength(20));
    expect(document.querySelector('.record-count')).toHaveTextContent(
      '20 pares sugeridos',
    );
    await user.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    await waitFor(() => expect(pairs()).toHaveLength(50));
    expect(parallels).toHaveBeenLastCalledWith(
      { limit: 50 },
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });

  it('menos de 20 pares: sem "Mostrar mais"', async () => {
    await setup((services) => {
      vi.spyOn(services.api, 'parallels').mockImplementation(async () =>
        manyPairs(19, await anyNode(services)),
      );
    });
    await waitFor(() => expect(pairs()).toHaveLength(19));
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });
});

describe('Sugestões — busca por significado indisponível', () => {
  it('503 SEMANTIC_UNAVAILABLE: a nota quieta no lugar da lista, sem alerta nem nova tentativa', async () => {
    await setup((services) => {
      vi.spyOn(services.api, 'parallels').mockRejectedValue(unavailable());
    });
    expect(
      await screen.findByText(
        'Busca por significado indisponível: o modelo da API não está ativo.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
    expect(screen.queryByText(emptyMessage)).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sugestões' }),
    ).toBeVisible();
  });

  it('outro erro mostra o Failure e tenta de novo', async () => {
    const { user, parallels } = await setup((services) => {
      vi.spyOn(services.api, 'parallels')
        .mockRejectedValueOnce(
          new ApiError(500, 'Falha interna.', { code: 'INTERNAL' }),
        )
        .mockResolvedValue({ model: 'm', items: [] });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha interna.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText(emptyMessage);
    expect(parallels).toHaveBeenCalledTimes(2);
  });
});

describe('Sugestões — Dispensar', () => {
  it('pede o motivo, sem enviar nada antes de confirmar', async () => {
    const { user, dismiss } = await setup();
    await screen.findByRole('article');
    expect(dismissButton()).toHaveAttribute('aria-expanded', 'false');
    await user.click(dismissButton());
    expect(dismissButton()).toHaveAttribute('aria-expanded', 'true');
    const form = screen.getByRole('group', {
      name: `Dispensar ${individuation} e ${coniunctio}`,
    });
    const reason = within(form).getByRole('textbox', {
      name: 'Motivo para dispensar',
    });
    expect(reason).toBeRequired();
    expect(reason).toHaveAttribute('maxlength', '2000');
    expect(within(form).getByText(/O par deixa de ser sugerido/)).toBeVisible();
    expect(dismiss).not.toHaveBeenCalled();
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group')).toBeNull();
    expect(dismissButton()).toHaveAttribute('aria-expanded', 'false');
    expect(dismiss).not.toHaveBeenCalled();
    expect(pairs()).toHaveLength(1);
  });

  it('motivo só com espaços não é enviado', async () => {
    const { user, dismiss } = await setup();
    await screen.findByRole('article');
    await user.click(dismissButton());
    const form = screen.getByRole('group');
    await user.type(within(form).getByRole('textbox'), '   ');
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Informe o motivo para dispensar o par.',
    );
    expect(dismiss).not.toHaveBeenCalled();
    expect(pairs()).toHaveLength(1);
  });

  it('envia a, b e o motivo sem espaços nas pontas, tira o par da lista e anuncia o resultado', async () => {
    const { user, dismiss, parallels } = await setup();
    await screen.findByRole('article');
    await user.click(dismissButton());
    const form = screen.getByRole('group');
    await user.type(
      within(form).getByRole('textbox', { name: 'Motivo para dispensar' }),
      '  Só parecem iguais pelo vocabulário.  ',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    await waitFor(() => expect(pairs()).toHaveLength(0));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith(
      ids.individuation,
      ids.coniunctio,
      'Só parecem iguais pelo vocabulário.',
    );
    // A lista foi relida depois da dispensa, e o estado vazio aparece.
    expect(parallels.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByText(emptyMessage)).toBeVisible();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(
      `Par dispensado: “${individuation}” e “${coniunctio}” não serão sugeridos de novo.`,
    );
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.querySelector('.record-count')).toHaveTextContent(
      '0 pares sugeridos',
    );
  });

  it('só o par dispensado some; os outros ficam', async () => {
    const { user, dismiss } = await setup((services) => {
      const dismissed = new Set<string>();
      vi.spyOn(services.api, 'parallels').mockImplementation(async () => ({
        model: 'm',
        items: manyPairs(2, await anyNode(services)).items.filter(
          (item) => !dismissed.has(item.a.id),
        ),
      }));
      vi.spyOn(services.api, 'dismissParallel').mockImplementation(
        async (a, b, reason) => {
          dismissed.add(a);
          return {
            id: 'd',
            a,
            b,
            kind: 'parallel',
            reason,
            createdAt: '2026-11-01T00:00:00.000Z',
          };
        },
      );
    });
    await waitFor(() => expect(pairs()).toHaveLength(2));
    const first = within(pairs()[0]!);
    await user.click(first.getByRole('button', { name: 'Dispensar' }));
    await user.type(first.getByRole('textbox'), 'Não.');
    await user.click(first.getByRole('button', { name: 'Dispensar par' }));
    await waitFor(() => expect(pairs()).toHaveLength(1));
    expect(within(pairs()[0]!).getByRole('link', { name: 'B1' })).toBeVisible();
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledWith('a-0', 'b-0', 'Não.');
  });

  it('falha ao dispensar: mostra o erro, mantém o motivo e o par, e deixa tentar de novo', async () => {
    const { user, dismiss } = await setup((services) => {
      vi.spyOn(services.api, 'dismissParallel')
        .mockRejectedValueOnce(
          new ApiError(500, 'Falha interna.', { code: 'INTERNAL' }),
        )
        .mockResolvedValue({
          id: 'd',
          a: ids.individuation,
          b: ids.coniunctio,
          kind: 'parallel',
          reason: 'x',
          createdAt: '2026-11-01T00:00:00.000Z',
        });
    });
    await screen.findByRole('article');
    await user.click(dismissButton());
    const form = screen.getByRole('group');
    await user.type(within(form).getByRole('textbox'), 'Meu motivo');
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Falha interna.',
    );
    expect(within(form).getByRole('textbox')).toHaveValue('Meu motivo');
    expect(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    ).toBeEnabled();
    expect(pairs()).toHaveLength(1);
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    await waitFor(() => expect(screen.queryByRole('group')).toBeNull());
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it('enquanto envia, os botões do formulário ficam desligados', async () => {
    let release!: () => void;
    const { user } = await setup((services) => {
      vi.spyOn(services.api, 'dismissParallel').mockImplementation(
        () =>
          new Promise((resolve) => {
            release = () =>
              resolve({
                id: 'd',
                a: ids.individuation,
                b: ids.coniunctio,
                kind: 'parallel',
                reason: 'x',
                createdAt: '2026-11-01T00:00:00.000Z',
              });
          }),
      );
    });
    await screen.findByRole('article');
    await user.click(dismissButton());
    const form = screen.getByRole('group');
    await user.type(within(form).getByRole('textbox'), 'Motivo');
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    await waitFor(() =>
      expect(
        within(form).getByRole('button', { name: 'Dispensar par' }),
      ).toBeDisabled(),
    );
    expect(
      within(form).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
    release();
    await waitFor(() => expect(screen.queryByRole('group')).toBeNull());
  });

  it('com o modelo fora do ar, o 503 do POST também vira a nota', async () => {
    const { user } = await setup((services) => {
      vi.spyOn(services.api, 'dismissParallel').mockRejectedValue(
        unavailable(),
      );
    });
    await screen.findByRole('article');
    await user.click(dismissButton());
    const form = screen.getByRole('group');
    await user.type(within(form).getByRole('textbox'), 'Motivo');
    await user.click(
      within(form).getByRole('button', { name: 'Dispensar par' }),
    );
    expect(
      await within(form).findByText(/modelo da API não está ativo/),
    ).toBeVisible();
    expect(within(form).queryByRole('alert')).toBeNull();
  });
});
