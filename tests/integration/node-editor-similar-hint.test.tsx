import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import {
  hintDelay,
  hintLimit,
  hintQuery,
  hintTitle,
} from '../../src/pages/editor/SimilarHint';

// "Confira antes de criar": no cadastro de ponto novo, com nome e descrição, um
// semanticSearch com atraso de 600 ms mostra pontos que já existem e leem
// parecido. É dica: não bloqueia o salvar e some se a busca não estiver no ar.
type Services = ReturnType<typeof createFixtureServices>;
// Relógio falso que também anda com o tempo real (a API fictícia e o React
// Query usam timers). As esperas têm folga de ±150 ms em volta dos 600 ms.
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());
const sleep = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const settled = { timeout: 3000 };

async function open(
  path: string,
  prepare: (services: Services, real: Services['api']) => void = () => {},
) {
  const services = createFixtureServices();
  await services.session.login();
  const real = { ...services.api };
  const semantic = vi.spyOn(services.api, 'semanticSearch');
  const save = vi.spyOn(services.api, 'save');
  prepare(services, real);
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
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    delay: null,
  });
  return { services, semantic, save, user };
}
const name = () => screen.getByRole('textbox', { name: 'Nome' });
const description = () => screen.getByRole('textbox', { name: 'Descrição' });
const title = () =>
  screen.queryByRole('heading', {
    name: 'Confira antes de criar: pontos com sentido parecido',
  });
const unavailable = () =>
  new ApiError(503, 'Modelo fora do ar.', { code: 'SEMANTIC_UNAVAILABLE' });
const text = 'Texto sintético sobre a união de opostos.';

describe('ponto novo — Confira antes de criar', () => {
  it('só consulta com nome e descrição, 600 ms depois da última tecla, com o texto "nome · descrição"', async () => {
    const { user, semantic } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await sleep(hintDelay * 3);
    expect(semantic).not.toHaveBeenCalled();
    await user.type(description(), text);
    await sleep(hintDelay - 150);
    expect(semantic).not.toHaveBeenCalled();
    await sleep(300);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    expect(semantic).toHaveBeenCalledWith(
      `União · ${text}`,
      { includePending: true, limit: hintLimit },
      expect.anything(),
    );
    expect(hintDelay).toBe(600);
    expect(hintLimit).toBe(3);
  });

  it('cada tecla reinicia a espera: uma consulta só, com o texto final', async () => {
    const { user, semantic } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), 'Texto');
    await sleep(400);
    await user.type(description(), ' final');
    await sleep(400);
    expect(semantic).not.toHaveBeenCalled();
    await sleep(300);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    expect(semantic).toHaveBeenCalledWith(
      'União · Texto final',
      expect.anything(),
      expect.anything(),
    );
  });

  it('só com espaços não consulta', async () => {
    const { user, semantic } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      '   ',
    );
    await user.type(description(), '   ');
    await sleep(hintDelay + 300);
    expect(semantic).not.toHaveBeenCalled();
    expect(title()).toBeNull();
  });

  it('mostra até 3 pontos com link para o editor de cada um, tipo e semelhança', async () => {
    const { user } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    expect(
      await screen.findByRole('heading', { name: hintTitle }, settled),
    ).toBeVisible();
    const region = (title() as HTMLElement).parentElement as HTMLElement;
    expect(region).toHaveAttribute('aria-live', 'polite');
    const rows = within(region).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // Nome, tipo e semelhança separados por espaço (nome acessível e texto).
    expect(rows[0]).toHaveTextContent(
      /^Individuação \(exemplo fictício\) Conceito semelhança 0,\d\d$/,
    );
    for (const row of rows) {
      expect(within(row).getByText(/^semelhança 0,\d\d$/)).toBeVisible();
      const link = within(row).getByRole('link');
      expect(link.getAttribute('href')).toMatch(
        /^\/edit\/nodes\/[0-9a-f-]{36}$/,
      );
      // Mesma aba: nada de target nem de nova janela.
      expect(link).not.toHaveAttribute('target');
    }
    expect(
      within(rows[0]!).getByRole('link', {
        name: 'Individuação (exemplo fictício)',
      }),
    ).toHaveAttribute('href', `/edit/nodes/${ids.individuation}`);
    expect(within(rows[0]!).getByText('Conceito')).toBeVisible();
    expect(
      within(region).getByText(
        'Pistas pelo sentido do texto; semelhança não é identidade. Salvar continua como está.',
      ),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/%|confiança/);
  });

  it('apagar o nome ou a descrição esconde a dica na hora', async () => {
    const { user } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await screen.findByRole('heading', { name: hintTitle }, settled);
    await user.clear(name());
    expect(title()).toBeNull();
    await user.type(name(), 'União');
    expect(
      await screen.findByRole('heading', { name: hintTitle }),
    ).toBeVisible();
    await user.clear(description());
    expect(title()).toBeNull();
  });

  it('não bloqueia: com a dica na tela, salvar segue como sempre', async () => {
    const { user, save } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await screen.findByRole('heading', { name: hintTitle }, settled);
    const button = screen.getByRole('button', { name: 'Salvar registro' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({ label: 'União', description: text }),
      expect.any(String),
      undefined,
    );
  });

  it('nenhum parecido: nada aparece', async () => {
    const { user, semantic } = await open('/edit/nodes', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockResolvedValue({
        model: 'm',
        items: [],
      });
    });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    await sleep(200);
    expect(title()).toBeNull();
  });
});

describe('Confira antes de criar — quando não vale', () => {
  it('editar um ponto que já existe não consulta nem mostra a dica', async () => {
    const { semantic } = await open(`/edit/nodes/${ids.jung}`);
    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue(
      'Jung (exemplo fictício)',
    );
    await sleep(hintDelay + 300);
    expect(semantic).not.toHaveBeenCalled();
    expect(title()).toBeNull();
    expect(document.querySelector('.similar-hint')).toBeNull();
  });

  it.each(['sources', 'contexts', 'relations'])(
    'só pontos têm a dica: %s não consulta',
    async (type) => {
      const { semantic } = await open(`/edit/${type}`);
      await screen.findByRole('button', { name: 'Salvar registro' });
      await sleep(hintDelay + 300);
      expect(semantic).not.toHaveBeenCalled();
      expect(document.querySelector('.similar-hint')).toBeNull();
    },
  );

  it('503 SEMANTIC_UNAVAILABLE: a dica some e o editor não mostra erro nem nota', async () => {
    const { user, semantic } = await open('/edit/nodes', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockRejectedValue(unavailable());
    });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    await sleep(300);
    expect(title()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/modelo da API não está ativo/)).toBeNull();
    // O salvar continua intacto.
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Salvar registro' }),
      ).toBeEnabled(),
    );
  });

  it('qualquer outra falha da dica também fica fora do editor', async () => {
    const { user, semantic } = await open('/edit/nodes', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockRejectedValue(
        new ApiError(500, 'Falha interna.', { code: 'INTERNAL' }),
      );
    });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    await sleep(300);
    expect(title()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Falha interna.')).toBeNull();
  });
});

describe('a dica depende do texto', () => {
  it('outro texto não mostra a resposta do anterior enquanto a nova não chega', async () => {
    const { user, semantic } = await open('/edit/nodes', (services, real) => {
      vi.spyOn(services.api, 'semanticSearch').mockImplementation((...args) =>
        args[0].endsWith('mais')
          ? new Promise<never>(() => {})
          : real.semanticSearch(...args),
      );
    });
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    expect(
      await screen.findByRole('heading', { name: hintTitle }, settled),
    ).toBeVisible();
    await user.type(description(), ' mais');
    await sleep(hintDelay + 300);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(2), settled);
    expect(title()).toBeNull();
  });
});

describe('hintQuery', () => {
  it('une nome e descrição aparados e corta em 500 caracteres', () => {
    expect(hintQuery('  União ', ' texto  ')).toBe('União · texto');
    expect(hintQuery('União', '')).toBe('');
    expect(hintQuery('', 'texto')).toBe('');
    expect(hintQuery('   ', 'texto')).toBe('');
    expect(hintQuery('União', '   ')).toBe('');
    expect(hintQuery('a', 'b'.repeat(900))).toHaveLength(500);
    expect(hintQuery('a', 'b'.repeat(900)).startsWith('a · b')).toBe(true);
    expect(hintQuery('a', 'b'.repeat(495))).toHaveLength(499);
    expect(hintQuery('a', 'b'.repeat(496))).toHaveLength(500);
  });
});
