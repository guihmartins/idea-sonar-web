import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import type { Node, SemanticResults } from '../../src/api/domain';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';
import { RecordsPage } from '../../src/pages/RecordsPage';

// Busca por significado em Pontos: modo na URL, requisição, pontuação em
// português, "Mostrar mais" até 50 e a nota quieta do 503.
function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="url">{location.pathname + location.search}</span>
      <button onClick={() => void navigate(-1)}>voltar</button>
      <button onClick={() => void navigate(1)}>avançar</button>
    </div>
  );
}
type Services = ReturnType<typeof createFixtureServices>;
async function setup(
  path: string,
  prepare: (services: Services) => void = () => {},
) {
  const services = createFixtureServices();
  await services.session.login();
  const list = vi.spyOn(services.api, 'list');
  const semantic = vi.spyOn(services.api, 'semanticSearch');
  prepare(services);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <Probe />
          <Routes>
            {(['nodes', 'sources', 'contexts'] as const).map((type) => (
              <Route
                key={type}
                path={`/${type}`}
                element={<RecordsPage type={type} />}
              />
            ))}
          </Routes>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { services, list, semantic, user: userEvent.setup() };
}
const url = () => screen.getByTestId('url').textContent;
const box = () => screen.getByRole('searchbox', { name: 'Buscar' });
const mode = (name: 'Nome' | 'Significado') =>
  screen.getByRole('radio', { name });
const titles = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const count = () => document.querySelector('.record-count');
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';
const phrase = 'união de opostos como caminho de autoconhecimento';

// 20 pontos sintéticos com pontuação decrescente, para o limite do top-k.
function manyNodes(total: number, base: Node): SemanticResults {
  return {
    model: 'm',
    items: Array.from({ length: total }, (_, index) => ({
      node: { ...base, id: `id-${index}`, label: `Ponto ${index}` },
      score: 0.99 - index / 100,
    })),
  };
}
async function fixtureNode(services: Services): Promise<Node> {
  return (await services.api.list('nodes', null)).items[0] as Node;
}
const unavailable = () =>
  new ApiError(503, 'Busca semântica indisponível.', {
    code: 'SEMANTIC_UNAVAILABLE',
    message: 'Busca semântica indisponível.',
  });

describe('Pontos — o seletor de modo', () => {
  it('"Nome" vem marcado; o grupo se chama "Buscar por" e só existe em Pontos', async () => {
    await setup('/nodes');
    const group = screen.getByRole('radiogroup', { name: 'Buscar por' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(mode('Nome')).toBeChecked();
    expect(mode('Significado')).not.toBeChecked();
    expect(
      screen.getByRole('group', { name: 'Tipo e período' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).toBeInTheDocument();
    await screen.findByText('Jung (exemplo fictício)');
  });

  it.each(['sources', 'contexts'] as const)(
    '%s não tem o seletor, e mode=significado na URL é ignorado',
    async (type) => {
      const { list } = await setup(`/${type}?mode=significado&q=a`);
      await waitFor(() => expect(list).toHaveBeenCalled());
      expect(screen.queryByRole('radiogroup')).toBeNull();
      expect(list).toHaveBeenLastCalledWith(type, null, expect.anything(), {
        q: 'a',
      });
    },
  );

  it('Significado: sem requisição, só a dica; período e "exato" somem, tipo e pendentes ficam', async () => {
    const { user, list, semantic } = await setup('/nodes');
    await screen.findByText('Jung (exemplo fictício)');
    const calls = list.mock.calls.length;
    await user.click(mode('Significado'));
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado'));
    expect(mode('Significado')).toBeChecked();
    expect(mode('Nome')).not.toBeChecked();
    expect(
      screen.getByText(
        'Escreva uma ideia ou um trecho: a busca compara o sentido do texto com o dos pontos.',
      ),
    ).toBeVisible();
    expect(semantic).not.toHaveBeenCalled();
    expect(list.mock.calls).toHaveLength(calls);
    expect(titles()).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Tipo e período' })).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: 'Incluir período desconhecido' }),
    ).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).toBeVisible();
    expect(box()).toHaveAttribute(
      'placeholder',
      'Uma ideia, com suas palavras',
    );
    expect(box()).toHaveAttribute('maxlength', '500');
    expect(count()).toHaveTextContent(/^$/);
  });

  it('voltar a Nome devolve o período, a busca por nome e o limite de 200', async () => {
    const { user } = await setup('/nodes?mode=significado');
    await user.click(mode('Nome'));
    await waitFor(() => expect(url()).toBe('/nodes'));
    expect(mode('Nome')).toBeChecked();
    expect(screen.getByRole('group', { name: 'Tipo e período' })).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).toBeVisible();
    expect(box()).toHaveAttribute('maxlength', '200');
    expect(box()).toHaveAttribute(
      'placeholder',
      'Nome, outro nome ou identificador',
    );
    await screen.findByText('Jung (exemplo fictício)');
  });

  it('a troca mantém o texto, aplicado ou só digitado, nos dois sentidos', async () => {
    const { user } = await setup(
      '/nodes?q=jung&includePending=true&kind=person',
    );
    await screen.findByRole('heading', { level: 2, name: /Jung/ });
    await user.click(mode('Significado'));
    await waitFor(() =>
      expect(url()).toBe(
        '/nodes?mode=significado&q=jung&kind=person&includePending=true',
      ),
    );
    expect(box()).toHaveValue('jung');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue(
      'person',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).toBeChecked();
    // Texto digitado e ainda não aplicado também atravessa a troca.
    await user.clear(box());
    await user.type(box(), 'união');
    await user.click(mode('Nome'));
    await waitFor(() =>
      expect(url()).toBe('/nodes?q=uni%C3%A3o&kind=person&includePending=true'),
    );
    expect(box()).toHaveValue('união');
  });

  it('o filtro de período e o "exato" não atravessam para o significado', async () => {
    const { user } = await setup(
      '/nodes?q=jung&match=exact&startYear=-499&endYear=30&includeUnknownPeriod=false',
    );
    await screen.findByRole('heading', { level: 2, name: /Jung/ });
    await user.click(mode('Significado'));
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado&q=jung'));
  });

  it('o teclado troca de modo com as setas, sem perder o foco', async () => {
    const { user } = await setup('/nodes');
    await screen.findByText('Jung (exemplo fictício)');
    mode('Nome').focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado'));
    expect(mode('Significado')).toHaveFocus();
    expect(mode('Significado')).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(url()).toBe('/nodes'));
    expect(mode('Nome')).toHaveFocus();
  });

  it('voltar e avançar restauram o modo, o texto e os resultados', async () => {
    const { user } = await setup('/nodes');
    await screen.findByText('Jung (exemplo fictício)');
    await user.click(mode('Significado'));
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado'));
    await user.type(box(), `${phrase}{Enter}`);
    await waitFor(() => expect(titles()[0]).toBe(individuation));
    await user.click(screen.getByRole('button', { name: 'voltar' }));
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado'));
    expect(box()).toHaveValue('');
    expect(titles()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'voltar' }));
    await waitFor(() => expect(url()).toBe('/nodes'));
    expect(mode('Nome')).toBeChecked();
    expect(screen.getByRole('group', { name: 'Tipo e período' })).toBeVisible();
    await screen.findByText('Jung (exemplo fictício)');
    await user.click(screen.getByRole('button', { name: 'avançar' }));
    await user.click(screen.getByRole('button', { name: 'avançar' }));
    await waitFor(() => expect(titles()[0]).toBe(individuation));
    expect(mode('Significado')).toBeChecked();
    expect(box()).toHaveValue(phrase);
    expect(url()).toContain('mode=significado&q=');
  });
});

describe('Pontos — resultados por significado', () => {
  it('manda q, tipo e pendentes à busca, 20 de início, e mostra a ordem com a pontuação', async () => {
    const { semantic, list } = await setup(
      `/nodes?mode=significado&q=${encodeURIComponent(phrase)}&kind=concept&includePending=true`,
    );
    await waitFor(() => expect(titles()).toContain(individuation));
    expect(semantic).toHaveBeenCalledTimes(1);
    expect(semantic).toHaveBeenCalledWith(
      phrase,
      { kind: 'concept', includePending: true, limit: 20 },
      expect.anything(),
    );
    // Sem a busca por nome: nada de api.list neste modo.
    expect(list).not.toHaveBeenCalled();
    expect(titles().slice(0, 2)).toEqual([individuation, coniunctio]);
    const first = screen
      .getByRole('heading', { level: 2, name: individuation })
      .closest('article') as HTMLElement;
    expect(first).toHaveTextContent(
      /Estado: Ativo · semelhança 0,\d\dVer e editar$/,
    );
    expect(
      within(first).getByRole('link', { name: 'Ver e editar' }),
    ).toHaveAttribute(
      'href',
      '/edit/nodes/00000000-0000-4000-8000-000000000030',
    );
    expect(count()).toHaveTextContent('2 pontos, em ordem de semelhança');
    expect(screen.queryByText(/Nenhum ponto de sentido parecido/)).toBeNull();
    expect(screen.queryByText(/Escreva uma ideia ou um trecho/)).toBeNull();
    expect(
      screen.getByText(
        'Ordem por sentido do texto. Semelhança não é identidade: confira antes de reutilizar.',
      ),
    ).toBeVisible();
    expect(box()).toHaveValue(phrase);
  });

  it('só manda o que está na URL: sem tipo nem pendentes, os dois ficam de fora', async () => {
    const { semantic } = await setup(
      `/nodes?mode=significado&q=${encodeURIComponent(phrase)}`,
    );
    await waitFor(() => expect(titles()).toContain(individuation));
    expect(semantic).toHaveBeenCalledWith(
      phrase,
      { kind: undefined, includePending: undefined, limit: 20 },
      expect.anything(),
    );
  });

  it('busca pelo formulário: Enter aplica na URL e consulta uma vez', async () => {
    const { user, semantic } = await setup('/nodes?mode=significado');
    await user.type(box(), 'caminho de autoconhecimento{Enter}');
    await waitFor(() =>
      expect(url()).toBe(
        '/nodes?mode=significado&q=caminho+de+autoconhecimento',
      ),
    );
    await waitFor(() => expect(titles()).toContain(individuation));
    expect(semantic).toHaveBeenCalledTimes(1);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'work',
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() =>
      expect(url()).toBe(
        '/nodes?mode=significado&q=caminho+de+autoconhecimento&kind=work&includePending=true',
      ),
    );
  });

  it('"Limpar" esvazia a busca mas continua em Significado', async () => {
    const { user } = await setup(
      '/nodes?mode=significado&q=opostos&kind=work&includePending=true',
    );
    await waitFor(() => expect(count()).toHaveTextContent(/pontos?, em ordem/));
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => expect(url()).toBe('/nodes?mode=significado'));
    expect(mode('Significado')).toBeChecked();
    expect(box()).toHaveValue('');
    expect(titles()).toEqual([]);
    expect(count()).toHaveTextContent(/^$/);
  });

  it('a pontuação é um número de duas casas com vírgula, nunca percentual', async () => {
    const { semantic } = await setup('/nodes?mode=significado&q=a', (s) => {
      semanticFrom(s, [0.87, 0.9, 1]);
    });
    await waitFor(() => expect(titles()).toHaveLength(3));
    expect(semantic).toHaveBeenCalled();
    const lines = Array.from(document.querySelectorAll('.score')).map(
      (el) => el.textContent,
    );
    expect(lines).toEqual([
      'semelhança 0,87',
      'semelhança 0,90',
      'semelhança 1,00',
    ]);
    expect(document.body.textContent).not.toMatch(/%|confiança|probabilidade/i);
  });

  it('1 resultado fica no singular', async () => {
    await setup('/nodes?mode=significado&q=a', (s) => semanticFrom(s, [0.5]));
    await waitFor(() =>
      expect(count()).toHaveTextContent('1 ponto, em ordem de semelhança'),
    );
  });

  it('nada parecido: diz a busca, sem a linha de ordem', async () => {
    await setup('/nodes?mode=significado&q=zzz%20yyy');
    expect(
      await screen.findByText(
        'Nenhum ponto de sentido parecido com “zzz yyy”.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/Ordem por sentido do texto/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });

  it('espera a resposta com "Buscando…" e avisa quando chega', async () => {
    let release!: (value: SemanticResults) => void;
    await setup('/nodes?mode=significado&q=a', (s) => {
      vi.spyOn(s.api, 'semanticSearch').mockImplementation(
        () => new Promise<SemanticResults>((resolve) => (release = resolve)),
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Buscando…');
    release({ model: 'm', items: [] });
    await screen.findByText(/Nenhum ponto de sentido parecido/);
    expect(screen.queryByText('Buscando…')).toBeNull();
  });
});

function semanticFrom(services: Services, scores: number[]) {
  vi.spyOn(services.api, 'semanticSearch').mockImplementation(async () => {
    const base = await fixtureNode(services);
    return {
      model: 'm',
      items: scores.map((score, index) => ({
        node: { ...base, id: `n-${index}`, label: `Ponto ${index}` },
        score,
      })),
    };
  });
}

describe('Pontos — a consulta depende do que foi pedido', () => {
  it('outro tipo ou pendentes não reaproveitam a resposta de outra busca', async () => {
    const { user } = await setup('/nodes?mode=significado&q=a', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockImplementation(
        async (_q, filters) => {
          // Só a busca sem tipo e sem pendentes responde; as outras ficam esperando.
          if (filters.kind || filters.includePending)
            return new Promise<SemanticResults>(() => {});
          return {
            model: 'm',
            items: [
              {
                node: await fixtureNode(services),
                score: 0.9,
              },
            ],
          };
        },
      );
    });
    await waitFor(() => expect(titles()).toHaveLength(1));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'work',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Buscando…')).toBeVisible();
    expect(titles()).toHaveLength(0);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      '',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(titles()).toHaveLength(1));
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByText('Buscando…')).toBeVisible();
    expect(titles()).toHaveLength(0);
  });
});

describe('Pontos — Mostrar mais (top-k, sem cursor)', () => {
  it('com 20 resultados oferece "Mostrar mais"; ele pede 50 e some', async () => {
    const { user, semantic } = await setup(
      '/nodes?mode=significado&q=a',
      (services) => {
        vi.spyOn(services.api, 'semanticSearch').mockImplementation(
          async (_q, filters) =>
            manyNodes(
              filters.limit === 50 ? 50 : 20,
              await fixtureNode(services),
            ),
        );
      },
    );
    await waitFor(() => expect(titles()).toHaveLength(20));
    expect(count()).toHaveTextContent('20 pontos, em ordem de semelhança');
    const more = screen.getByRole('button', { name: 'Mostrar mais' });
    await user.click(more);
    await waitFor(() => expect(titles()).toHaveLength(50));
    expect(semantic).toHaveBeenLastCalledWith(
      'a',
      { kind: undefined, includePending: undefined, limit: 50 },
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
    expect(count()).toHaveTextContent('50 pontos, em ordem de semelhança');
    // Os 20 primeiros continuam na tela enquanto os 50 chegam, na mesma ordem.
    expect(titles().slice(0, 3)).toEqual(['Ponto 0', 'Ponto 1', 'Ponto 2']);
  });

  it('com 20 resultados também em 50, o botão some depois de pedir', async () => {
    const { user, semantic } = await setup(
      '/nodes?mode=significado&q=a',
      (services) => {
        vi.spyOn(services.api, 'semanticSearch').mockImplementation(async () =>
          manyNodes(20, await fixtureNode(services)),
        );
      },
    );
    await waitFor(() => expect(titles()).toHaveLength(20));
    await user.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    await waitFor(() =>
      expect(semantic).toHaveBeenLastCalledWith(
        'a',
        { kind: undefined, includePending: undefined, limit: 50 },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull(),
    );
    expect(titles()).toHaveLength(20);
  });

  it('menos de 20 resultados: sem botão', async () => {
    await setup('/nodes?mode=significado&q=a', (services) =>
      semanticFrom(
        services,
        Array.from({ length: 19 }, () => 0.5),
      ),
    );
    await waitFor(() => expect(titles()).toHaveLength(19));
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });

  it('uma busca nova volta ao limite de 20', async () => {
    const { user, semantic } = await setup(
      '/nodes?mode=significado&q=a',
      (services) => {
        vi.spyOn(services.api, 'semanticSearch').mockImplementation(
          async (_q, filters) =>
            manyNodes(
              filters.limit === 50 ? 50 : 20,
              await fixtureNode(services),
            ),
        );
      },
    );
    await waitFor(() => expect(titles()).toHaveLength(20));
    await user.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    await waitFor(() => expect(titles()).toHaveLength(50));
    await user.clear(box());
    await user.type(box(), 'b{Enter}');
    await waitFor(() =>
      expect(semantic).toHaveBeenLastCalledWith(
        'b',
        { kind: undefined, includePending: undefined, limit: 20 },
        expect.anything(),
      ),
    );
    await waitFor(() => expect(titles()).toHaveLength(20));
    expect(screen.getByRole('button', { name: 'Mostrar mais' })).toBeVisible();
  });
});

describe('Pontos — busca por significado indisponível', () => {
  it('503 SEMANTIC_UNAVAILABLE vira uma nota quieta, sem alerta nem "tentar novamente"', async () => {
    await setup('/nodes?mode=significado&q=a', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockRejectedValue(unavailable());
    });
    const note = await screen.findByText(
      'Busca por significado indisponível: o modelo da API não está ativo.',
    );
    expect(note).toBeVisible();
    expect(note).toHaveClass('semantic-note');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).toBeNull();
    // A busca por nome continua à mão.
    expect(mode('Nome')).toBeEnabled();
  });

  it('outro erro segue o Failure, com "Tentar novamente"', async () => {
    const { user, semantic } = await setup(
      '/nodes?mode=significado&q=a',
      (services) => {
        vi.spyOn(services.api, 'semanticSearch')
          .mockRejectedValueOnce(
            new ApiError(500, 'Falha interna.', { code: 'INTERNAL' }),
          )
          .mockResolvedValue({ model: 'm', items: [] });
      },
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha interna.',
    );
    expect(screen.queryByText(/modelo da API não está ativo/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText(/Nenhum ponto de sentido parecido/);
    expect(semantic).toHaveBeenCalledTimes(2);
  });

  it('503 com outro código não é a nota', async () => {
    await setup('/nodes?mode=significado&q=a', (services) => {
      vi.spyOn(services.api, 'semanticSearch').mockRejectedValue(
        new ApiError(503, 'Em manutenção.', { code: 'MAINTENANCE' }),
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Em manutenção.',
    );
  });
});
