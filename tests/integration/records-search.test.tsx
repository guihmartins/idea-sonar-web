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
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';
import { RecordsPage } from '../../src/pages/RecordsPage';

// Busca nas listas de Pontos, Fontes e Contextos: estado na URL, filtros na
// requisição e na chave da consulta, e o texto que o leitor de tela anuncia.
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
async function setup(
  path: string,
  prepare: (
    services: ReturnType<typeof createFixtureServices>,
  ) => void = () => {},
) {
  const services = createFixtureServices();
  await services.session.login();
  const list = vi.spyOn(services.api, 'list');
  prepare(services);
  const client = createQueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <Probe />
          <Routes>
            {(
              ['nodes', 'relations', 'sources', 'contexts', 'views'] as const
            ).map((type) => (
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
  return { services, list, client, user: userEvent.setup() };
}
const url = () => screen.getByTestId('url').textContent;
const box = () => screen.getByRole('searchbox', { name: 'Buscar' });
const submit = () => screen.getByRole('button', { name: 'Buscar' });
const status = () => document.querySelector('[aria-live="polite"]');
const titles = () =>
  screen.queryAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const jung = 'Jung (exemplo fictício)';
const gnosis = 'Gnosticismo (exemplo fictício)';
const concept = 'Conceito compartilhado fictício';
const work = 'Obra de demonstração';
const nodeFilters = {
  q: 'jung',
  match: 'exact',
  kind: 'person',
  includePending: true,
  startYear: -499,
  endYear: 30,
  includeUnknownPeriod: false,
};
const nodeUrl =
  '/nodes?q=jung&match=exact&kind=person&includePending=true&startYear=-499&endYear=30&includeUnknownPeriod=false';

describe('busca nas listas — quais telas e quais campos', () => {
  it.each([
    ['nodes', 'Pontos', 'Busca de pontos', 'Nome, outro nome ou identificador'],
    ['sources', 'Fontes', 'Busca de fontes', 'Título, DOI ou endereço'],
    ['contexts', 'Contextos', 'Busca de contextos', 'Nome do contexto'],
  ] as const)(
    '%s tem a busca, o botão secundário e a contagem',
    async (type, title, name, hint) => {
      await setup(`/${type}`);
      await screen.findByRole('heading', { level: 1, name: title });
      const form = screen.getByRole('search', { name });
      const field = within(form).getByRole('searchbox', { name: 'Buscar' });
      expect(field).toBeVisible();
      // A dica de cada lista diz o que ela busca, e o campo aceita até 200.
      expect(field).toHaveAttribute('placeholder', hint);
      expect(field).toHaveAttribute('maxlength', '200');
      expect(
        within(form).getByRole('checkbox', {
          name: 'Nome ou identificador exato',
        }),
      ).not.toBeChecked();
      expect(
        within(form).getByRole('checkbox', { name: 'Incluir pendentes' }),
      ).not.toBeChecked();
      expect(
        within(form).getByRole('button', { name: 'Limpar' }),
      ).toHaveAttribute('type', 'button');
      // O botão primário da tela segue sendo só o "Cadastrar".
      const submitButton = within(form).getByRole('button', { name: 'Buscar' });
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(submitButton).not.toHaveClass('primary');
      expect(document.querySelectorAll('.primary')).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveClass(
        'primary',
      );
      await waitFor(() =>
        expect(status()).toHaveTextContent(/registros? carregados?/),
      );
    },
  );

  it.each([
    ['relations', 'Relações'],
    ['views', 'Views salvas'],
  ] as const)('%s mantém a lista simples', async (type, title) => {
    const { list } = await setup(`/${type}?q=jung&kind=person`);
    await screen.findByRole('heading', { level: 1, name: title });
    await waitFor(() => expect(screen.queryByText('Carregando…')).toBeNull());
    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Buscar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Limpar' })).toBeNull();
    expect(status()).toBeNull();
    // A URL não vira filtro nas listas sem busca.
    expect(list).toHaveBeenCalledWith(type, null, expect.anything(), {});
  });

  it('pontos: tipo (com Figura), período em ano e era, e período desconhecido', async () => {
    await setup('/nodes');
    const form = await screen.findByRole('search', { name: 'Busca de pontos' });
    // O nome do formulário não pode casar com o "Buscar ponto" do campo do mapa.
    expect(screen.queryByLabelText(/Buscar ponto/i)).toBeNull();
    const kind = within(form).getByRole('combobox', { name: 'Tipo' });
    expect(
      within(kind)
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value'), o.textContent]),
    ).toEqual([
      ['', 'Todos'],
      ['person', 'Pessoa'],
      ['tradition', 'Tradição'],
      ['concept', 'Conceito'],
      ['work', 'Obra'],
      ['figure', 'Figura'],
    ]);
    expect(kind).toHaveValue('');
    for (const [year, era, eraOptions] of [
      ['Ano inicial', 'Era do início', ['d.C.', 'a.C.']],
      ['Ano final', 'Era do fim', ['d.C.', 'a.C.']],
    ] as const) {
      const field = within(form).getByRole('spinbutton', { name: year });
      expect(field).toHaveValue(null);
      expect(field).toHaveAttribute('min', '1');
      expect(
        within(within(form).getByRole('combobox', { name: era }))
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(eraOptions);
      expect(within(form).getByRole('combobox', { name: era })).toHaveValue(
        'ce',
      );
    }
    expect(
      within(form).getByRole('checkbox', {
        name: 'Incluir período desconhecido',
      }),
    ).toBeChecked();
    expect(
      within(form).getByRole('group', { name: 'Tipo e período' }),
    ).toBeVisible();
  });

  it.each([
    ['sources', 'Busca de fontes'],
    ['contexts', 'Busca de contextos'],
  ] as const)('%s não tem tipo nem período', async (type, name) => {
    await setup(`/${type}`);
    const form = await screen.findByRole('search', { name });
    expect(within(form).queryByRole('combobox')).toBeNull();
    expect(within(form).queryByRole('spinbutton')).toBeNull();
    expect(within(form).queryByRole('group')).toBeNull();
    expect(within(form).queryByText('Incluir período desconhecido')).toBeNull();
    expect(within(form).queryByText('Figura')).toBeNull();
  });
});

describe('busca nas listas — estado na URL', () => {
  it('a URL preenche o formulário e vai inteira para a requisição', async () => {
    const { list } = await setup(nodeUrl);
    await screen.findByRole('heading', { level: 2, name: jung });
    expect(box()).toHaveValue('jung');
    expect(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue(
      'person',
    );
    expect(screen.getByRole('spinbutton', { name: 'Ano inicial' })).toHaveValue(
      500,
    );
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'bce',
    );
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      30,
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'ce',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Incluir período desconhecido' }),
    ).not.toBeChecked();
    expect(list).toHaveBeenCalledWith(
      'nodes',
      null,
      expect.anything(),
      nodeFilters,
    );
  });

  it('digitar não muda a URL nem a requisição; Enter aplica', async () => {
    const { list, user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    const calls = list.mock.calls.length;
    await user.type(box(), 'jung');
    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    expect(url()).toBe('/nodes');
    expect(list.mock.calls).toHaveLength(calls);
    await user.type(box(), '{Enter}');
    await waitFor(() => expect(url()).toBe('/nodes?q=jung&match=exact'));
    await waitFor(() => expect(titles()).toEqual([jung]));
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {
      q: 'jung',
      match: 'exact',
    });
  });

  it('o botão "Buscar" aplica tudo em ordem fixa e o resultado segue o filtro', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'tradition',
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(submit());
    await waitFor(() =>
      expect(url()).toBe('/nodes?kind=tradition&includePending=true'),
    );
    await waitFor(() => expect(titles()).toEqual([gnosis]));
  });

  it('valor vazio ou padrão fica fora da URL e da requisição', async () => {
    const { list, user } = await setup('/nodes?q=jung&match=exact');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.clear(box());
    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes'));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        'nodes',
        null,
        expect.anything(),
        {},
      ),
    );
    // Só espaços também é vazio.
    await user.type(box(), '   ');
    await user.click(submit());
    expect(url()).toBe('/nodes');
  });

  it('o texto perde os espaços das pontas', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), '  jung  ');
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?q=jung'));
    expect(box()).toHaveValue('jung');
  });

  it('parâmetros inválidos da URL são ignorados', async () => {
    const { list } = await setup(
      '/nodes?kind=planta&startYear=abc&endYear=999999&match=talvez&includePending=sim',
    );
    await screen.findByRole('heading', { level: 2, name: jung });
    expect(list).toHaveBeenCalledWith('nodes', null, expect.anything(), {});
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('');
  });

  it('em fontes, tipo e período da URL não viram filtro', async () => {
    const { list } = await setup('/sources?q=fonte&kind=person&startYear=3');
    await screen.findByRole('heading', {
      level: 2,
      name: 'Fonte sintética de demonstração',
    });
    expect(list).toHaveBeenCalledWith('sources', null, expect.anything(), {
      q: 'fonte',
    });
  });

  it('voltar e avançar refazem a busca e o formulário', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), 'gnosticismo');
    await user.click(submit());
    await waitFor(() => expect(titles()).toEqual([gnosis]));
    expect(url()).toBe('/nodes?q=gnosticismo');

    await user.click(screen.getByRole('button', { name: 'voltar' }));
    await waitFor(() => expect(url()).toBe('/nodes'));
    expect(box()).toHaveValue('');
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));

    await user.click(screen.getByRole('button', { name: 'avançar' }));
    await waitFor(() => expect(url()).toBe('/nodes?q=gnosticismo'));
    expect(box()).toHaveValue('gnosticismo');
    await waitFor(() => expect(titles()).toEqual([gnosis]));
  });

  it('voltar descarta o que estava digitado e não aplicado', async () => {
    const { user } = await setup('/nodes?q=jung');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), ' rascunho');
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toContain('includePending=true'));
    await user.type(box(), ' mais');
    await user.click(screen.getByRole('button', { name: 'voltar' }));
    await waitFor(() => expect(url()).toBe('/nodes?q=jung'));
    expect(box()).toHaveValue('jung');
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).not.toBeChecked();
  });
});

describe('busca nas listas — modo exato e estado vazio', () => {
  it('exato não acha trecho: o vazio nomeia a busca e sugere desmarcar "exato"', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), 'gnosticismo');
    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?q=gnosticismo&match=exact'));
    const empty = await screen.findByText(/Nenhum ponto encontrado/);
    expect(empty).toHaveTextContent(
      'Nenhum ponto encontrado para “gnosticismo”. Desmarque “Nome ou identificador exato” para buscar por trecho.',
    );
    expect(empty).toHaveClass('empty');
    expect(titles()).toEqual([]);
    expect(status()).toHaveTextContent('0 registros carregados');

    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    await user.click(submit());
    await waitFor(() => expect(titles()).toEqual([gnosis]));
    expect(screen.queryByText(/Nenhum ponto encontrado/)).toBeNull();
  });

  it('exato acha o nome inteiro, o outro nome e ignora acento e caixa', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    for (const q of ['JUNG', 'jung (exemplo ficticio)']) {
      await user.clear(box());
      await user.type(box(), q);
      await user.click(
        screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
      );
      await user.click(submit());
      await waitFor(() => expect(titles()).toEqual([jung]));
      await user.click(
        screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
      );
    }
  });

  it('sem exato, o vazio só nomeia a busca', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), 'zzz');
    await user.click(submit());
    const empty = await screen.findByText(
      'Nenhum ponto encontrado para “zzz”.',
    );
    expect(empty).not.toHaveTextContent('Desmarque');
  });

  it('fontes e contextos nomeiam a busca no gênero certo', async () => {
    const { user } = await setup('/sources?q=zzz');
    expect(
      await screen.findByText('Nenhuma fonte encontrada para “zzz”.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await screen.findByRole('heading', {
      level: 2,
      name: 'Fonte sintética de demonstração',
    });
  });

  it('contextos: vazio com busca exata', async () => {
    await setup('/contexts?q=contexto&match=exact');
    expect(
      await screen.findByText(
        'Nenhum contexto encontrado para “contexto”. Desmarque “Nome ou identificador exato” para buscar por trecho.',
      ),
    ).toBeVisible();
  });

  it('só tipo e período: o vazio fala do tipo ou período escolhido', async () => {
    await setup('/nodes?kind=figure');
    expect(
      await screen.findByText(
        'Nenhum ponto encontrado com o tipo ou o período escolhido.',
      ),
    ).toBeVisible();
  });

  it('lista vazia sem busca mantém o texto de sempre', async () => {
    await setup('/nodes', ({ api }) => {
      vi.spyOn(api, 'list').mockResolvedValue({ items: [], nextCursor: null });
    });
    expect(
      await screen.findByText('Nenhum registro encontrado.'),
    ).toBeVisible();
    expect(status()).toHaveTextContent(/^0 registros carregados$/);
  });
});

describe('busca nas listas — tipo e período dos pontos', () => {
  it('tipo filtra a lista', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'Figura',
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?kind=figure'));
    await screen.findByText(/Nenhum ponto encontrado/);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'work',
    );
    await user.click(submit());
    await waitFor(() => expect(titles()).toEqual([work]));
  });

  it('período em ano civil e era vira ano astronômico na URL e na requisição', async () => {
    const { list, user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '5',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do início' }),
      'a.C.',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '10',
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?startYear=-4&endYear=10'));
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {
      startYear: -4,
      endYear: 10,
    });
    // O contexto fictício (0 a 100) cruza o intervalo; os sem período entram.
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() =>
      expect(titles()).toEqual([jung, gnosis, concept, work]),
    );
  });

  it('"Incluir período desconhecido" desmarcado tira os pontos sem período', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir período desconhecido' }),
    );
    await user.click(submit());
    await waitFor(() =>
      expect(url()).toBe('/nodes?includeUnknownPeriod=false'),
    );
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('período depois do contexto exclui os pontos que ele cobre', async () => {
    const { user } = await setup('/nodes?includeUnknownPeriod=false');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '200',
    );
    await user.click(submit());
    await waitFor(() =>
      expect(url()).toBe('/nodes?startYear=200&includeUnknownPeriod=false'),
    );
    await screen.findByText(/Nenhum ponto encontrado/);
  });

  it('a era do fim também vale: a.C. nos dois anos', async () => {
    const { list, user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '10',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do início' }),
      'a.C.',
    );
    await user.type(screen.getByRole('spinbutton', { name: 'Ano final' }), '5');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do fim' }),
      'a.C.',
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?startYear=-9&endYear=-4'));
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {
      startYear: -9,
      endYear: -4,
    });
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'bce',
    );
  });

  it('ano fora dos limites da API: erro no campo, nada muda', async () => {
    const { list, user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    const calls = list.mock.calls.length;
    const start = screen.getByRole('spinbutton', { name: 'Ano inicial' });
    await user.type(start, '100002');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do início' }),
      'a.C.',
    );
    await user.click(submit());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Ano fora do intervalo aceito: de 100001 a.C. a 3000 d.C.',
    );
    expect(start).toHaveAttribute('aria-invalid', 'true');
    expect(start).toHaveAccessibleDescription(
      'Ano fora do intervalo aceito: de 100001 a.C. a 3000 d.C.',
    );
    expect(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(url()).toBe('/nodes');
    expect(list.mock.calls).toHaveLength(calls);
    // Corrigido o ano, o erro some e a busca roda.
    await user.clear(start);
    await user.type(start, '100001');
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?startYear=-100000'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(start).not.toHaveAttribute('aria-invalid');
    expect(start).not.toHaveAttribute('aria-describedby');
  });

  it('ano inválido e ano inicial depois do final têm cada um a sua mensagem', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    const start = screen.getByRole('spinbutton', { name: 'Ano inicial' });
    await user.type(start, '0');
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe ano inteiro positivo e escolha a era.',
    );
    await user.clear(start);
    await user.type(start, '20');
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '10',
    );
    await user.click(submit());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'O ano inicial não pode ser posterior ao final.',
      ),
    );
    expect(url()).toBe('/nodes');
  });

  it('o erro de ano some com o "Limpar" e com a navegação', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '0',
    );
    await user.click(submit());
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Ano inicial' })).toHaveValue(
      null,
    );
  });
});

describe('busca nas listas — fontes e contextos', () => {
  it('fontes: título sem acento nem caixa', async () => {
    const { user } = await setup('/sources');
    await screen.findByRole('heading', {
      level: 2,
      name: 'Fonte sintética de demonstração',
    });
    await user.type(box(), 'SINTETICA');
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/sources?q=SINTETICA'));
    await screen.findByRole('heading', {
      level: 2,
      name: 'Fonte sintética de demonstração',
    });
    await user.clear(box());
    await user.type(box(), 'nada');
    await user.click(submit());
    await screen.findByText('Nenhuma fonte encontrada para “nada”.');
  });

  it('fontes: DOI e endereço exatos', async () => {
    const { services, user } = await setup('/sources');
    await screen.findByRole('heading', {
      level: 2,
      name: 'Fonte sintética de demonstração',
    });
    await services.api.save(
      'sources',
      {
        title: 'Artigo com DOI',
        authorText: 'Autora fictícia',
        canonicalUrl: null,
        workNodeId: null,
        publicationLabel: null,
        doi: '10.1234/abc.5',
        accessedAt: null,
        notes: null,
        status: 'active',
      },
      'k-doi',
    );
    await user.type(box(), 'https://doi.org/10.1234/ABC.5');
    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    await user.click(submit());
    await waitFor(() => expect(titles()).toEqual(['Artigo com DOI']));
    await user.clear(box());
    await user.type(box(), 'https://example.com/fonte-ficticia');
    await user.click(submit());
    await waitFor(() =>
      expect(titles()).toEqual(['Fonte sintética de demonstração']),
    );
    await user.clear(box());
    await user.type(box(), '10.1234');
    await user.click(submit());
    await screen.findByText(/Nenhuma fonte encontrada para “10.1234”/);
  });

  it('fontes: pendentes só com "Incluir pendentes"', async () => {
    const { services, user } = await setup('/sources?q=rascunho');
    await screen.findByText('Nenhuma fonte encontrada para “rascunho”.');
    await services.api.save(
      'sources',
      {
        title: 'Rascunho de fonte',
        authorText: 'Autora fictícia',
        canonicalUrl: null,
        workNodeId: null,
        publicationLabel: null,
        doi: null,
        accessedAt: null,
        notes: null,
        status: 'pending',
      },
      'k-pending',
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(submit());
    await waitFor(() =>
      expect(url()).toBe('/sources?q=rascunho&includePending=true'),
    );
    await waitFor(() => expect(titles()).toEqual(['Rascunho de fonte']));
    expect(screen.getByText('Estado: Pendente')).toBeVisible();
  });

  it('contextos: rótulo sem acento nem caixa, exato e pendentes', async () => {
    const { user } = await setup('/contexts');
    await screen.findByRole('heading', { level: 2, name: 'Contexto fictício' });
    await user.type(box(), 'FICTICIO');
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/contexts?q=FICTICIO'));
    await screen.findByRole('heading', { level: 2, name: 'Contexto fictício' });
    await user.clear(box());
    await user.type(box(), 'contexto ficticio');
    await user.click(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    );
    await user.click(submit());
    await waitFor(() =>
      expect(url()).toBe('/contexts?q=contexto+ficticio&match=exact'),
    );
    await screen.findByRole('heading', { level: 2, name: 'Contexto fictício' });
  });
});

describe('busca nas listas — paginação', () => {
  it('"Carregar mais" continua dentro da mesma busca, com o cursor dela', async () => {
    const { list, user } = await setup('/nodes?q=e');
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    expect(status()).toHaveTextContent('2 registros carregados · há mais');
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() =>
      expect(titles()).toEqual([jung, gnosis, concept, work]),
    );
    expect(status()).toHaveTextContent(/^4 registros carregados$/);
    expect(list).toHaveBeenLastCalledWith('nodes', '2:q=e', expect.anything(), {
      q: 'e',
    });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('os filtros fazem parte da chave da consulta, uma por busca', async () => {
    const { client, user } = await setup('/nodes?q=e');
    await waitFor(() => expect(titles()).toHaveLength(2));
    const keys = () =>
      client
        .getQueryCache()
        .findAll({ queryKey: ['list'] })
        .map((query) => query.queryKey);
    expect(keys()).toEqual([['list', 'nodes', { q: 'e' }]]);
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(submit());
    await waitFor(() => expect(keys()).toHaveLength(2));
    expect(keys()).toContainEqual([
      'list',
      'nodes',
      { q: 'e', includePending: true },
    ]);
  });

  it('mudar o filtro recomeça a paginação: o cursor da busca anterior não vai junto', async () => {
    const { list, user } = await setup('/nodes?q=e');
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() => expect(titles()).toHaveLength(4));

    await user.clear(box());
    await user.type(box(), 'o');
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?q=o'));
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    expect(status()).toHaveTextContent('2 registros carregados · há mais');
    // A API (e a fictícia) recusa cursor de outra busca: nenhum erro apareceu.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {
      q: 'o',
    });
    // Um só pedido com cursor em toda a sessão: o da busca "e".
    expect(list.mock.calls.filter((call) => call[1] !== null)).toHaveLength(1);

    // Outro filtro, mesma lógica: o cursor "2:q=o" não é reaproveitado.
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    await user.click(submit());
    await waitFor(() => expect(url()).toBe('/nodes?q=o&includePending=true'));
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {
      q: 'o',
      includePending: true,
    });
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('busca nas listas — Limpar', () => {
  it('volta a URL, o formulário e a requisição ao estado sem filtro', async () => {
    const { list, user } = await setup(nodeUrl);
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => expect(url()).toBe('/nodes'));
    expect(box()).toHaveValue('');
    expect(
      screen.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue('');
    expect(screen.getByRole('spinbutton', { name: 'Ano inicial' })).toHaveValue(
      null,
    );
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'ce',
    );
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      null,
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'ce',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Incluir período desconhecido' }),
    ).toBeChecked();
    await waitFor(() => expect(titles()).toEqual([jung, gnosis]));
    expect(list).toHaveBeenLastCalledWith('nodes', null, expect.anything(), {});
  });

  it('descarta também o que foi digitado e não aplicado', async () => {
    const { list, user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), 'rascunho');
    await user.click(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    );
    const calls = list.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(box()).toHaveValue('');
    expect(
      screen.getByRole('checkbox', { name: 'Incluir pendentes' }),
    ).not.toBeChecked();
    expect(url()).toBe('/nodes');
    expect(list.mock.calls).toHaveLength(calls);
  });
});

describe('busca nas listas — linha de estado', () => {
  it('é uma região viva educada com a contagem das páginas carregadas', async () => {
    const { user } = await setup('/nodes');
    await waitFor(() =>
      expect(status()).toHaveTextContent(/^2 registros carregados · há mais$/),
    );
    expect(status()).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await waitFor(() =>
      expect(status()).toHaveTextContent(/^4 registros carregados$/),
    );
  });

  it('um só registro fica no singular, sem "há mais"', async () => {
    await setup('/nodes?q=jung');
    await waitFor(() =>
      expect(status()).toHaveTextContent(/^1 registro carregado$/),
    );
  });

  it('a região existe antes do resultado, vazia, e não mostra contagem na falha', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'list').mockRejectedValue(
      new ApiError(500, 'Falha ao listar'),
    );
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/contexts']}>
          <ServicesProvider services={services}>
            <RecordsPage type="contexts" />
          </ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(status()).toBeEmptyDOMElement();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao listar',
    );
    expect(status()).toBeEmptyDOMElement();
  });

  it('enquanto a busca carrega, só o "Carregando…" fala; a lista antiga some', async () => {
    const { user } = await setup('/nodes');
    await screen.findByRole('heading', { level: 2, name: jung });
    await user.type(box(), 'gnosticismo');
    await user.click(submit());
    await screen.findByRole('status');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    expect(titles()).toEqual([]);
    expect(status()).toBeEmptyDOMElement();
    await waitFor(() => expect(titles()).toEqual([gnosis]));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('trocar de lista descarta o rascunho da busca anterior', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const client = createQueryClient();
    const tree = (type: 'nodes' | 'sources') => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/x']}>
          <ServicesProvider services={services}>
            <RecordsPage type={type} />
          </ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree('nodes'));
    await userEvent.type(box(), 'rascunho');
    rerender(tree('sources'));
    expect(box()).toHaveValue('');
    expect(
      screen.getByRole('search', { name: 'Busca de fontes' }),
    ).toBeVisible();
  });
});
