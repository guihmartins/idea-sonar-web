import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';

function renderEditor(path: string, services = createFixtureServices()) {
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
  return services;
}

describe('EntityEditor — roteamento', () => {
  it('rejeita tipo de cadastro inválido', async () => {
    renderEditor('/edit/imports');
    expect(
      await screen.findByText('Tipo de cadastro inválido'),
    ).toBeInTheDocument();
  });

  it('não consulta registros para tipo inválido mesmo com identificador', async () => {
    const services = createFixtureServices();
    const detail = vi.spyOn(services.api, 'detail');
    renderEditor('/edit/imports/id-inválido', services);
    expect(
      await screen.findByText('Tipo de cadastro inválido'),
    ).toBeInTheDocument();
    expect(detail).not.toHaveBeenCalled();
  });

  it('mostra falha ao carregar o registro existente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'detail').mockRejectedValue(
      new Error('Falha ao carregar registro'),
    );
    renderEditor(`/edit/nodes/${ids.jung}`, services);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao carregar registro',
    );
  });

  it('mostra erro comum de salvamento sem abrir o painel de conflito', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'save').mockRejectedValue(
      new Error('Falha interna ao salvar'),
    );
    renderEditor(`/edit/nodes/${ids.jung}`, services);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Salvar registro' }),
      ).not.toBeDisabled(),
    );
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha interna ao salvar',
    );
    expect(
      screen.queryByRole('group', { name: 'Conflito de edição' }),
    ).not.toBeInTheDocument();
  });

  it('mostra carregamento inicial de catálogos', () => {
    renderEditor('/edit/nodes');
    expect(screen.getByText('Carregando catálogos…')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salvar registro' }),
    ).toBeDisabled();
  });

  it('mostra falha de catálogo e de opções com tentar novamente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const catalog = vi
      .spyOn(services.api, 'catalog')
      .mockRejectedValueOnce(new Error('Falha no catálogo'))
      .mockResolvedValue({
        nodeKinds: ['person'],
        relationTypes: [],
        evidenceStatuses: ['documented'],
        editorialStatuses: ['active'],
        intensities: [],
      });
    const list = vi
      .spyOn(services.api, 'list')
      .mockRejectedValueOnce(new Error('Falha nas opções'))
      .mockResolvedValue({ items: [], nextCursor: null });
    renderEditor('/edit/sources', services);
    expect(await screen.findByText('Falha no catálogo')).toBeInTheDocument();
    expect(screen.getByText('Falha nas opções')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole('button', { name: 'Tentar novamente' })[0]!,
    );
    expect(catalog).toHaveBeenCalledTimes(2);
    await user.click(
      screen.getAllByRole('button', { name: 'Tentar novamente' })[0]!,
    );
    expect(list).toHaveBeenCalled();
  });
});

describe('EntityEditor — pontos', () => {
  it('inicia o cadastro de ponto com os valores padrão seguros', async () => {
    renderEditor('/edit/nodes');
    await screen.findByRole('option', { name: 'Pessoa' });
    expect(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
    ).toHaveValue('active');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveValue(
      'person',
    );
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toBeRequired();
    expect(
      screen.getByRole('textbox', {
        name: 'Outros nomes (separados por vírgula; idioma opcional, ex.: Jung (de))',
      }),
    ).toHaveValue('');
  });

  it('cadastra um ponto do tipo conceito com escopo e contexto', async () => {
    const services = createFixtureServices();
    const save = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Novo conceito',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Descrição' }),
      'Descrição do conceito',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'concept',
    );
    expect(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
    ).toHaveValue('');
    expect(
      screen.getByRole('option', { name: 'Selecione' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
      'broad',
    );
    const contextCheckbox = await screen.findByRole('checkbox', {
      name: 'Contexto fictício',
    });
    await user.click(contextCheckbox);
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({
        kind: 'concept',
        label: 'Novo conceito',
        conceptScope: 'broad',
        contexts: [ids.context],
      }),
      expect.any(String),
      undefined,
    );
  });

  it('mostra erro de validação ao faltar escopo do conceito', async () => {
    renderEditor('/edit/nodes');
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Sem escopo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Descrição' }),
      'Descrição qualquer',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'concept',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Conceitos exigem escopo',
    );
  });

  it('desabilita tipo e escopo ao editar um ponto existente e mostra ausência de contextos', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'list').mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    renderEditor(`/edit/nodes/${ids.concept}`, services);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar ponto' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
    ).toBeDisabled();
    expect(
      await screen.findByText('Nenhum contexto cadastrado.'),
    ).toBeInTheDocument();
  });
});

describe('EntityEditor — fontes', () => {
  it('inicia o cadastro de fonte com campos opcionais vazios', async () => {
    renderEditor('/edit/sources');
    expect(await screen.findByRole('textbox', { name: 'Título' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: 'Título' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Autor da fonte' })).toHaveValue(
      '',
    );
    expect(
      screen.getByRole('textbox', { name: 'Autor da fonte' }),
    ).toBeRequired();
    expect(
      screen.getByRole('textbox', { name: 'URL da fonte (HTTP/HTTPS)' }),
    ).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Publicação' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'DOI' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('');
  });

  it('preenche os dados recuperáveis da fonte ao editar', async () => {
    renderEditor(`/edit/sources/${ids.source}`);
    expect(await screen.findByRole('textbox', { name: 'Título' })).toHaveValue(
      'Fonte sintética de demonstração',
    );
    expect(screen.getByRole('textbox', { name: 'Autor da fonte' })).toHaveValue(
      'Autor fictício',
    );
    expect(
      screen.getByRole('textbox', { name: 'URL da fonte (HTTP/HTTPS)' }),
    ).toHaveValue('https://example.com/fonte-ficticia');
    expect(screen.getByRole('textbox', { name: 'Publicação' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'DOI' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('');
  });

  it('rejeita fonte sem referência recuperável', async () => {
    renderEditor('/edit/sources');
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Título' }),
      'Fonte sem referência',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autor da fonte' }),
      'Autor',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'fonte seja recuperável',
    );
  });

  it('cadastra uma fonte válida com URL', async () => {
    renderEditor('/edit/sources');
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Título' }),
      'Fonte válida',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autor da fonte' }),
      'Autor',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'URL da fonte (HTTP/HTTPS)' }),
      'https://example.com/fonte',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
  });
});

describe('EntityEditor — contextos', () => {
  it('inicia o período de contexto como desconhecido, em era comum', async () => {
    renderEditor('/edit/contexts');
    expect(await screen.findByRole('textbox', { name: 'Nome' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Região' })).toHaveValue('');
    expect(
      screen.getByRole('textbox', { name: 'Rótulo do período' }),
    ).toHaveValue('');
    expect(screen.getByRole('spinbutton', { name: 'Ano inicial' })).toHaveValue(
      null,
    );
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      null,
    );
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'ce',
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'ce',
    );
    expect(
      screen.getByRole('combobox', { name: 'Precisão do período' }),
    ).toHaveValue('unknown');
  });

  it('rejeita período com fim antes do início', async () => {
    renderEditor('/edit/contexts');
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Contexto teste',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '100',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano final' }),
      '50',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'fim do período deve ser posterior',
    );
  });

  it('cadastra um contexto válido com precisão e período a.C.', async () => {
    renderEditor('/edit/contexts');
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Contexto antigo',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: 'Ano inicial' }),
      '100',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Era do início' }),
      'bce',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Precisão do período' }),
      'exact',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
  });

  it('edita um contexto existente preenchendo os campos de período', async () => {
    renderEditor(`/edit/contexts/${ids.context}`);
    expect(
      await screen.findByRole('spinbutton', { name: 'Ano inicial' }),
    ).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      100,
    );
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'bce',
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'ce',
    );
    expect(screen.getByRole('textbox', { name: 'Região' })).toHaveValue(
      'Região de teste',
    );
    expect(
      screen.getByRole('textbox', { name: 'Rótulo do período' }),
    ).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Notas' })).toHaveValue('');
  });

  it('converte anos astronômicos negativos para anos a.C. no formulário', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const context = await services.api.detail('contexts', ids.context);
    vi.spyOn(services.api, 'detail').mockResolvedValue({
      ...context,
      startYear: -99,
      endYear: -1,
    });
    renderEditor(`/edit/contexts/${ids.context}`, services);

    expect(
      await screen.findByRole('spinbutton', { name: 'Ano inicial' }),
    ).toHaveValue(100);
    expect(screen.getByRole('spinbutton', { name: 'Ano final' })).toHaveValue(
      2,
    );
    expect(screen.getByRole('combobox', { name: 'Era do início' })).toHaveValue(
      'bce',
    );
    expect(screen.getByRole('combobox', { name: 'Era do fim' })).toHaveValue(
      'bce',
    );
  });
});

describe('EntityEditor — relações', () => {
  async function pickNode(label: string, query: string, optionText: string) {
    const user = userEvent.setup();
    const fieldset = screen.getByRole('group', { name: label });
    await user.type(
      within(fieldset).getByRole('textbox', { name: 'Buscar candidato' }),
      query,
    );
    const option = await within(fieldset).findByText(
      new RegExp(optionText),
      undefined,
      { timeout: 2000 },
    );
    await user.click(option);
  }

  it('mostra os valores iniciais seguros para uma relação nova', async () => {
    renderEditor('/edit/relations');
    await screen.findByRole('group', { name: 'Ponto de origem' });
    expect(
      screen.getAllByRole('textbox', { name: 'Buscar candidato' }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('textbox', { name: 'Buscar candidato' })[0],
    ).toHaveValue('');
    expect(
      screen.getAllByRole('textbox', { name: 'Buscar candidato' })[1],
    ).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Predicado' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Predicado' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Afirmação' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Afirmação' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Justificativa' })).toHaveValue(
      '',
    );
    expect(
      screen.getByRole('textbox', { name: 'Justificativa' }),
    ).toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Contexto' })).toHaveValue('');
    expect(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
    ).toHaveValue('inference');
    expect(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
    ).toHaveValue('');
    expect(
      screen.queryByRole('textbox', { name: 'Atribuição (quem interpreta)' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Intensidade' })).toHaveValue(
      '',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Relação contestada' }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole('textbox', { name: 'Nota de contestação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Adicionar uma URL não promove a classificação automaticamente.',
      ),
    ).toBeInTheDocument();
  });

  it('gera nova chave de idempotência após editar um envio que falhou', async () => {
    const services = createFixtureServices();
    const save = vi
      .spyOn(services.api, 'save')
      .mockRejectedValueOnce(new Error('Falha transitória ao salvar'));
    renderEditor('/edit/sources', services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Título' }),
      'Fonte recuperável',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autor da fonte' }),
      'Autoria de teste',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'DOI' }),
      '10.1234/teste',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha transitória ao salvar',
    );
    const firstKey = save.mock.calls[0]?.[2];

    await user.type(screen.getByRole('textbox', { name: 'Notas' }), 'Nota');
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[2]).not.toBe(firstKey);
  });

  it('cadastra uma relação completa com evidência documentada', async () => {
    const services = createFixtureServices();
    const save = vi.spyOn(services.api, 'save');
    renderEditor('/edit/relations', services);
    await screen.findByRole('group', { name: 'Ponto de origem' });
    await pickNode('Ponto de origem', 'Jung', 'Jung');
    await pickNode('Ponto de destino', 'Gnosticismo', 'Gnosticismo');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Predicado' }),
      'influenced',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Afirmação' }),
      'Afirmação de teste',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa' }),
      'Justificativa de teste',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'documented',
    );
    await user.click(
      screen.getByRole('button', { name: 'Adicionar evidência' }),
    );
    expect(screen.getByRole('combobox', { name: 'Fonte' })).toHaveValue('');
    expect(
      screen.getByRole('combobox', { name: 'Papel da evidência' }),
    ).toHaveValue('supports');
    expect(screen.getByRole('combobox', { name: 'Tipo de fonte' })).toHaveValue(
      'secondary',
    );
    expect(
      screen.getByRole('textbox', { name: 'Localizador / página' }),
    ).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Trecho' })).toHaveValue('');
    expect(
      screen.getByRole('textbox', { name: 'Explicação da evidência' }),
    ).toHaveValue('');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Papel da evidência' }),
      'supports',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Fonte' }),
      ids.source,
    );
    const evidenceGroups = screen.getAllByRole('textbox', {
      name: 'Localizador / página',
    });
    await user.type(evidenceGroups[0]!, 'p. 10');
    await user.type(
      screen.getAllByRole('textbox', { name: 'Explicação da evidência' })[0]!,
      'Explicação de teste',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo de fonte' }),
      'secondary',
    );
    await user.type(screen.getByRole('textbox', { name: 'Trecho' }), 'Trecho');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Contexto' }),
      ids.context,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Intensidade' }),
      '2',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa da intensidade' }),
      'Relevância do vínculo',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'relations',
      expect.objectContaining({
        sourceId: ids.jung,
        targetId: ids.gnosis,
        type: 'influenced',
        contextId: ids.context,
        evidenceStatus: 'documented',
        intensity: 2,
        intensityReason: 'Relevância do vínculo',
        contested: false,
        contestationNote: null,
        evidence: [
          {
            sourceId: ids.source,
            sourceKind: 'secondary',
            stance: 'supports',
            locator: 'p. 10',
            excerpt: 'Trecho',
            explanation: 'Explicação de teste',
            conversationReference: null,
          },
        ],
      }),
      expect.any(String),
      undefined,
    );
  });

  it('salva atribuição e contestação com evidências nos dois sentidos', async () => {
    const services = createFixtureServices();
    const save = vi.spyOn(services.api, 'save');
    renderEditor('/edit/relations', services);
    await screen.findByRole('group', { name: 'Ponto de origem' });
    await pickNode('Ponto de origem', 'Jung', 'Jung');
    await pickNode('Ponto de destino', 'Gnosticismo', 'Gnosticismo');
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Predicado' }),
      'influenced',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Afirmação' }),
      'Afirmação atribuída',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa' }),
      'Justificativa completa',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'attributed_interpretation',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Atribuição (quem interpreta)' }),
      'Pesquisadora de exemplo',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Intensidade' }),
      '1',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Justificativa da intensidade' }),
      'Relação pontual',
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Relação contestada' }),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Nota de contestação' }),
      'Há leituras divergentes.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Adicionar evidência' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Adicionar evidência' }),
    );
    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Fonte' })[0]!,
      ids.source,
    );
    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Papel da evidência' })[0]!,
      'supports',
    );
    await user.type(
      screen.getAllByRole('textbox', { name: 'Localizador / página' })[0]!,
      'p. 2',
    );
    await user.type(
      screen.getAllByRole('textbox', { name: 'Explicação da evidência' })[0]!,
      'A fonte sustenta a afirmação.',
    );
    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Fonte' })[1]!,
      ids.source,
    );
    await user.selectOptions(
      screen.getAllByRole('combobox', { name: 'Papel da evidência' })[1]!,
      'challenges',
    );
    await user.type(
      screen.getAllByRole('textbox', { name: 'Localizador / página' })[1]!,
      'p. 8',
    );
    await user.type(
      screen.getAllByRole('textbox', { name: 'Explicação da evidência' })[1]!,
      'A fonte questiona a afirmação.',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'relations',
      expect.objectContaining({
        evidenceStatus: 'attributed_interpretation',
        attributionText: 'Pesquisadora de exemplo',
        inferenceAuthor: null,
        intensity: 1,
        intensityReason: 'Relação pontual',
        contested: true,
        contestationNote: 'Há leituras divergentes.',
        evidence: [
          {
            sourceId: ids.source,
            sourceKind: 'secondary',
            stance: 'supports',
            locator: 'p. 2',
            excerpt: null,
            explanation: 'A fonte sustenta a afirmação.',
            conversationReference: null,
          },
          {
            sourceId: ids.source,
            sourceKind: 'secondary',
            stance: 'challenges',
            locator: 'p. 8',
            excerpt: null,
            explanation: 'A fonte questiona a afirmação.',
            conversationReference: null,
          },
        ],
      }),
      expect.any(String),
      undefined,
    );
  });

  it('mostra campos de atribuição para interpretação atribuída e autoria para inferência', async () => {
    renderEditor('/edit/relations');
    await screen.findByRole('group', { name: 'Ponto de origem' });
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'attributed_interpretation',
    );
    expect(
      screen.getByRole('textbox', { name: 'Atribuição (quem interpreta)' }),
    ).toBeRequired();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'inference',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
      'Autoria de teste',
    );
    expect(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
    ).toBeRequired();
  });

  it('mostra campo de nota ao marcar contestação e referência de conversa para evidência de conversa', async () => {
    renderEditor('/edit/relations');
    await screen.findByRole('group', { name: 'Ponto de origem' });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('checkbox', { name: 'Relação contestada' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Nota de contestação' }),
    ).toBeRequired();
    await user.click(
      screen.getByRole('button', { name: 'Adicionar evidência' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo de fonte' }),
      'conversation',
    );
    expect(
      screen.getByRole('textbox', { name: 'Referência da conversa' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover evidência' }));
    expect(
      screen.queryByRole('textbox', { name: 'Referência da conversa' }),
    ).not.toBeInTheDocument();
  });

  it('mostra "Nenhum candidato" e permite paginar candidatos do ponto', async () => {
    renderEditor('/edit/relations');
    await screen.findByRole('group', { name: 'Ponto de origem' });
    const user = userEvent.setup();
    const fieldset = screen.getByRole('group', { name: 'Ponto de origem' });
    expect(within(fieldset).queryByText('Nenhum candidato.')).toBeNull();
    await user.type(
      within(fieldset).getByRole('textbox', { name: 'Buscar candidato' }),
      'zzz-nenhum',
    );
    expect(
      await within(fieldset).findByText('Nenhum candidato.'),
    ).toBeInTheDocument();
  });

  it('mostra carregamento enquanto a busca de candidato está pendente', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'search').mockReturnValue(new Promise(() => {}));
    renderEditor('/edit/relations', services);
    const origin = await screen.findByRole('group', {
      name: 'Ponto de origem',
    });
    await userEvent
      .setup()
      .type(
        within(origin).getByRole('textbox', { name: 'Buscar candidato' }),
        'pesquisa pendente',
      );
    expect(
      await within(origin).findByText('Buscando candidatos…'),
    ).toBeInTheDocument();
  });

  it('carrega a próxima página e seleciona um candidato encontrado', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const jung = await services.api.node(ids.jung);
    const gnosis = await services.api.node(ids.gnosis);
    const search = vi
      .spyOn(services.api, 'search')
      .mockResolvedValueOnce({ items: [jung], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ items: [gnosis], nextCursor: null });
    renderEditor('/edit/relations', services);
    const user = userEvent.setup();
    const origin = screen.getByRole('group', { name: 'Ponto de origem' });
    await user.type(
      within(origin).getByRole('textbox', { name: 'Buscar candidato' }),
      'candidato',
    );

    await user.click(await within(origin).findByText(/Jung/));
    expect(
      within(origin).queryByText('Nenhum candidato.'),
    ).not.toBeInTheDocument();
    expect(within(origin).getByRole('radio', { name: /Jung/ })).toBeChecked();
    expect(
      await within(origin).findByText(/Selecionado: Jung \(exemplo fictício\)/),
    ).toBeInTheDocument();
    await user.click(
      within(origin).getByRole('button', { name: 'Mais candidatos' }),
    );

    expect(await within(origin).findByText(/Gnosticismo/)).toBeInTheDocument();
    expect(
      within(origin).queryByRole('button', { name: 'Mais candidatos' }),
    ).not.toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
    expect(
      within(origin).getByRole('radio', { name: /Gnosticismo/ }),
    ).toBeInTheDocument();
  });

  it('mostra falha ao buscar candidato do ponto', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'search').mockRejectedValue(
      new Error('Falha na busca de candidatos'),
    );
    renderEditor('/edit/relations', services);
    await screen.findByRole('group', { name: 'Ponto de origem' });
    const user = userEvent.setup();
    const fieldset = screen.getByRole('group', { name: 'Ponto de origem' });
    await user.type(
      within(fieldset).getByRole('textbox', { name: 'Buscar candidato' }),
      'Jung',
    );
    expect(
      await within(fieldset).findByRole('alert', undefined, {
        timeout: 2000,
      }),
    ).toHaveTextContent('Falha na busca de candidatos');
  });

  it('edita uma relação existente mostrando o ponto selecionado e erro ao recarregar', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'node').mockRejectedValue(
      new Error('Falha ao carregar ponto'),
    );
    renderEditor(`/edit/relations/${ids.relation}`, services);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Editar relação',
      }),
    ).toBeInTheDocument();
    const fieldset = screen.getByRole('group', { name: 'Ponto de origem' });
    expect(await within(fieldset).findByRole('alert')).toHaveTextContent(
      'Falha ao carregar ponto',
    );
  });

  it('remove evidência da relação editada antes de salvar', async () => {
    const services = createFixtureServices();
    const save = vi.spyOn(services.api, 'save');
    renderEditor(`/edit/relations/${ids.relation}`, services);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Editar relação',
    });
    const user = userEvent.setup();
    const remove = await screen.findAllByRole('button', {
      name: 'Remover evidência',
    });
    await user.click(remove[0]!);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'inference',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
      'Autoria de teste',
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Relação contestada' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'relations',
      expect.objectContaining({ evidence: [] }),
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe('EntityEditor — arquivamento e histórico', () => {
  it('oferece histórico para pontos e relações, mas não para fontes', async () => {
    renderEditor(`/edit/nodes/${ids.jung}`);
    expect(
      await screen.findByRole('link', { name: 'Ver histórico' }),
    ).toHaveAttribute('href', `/history/nodes/${ids.jung}`);
  });

  it('não oferece histórico para fontes', async () => {
    renderEditor(`/edit/sources/${ids.source}`);
    await screen.findByRole('heading', { level: 1, name: 'Editar fonte' });
    expect(
      screen.queryByRole('link', { name: 'Ver histórico' }),
    ).not.toBeInTheDocument();
  });

  it('arquiva um registro após confirmação', async () => {
    const services = createFixtureServices();
    const save = vi.spyOn(services.api, 'save');
    renderEditor(`/edit/nodes/${ids.jung}`, services);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Arquivar registro' }),
    );
    const confirm = screen.getByRole('group', {
      name: 'Confirmar arquivamento',
    });
    await user.click(
      within(confirm).getByRole('button', { name: 'Confirmar arquivamento' }),
    );
    expect(
      await screen.findByText('Registro arquivado pela API.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Arquivar registro' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
    ).toHaveValue('archived');
    expect(
      within(
        screen.getByRole('combobox', { name: 'Estado editorial' }),
      ).getByRole('option', { name: 'Arquivado' }),
    ).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'nodes',
      { status: 'archived' },
      expect.any(String),
      expect.objectContaining({ id: ids.jung }),
    );
  });

  it('cancela a confirmação de arquivamento', async () => {
    renderEditor(`/edit/nodes/${ids.jung}`);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Arquivar registro' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar arquivamento' }),
    ).not.toBeInTheDocument();
  });

  it('mostra erro ao falhar o arquivamento', async () => {
    const services = createFixtureServices();
    await services.session.login();
    vi.spyOn(services.api, 'save').mockRejectedValueOnce(
      new Error('Falha ao arquivar'),
    );
    renderEditor(`/edit/nodes/${ids.jung}`, services);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Arquivar registro' }),
    );
    const confirm = screen.getByRole('group', {
      name: 'Confirmar arquivamento',
    });
    await user.click(
      within(confirm).getByRole('button', { name: 'Confirmar arquivamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao arquivar',
    );
  });
});

describe('EntityEditor — conflito de edição', () => {
  it('mantém rascunho ao continuar sobre a versão atual', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const { ApiError } = await import('../../src/api/client');
    const original = {
      ...(await services.api.detail('nodes', ids.jung)),
      contexts: [ids.context, 'contexto-secundario'],
    };
    const latest = {
      ...original,
      version: 2,
      label: 'Versão atual da API',
      contexts: [],
    };
    const detail = vi
      .spyOn(services.api, 'detail')
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest);
    const save = vi
      .spyOn(services.api, 'save')
      .mockRejectedValueOnce(new ApiError(409, 'Conflito de edição'))
      .mockResolvedValueOnce({ ...latest, label: 'Rascunho preservado' });
    renderEditor(`/edit/nodes/${ids.jung}`, services);
    const user = userEvent.setup();
    const name = await screen.findByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.type(name, 'Rascunho preservado');
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(
      await screen.findByRole('group', { name: 'Conflito de edição' }),
    ).toBeInTheDocument();
    const comparison = screen.getByRole('group', {
      name: 'Conflito de edição',
    });
    expect(comparison).toHaveTextContent('Contextos');
    expect(comparison).toHaveTextContent(
      `Seu rascunho: ${ids.context}, contexto-secundario`,
    );
    expect(comparison).toHaveTextContent('Versão atual: (vazio)');

    await user.click(
      screen.getByRole('button', {
        name: 'Continuar editando sobre a versão atual',
      }),
    );
    expect(name).toHaveValue('Rascunho preservado');
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));

    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(detail).toHaveBeenNthCalledWith(2, 'nodes', ids.jung);
    expect(save).toHaveBeenLastCalledWith(
      'nodes',
      expect.objectContaining({ label: 'Rascunho preservado' }),
      expect.any(String),
      expect.objectContaining({ version: 2 }),
    );
  });

  it('descarta o rascunho e usa os dados atuais ao escolher a opção', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const { ApiError } = await import('../../src/api/client');
    const current = {
      id: ids.context,
      version: 2,
      status: 'active' as const,
      createdAt: '2026-10-24T12:00:00.000Z',
      updatedAt: '2026-10-24T12:00:00.000Z',
      label: 'Contexto atualizado em outra sessão',
      traditionNodeId: null,
      startYear: 0,
      endYear: 100,
      precision: 'approximate' as const,
      periodLabel: null,
      regionLabel: 'Outra região',
      notes: null,
    };
    vi.spyOn(services.api, 'detail')
      .mockResolvedValueOnce({
        id: ids.context,
        version: 1,
        status: 'active',
        createdAt: '2026-10-24T12:00:00.000Z',
        updatedAt: '2026-10-24T12:00:00.000Z',
        label: 'Contexto fictício',
        traditionNodeId: null,
        startYear: 0,
        endYear: 100,
        precision: 'approximate',
        periodLabel: null,
        regionLabel: 'Região de teste',
        notes: null,
      })
      .mockResolvedValue(current);
    vi.spyOn(services.api, 'save').mockRejectedValueOnce(
      new ApiError(409, 'Conflito'),
    );
    renderEditor(`/edit/contexts/${ids.context}`, services);
    const nameField = await screen.findByRole('textbox', { name: 'Nome' });
    const user = userEvent.setup();
    await user.clear(nameField);
    await user.type(nameField, 'Meu rascunho de nome');
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    const comparison = await screen.findByRole('group', {
      name: 'Conflito de edição',
    });
    expect(comparison).toHaveTextContent('Contexto atualizado em outra sessão');
    expect(comparison).toHaveTextContent('Seu rascunho: Meu rascunho de nome');
    expect(comparison).toHaveTextContent(
      'Versão atual: Contexto atualizado em outra sessão',
    );
    expect(comparison).toHaveTextContent('Seu rascunho: Região de teste');
    expect(comparison).toHaveTextContent('Versão atual: Outra região');
    await user.click(
      within(comparison).getByRole('button', {
        name: 'Usar dados atuais e descartar rascunho',
      }),
    );
    expect(
      screen.queryByRole('group', { name: 'Conflito de edição' }),
    ).not.toBeInTheDocument();
    expect(nameField).toHaveValue('Contexto atualizado em outra sessão');
  });

  it('compara evidências e contestação no conflito de uma relação', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const { ApiError } = await import('../../src/api/client');
    const original = await services.api.relation(ids.relation);
    const contestedEvidence = [
      {
        sourceId: null,
        sourceKind: 'conversation' as const,
        stance: 'supports' as const,
        excerpt: null,
        locator: 'mensagem 7',
        explanation: 'Evidência favorável do rascunho.',
        conversationReference: 'conversa original, mensagem 7',
      },
      {
        sourceId: null,
        sourceKind: 'conversation' as const,
        stance: 'challenges' as const,
        excerpt: null,
        locator: 'mensagem 8',
        explanation: 'Evidência contrária do rascunho.',
        conversationReference: 'conversa original, mensagem 8',
      },
    ];
    const draft = {
      ...original,
      evidenceStatus: 'inference' as const,
      inferenceAuthor: 'Autoria do rascunho',
      evidence: contestedEvidence,
      contested: true,
      contestationNote: 'Contestação do rascunho.',
    };
    const latest = {
      ...draft,
      version: 2,
      evidence: [
        {
          sourceId: null,
          sourceKind: 'conversation' as const,
          stance: 'supports' as const,
          excerpt: null,
          locator: 'mensagem 8',
          explanation: 'Evidência da versão atual.',
          conversationReference: 'conversa atual',
        },
      ],
      contested: false,
      contestationNote: 'Nota da versão atual.',
    };
    vi.spyOn(services.api, 'detail')
      .mockResolvedValueOnce(draft)
      .mockResolvedValue(latest);
    vi.spyOn(services.api, 'save').mockRejectedValueOnce(
      new ApiError(409, 'Conflito de edição'),
    );
    renderEditor(`/edit/relations/${ids.relation}`, services);
    const user = userEvent.setup();
    const claim = await screen.findByRole('textbox', { name: 'Afirmação' });
    await user.clear(claim);
    await user.type(claim, 'Afirmação do rascunho');
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));

    const comparison = await screen.findByRole('group', {
      name: 'Conflito de edição',
    });
    expect(
      within(comparison).queryByText('Estado editorial'),
    ).not.toBeInTheDocument();
    expect(within(comparison).getByText('Evidências')).toBeInTheDocument();
    expect(within(comparison).getByText('Contestação')).toBeInTheDocument();
    expect(
      within(comparison).getByText(/Evidência da versão atual\./, {
        selector: 'pre',
      }),
    ).toBeInTheDocument();
    expect(
      within(comparison).getByText(/Versão atual:/, { selector: 'pre' }),
    ).toBeInTheDocument();
    expect(comparison).toHaveTextContent('Nota da versão atual.');
    expect(comparison).toHaveTextContent('Seu rascunho: Sim');
    expect(comparison).toHaveTextContent('Versão atual: Não');
  });

  it('mostra mensagem quando não é possível recarregar o conflito', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const { ApiError } = await import('../../src/api/client');
    vi.spyOn(services.api, 'detail')
      .mockResolvedValueOnce({
        id: ids.context,
        version: 1,
        status: 'active',
        createdAt: '2026-10-24T12:00:00.000Z',
        updatedAt: '2026-10-24T12:00:00.000Z',
        label: 'Contexto fictício',
        traditionNodeId: null,
        startYear: 0,
        endYear: 100,
        precision: 'approximate',
        periodLabel: null,
        regionLabel: 'Região de teste',
        notes: null,
      })
      .mockRejectedValue(new Error('Falha ao recarregar'));
    vi.spyOn(services.api, 'save').mockRejectedValueOnce(
      new ApiError(412, 'Conflito'),
    );
    renderEditor(`/edit/contexts/${ids.context}`, services);
    await screen.findByRole('textbox', { name: 'Nome' });
    const user = userEvent.setup();
    const saveButton = screen.getByRole('button', { name: 'Salvar registro' });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await user.click(saveButton);
    expect(
      await screen.findByText(
        'Não foi possível carregar a versão atual. Tente salvar novamente para recarregar o conflito.',
      ),
    ).toBeInTheDocument();
  });
});
