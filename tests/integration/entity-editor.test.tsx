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
    await user.click(screen.getByRole('button', { name: 'Salvar registro' }));
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(
      'relations',
      expect.objectContaining({
        sourceId: ids.jung,
        targetId: ids.gnosis,
        type: 'influenced',
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
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Classificação da evidência' }),
      'inference',
    );
    expect(
      screen.getByRole('textbox', { name: 'Autoria da inferência' }),
    ).toBeInTheDocument();
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
    ).toBeInTheDocument();
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
    await user.type(
      within(fieldset).getByRole('textbox', { name: 'Buscar candidato' }),
      'zzz-nenhum',
    );
    expect(
      await within(fieldset).findByText('Nenhum candidato.'),
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
    renderEditor(`/edit/nodes/${ids.jung}`);
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
