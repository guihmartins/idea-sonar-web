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
  hintLeadText,
  hintLimit,
  hintQuery,
  hintTitle,
} from '../../src/pages/editor/SimilarHint';

// "Parecido com pontos já cadastrados": no cadastro de ponto novo, com nome e
// descrição, uma busca `mode=duplicates` 600 ms depois da última tecla mostra os
// pontos que passam do limiar de duplicata. É aviso: não bloqueia o salvar, abre
// os links em outra aba e some se nada passa do limiar ou se a busca não está no ar.
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
  screen.queryByRole('heading', { name: 'Parecido com pontos já cadastrados' });
const unavailable = () =>
  new ApiError(503, 'Modelo fora do ar.', { code: 'SEMANTIC_UNAVAILABLE' });
const text = 'Texto sintético sobre a união de opostos.';
// Quase uma cópia do ponto de demonstração "Individuação": passa do limiar.
const copyName = 'Individuação (exemplo fictício)';
const copyText =
  'Texto sintético sobre a união de opostos como caminho de autoconhecimento e de integração das partes da psique; não é uma afirmação histórica.';
type User = ReturnType<typeof userEvent.setup>;
async function typeCopy(user: User) {
  await user.type(
    await screen.findByRole('textbox', { name: 'Nome' }),
    copyName,
  );
  await user.click(description());
  await user.paste(copyText);
  await screen.findByRole('option', { name: 'Conceito' });
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tipo' }),
    'concept',
  );
}
const duplicates = {
  mode: 'duplicates',
  includePending: true,
  limit: hintLimit,
};

describe('ponto novo — Parecido com pontos já cadastrados', () => {
  it('só consulta com nome e descrição, 600 ms depois da última tecla, no texto do ponto e em modo duplicates', async () => {
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
    // O tipo padrão do cadastro é pessoa; o texto segue o formato da API.
    expect(semantic).toHaveBeenCalledWith(
      `União · pessoa · ${text}`,
      duplicates,
      expect.anything(),
    );
    expect(hintDelay).toBe(600);
    expect(hintLimit).toBe(3);
  });

  it('o texto leva o tipo escolhido e os outros nomes digitados, sem o idioma', async () => {
    const { user, semantic } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await screen.findByRole('option', { name: 'Obra' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'work',
    );
    await user.type(
      screen.getByRole('textbox', { name: /^Outros nomes/ }),
      'Henosis, Unity (en)',
    );
    await user.type(description(), text);
    await sleep(hintDelay + 300);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    expect(semantic).toHaveBeenCalledWith(
      `União · obra · Henosis, Unity · ${text}`,
      duplicates,
      expect.anything(),
    );
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
      'União · pessoa · Texto final',
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

  it('texto que não passa do limiar de duplicata não mostra nada', async () => {
    const { user, semantic } = await open('/edit/nodes');
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'União',
    );
    await user.type(description(), text);
    await sleep(hintDelay + 300);
    await waitFor(() => expect(semantic).toHaveBeenCalledTimes(1), settled);
    await sleep(300);
    expect(title()).toBeNull();
    expect(
      (await semantic.mock.results[0]!.value) as { items: unknown[] },
    ).toMatchObject({ items: [] });
  });

  it('mostra os pontos que passam do limiar, com tipo e semelhança, e abre os links em outra aba', async () => {
    const { user } = await open('/edit/nodes');
    await typeCopy(user);
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Parecido com pontos já cadastrados' },
        settled,
      ),
    ).toBeVisible();
    const region = (title() as HTMLElement).parentElement as HTMLElement;
    expect(region).toHaveAttribute('aria-live', 'polite');
    const rows = within(region).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(hintLimit);
    // Nome, tipo e semelhança separados por espaço (nome acessível e texto).
    expect(rows[0]).toHaveTextContent(
      /^Individuação \(exemplo fictício\) ↗ Conceito semelhança 1,00$/,
    );
    for (const row of rows) {
      expect(within(row).getByText(/^semelhança [01],\d\d$/)).toBeVisible();
      const link = within(row).getByRole('link');
      expect(link.getAttribute('href')).toMatch(
        /^\/edit\/nodes\/[0-9a-f-]{36}$/,
      );
      // Outra aba, sem perder o rascunho do cadastro.
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    const link = within(rows[0]!).getByRole('link', {
      name: 'Individuação (exemplo fictício) (abre em nova aba)',
    });
    expect(link).toHaveAttribute('href', `/edit/nodes/${ids.individuation}`);
    expect(within(rows[0]!).getByText('Conceito')).toBeVisible();
    expect(
      within(region).getByText(
        'Aviso, não bloqueio: confira se não é o mesmo ponto antes de salvar.',
      ),
    ).toBeVisible();
    expect(hintLeadText).toBe(
      'Aviso, não bloqueio: confira se não é o mesmo ponto antes de salvar.',
    );
    expect(document.body.textContent).not.toMatch(/%|confiança/);
  });

  it('apagar o nome ou a descrição esconde o aviso na hora', async () => {
    const { user } = await open('/edit/nodes');
    await typeCopy(user);
    await screen.findByRole('heading', { name: hintTitle }, settled);
    await user.clear(name());
    expect(title()).toBeNull();
    await user.type(name(), copyName);
    expect(
      await screen.findByRole('heading', { name: hintTitle }, settled),
    ).toBeVisible();
    await user.clear(description());
    expect(title()).toBeNull();
  });

  it('não bloqueia: com o aviso na tela, salvar segue como sempre', async () => {
    const { user, save } = await open('/edit/nodes');
    await typeCopy(user);
    await screen.findByRole('heading', { name: hintTitle }, settled);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
      'broad',
    );
    const button = screen.getByRole('button', { name: 'Salvar registro' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(await screen.findByText('Registro salvo.')).toBeVisible();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({ label: copyName, description: copyText }),
      expect.any(String),
      undefined,
    );
  });
});

describe('Parecido com pontos já cadastrados — quando não vale', () => {
  it('editar um ponto que já existe não consulta nem mostra o aviso', async () => {
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
    'só pontos têm o aviso: %s não consulta',
    async (type) => {
      const { semantic } = await open(`/edit/${type}`);
      await screen.findByRole('button', { name: 'Salvar registro' });
      await sleep(hintDelay + 300);
      expect(semantic).not.toHaveBeenCalled();
      expect(document.querySelector('.similar-hint')).toBeNull();
    },
  );

  it('503 SEMANTIC_UNAVAILABLE: o aviso some e o editor não mostra erro nem nota', async () => {
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

  it('qualquer outra falha da busca também fica fora do editor', async () => {
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

describe('o aviso depende do texto', () => {
  it('outro texto não mostra a resposta do anterior enquanto a nova não chega', async () => {
    const { user, semantic } = await open('/edit/nodes', (services, real) => {
      vi.spyOn(services.api, 'semanticSearch').mockImplementation((...args) =>
        args[0].endsWith('mais')
          ? new Promise<never>(() => {})
          : real.semanticSearch(...args),
      );
    });
    await typeCopy(user);
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
  const point = {
    label: 'União',
    kind: 'concept',
    aliases: '',
    description: 'texto',
  };

  it('escreve o ponto como a API: nome, tipo em português, outros nomes e descrição', () => {
    expect(hintQuery(point)).toBe('União · conceito · texto');
    expect(
      hintQuery({
        ...point,
        label: '  União ',
        description: ' texto  ',
        aliases: ' Henosis , Unity (en),, ',
      }),
    ).toBe('União · conceito · Henosis, Unity · texto');
    const words: Record<string, string> = {
      person: 'pessoa',
      tradition: 'tradição',
      concept: 'conceito',
      work: 'obra',
      figure: 'figura',
    };
    for (const [kind, word] of Object.entries(words))
      expect(hintQuery({ ...point, kind })).toBe(`União · ${word} · texto`);
  });

  it('parte vazia some, e sem nome ou descrição não há consulta', () => {
    expect(hintQuery({ ...point, kind: '' })).toBe('União · texto');
    expect(hintQuery({ ...point, kind: 'planeta' })).toBe('União · texto');
    expect(hintQuery({ ...point, description: '' })).toBe('');
    expect(hintQuery({ ...point, label: '' })).toBe('');
    expect(hintQuery({ ...point, label: '   ' })).toBe('');
    expect(hintQuery({ ...point, description: '   ' })).toBe('');
  });

  it('corta em 500 caracteres, o limite do q da API', () => {
    const long = { ...point, label: 'a', description: 'b'.repeat(900) };
    expect(hintQuery(long)).toHaveLength(500);
    expect(hintQuery(long).startsWith('a · conceito · b')).toBe(true);
    // 'a · conceito · ' tem 15 caracteres.
    expect(hintQuery({ ...long, description: 'b'.repeat(485) })).toHaveLength(
      500,
    );
    expect(hintQuery({ ...long, description: 'b'.repeat(484) })).toHaveLength(
      499,
    );
  });
});
