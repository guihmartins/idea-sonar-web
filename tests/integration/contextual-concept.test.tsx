import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';
import type { ImportResult, Node, Relation } from '../../src/api/domain';

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

// Conceito contextual pendente (rascunho) e, se pedido, suas contextualizações
// pendentes. O REST aceita pendente; só o lote ativa os dois.
async function seed(
  services: Services,
  options: { links?: string[]; target?: string; label?: string } = {},
) {
  await services.session.login();
  const node = (await services.api.save(
    'nodes',
    {
      kind: 'concept',
      label: options.label ?? 'Conceito contextual de teste',
      description: 'Rascunho de conceito contextual.',
      conceptScope: 'contextual',
      aliases: [],
      contexts: [ids.context],
      status: 'pending',
    },
    crypto.randomUUID(),
  )) as Node;
  const relations: Relation[] = [];
  for (const claim of options.links ?? []) {
    relations.push(
      (await services.api.save(
        'relations',
        {
          sourceId: node.id,
          targetId: options.target ?? ids.concept,
          type: 'contextualizes',
          contextId: null,
          claim,
          justification: 'Justificativa pendente.',
          evidenceStatus: 'inference',
          intensity: null,
          intensityReason: null,
          attributionNodeId: null,
          attributionText: null,
          inferenceAuthor: 'Curadoria',
          contested: false,
          contestationNote: null,
          status: 'pending',
          evidence: [],
        },
        crypto.randomUUID(),
      )) as Relation,
    );
  }
  return { node, relations };
}

async function pickIn(
  group: HTMLElement,
  term: string,
  option: string | RegExp,
  role: 'radio' | 'checkbox',
) {
  const user = userEvent.setup();
  await user.type(
    within(group).getByRole('textbox', { name: 'Buscar candidato' }),
    term,
  );
  await user.click(await within(group).findByRole(role, { name: option }));
}

async function fillNewContextual(options: { context?: boolean } = {}) {
  const user = userEvent.setup();
  await user.type(
    await screen.findByRole('textbox', { name: 'Nome' }),
    'Gnose contextual',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Descrição' }),
    'Leitura contextual do conceito.',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Tipo' }),
    'concept',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Escopo do conceito' }),
    'contextual',
  );
  if (options.context !== false)
    await pickIn(
      screen.getByRole('group', { name: 'Contextos' }),
      'fict',
      'Contexto fictício',
      'checkbox',
    );
  return user;
}

async function fillContextualization(
  user: ReturnType<typeof userEvent.setup>,
  options: { broad?: boolean } = {},
) {
  const group = await screen.findByRole('group', { name: 'Contextualização' });
  if (options.broad !== false)
    await pickIn(
      within(group).getByRole('group', { name: 'Conceito amplo' }),
      'compartilhado',
      /Conceito compartilhado fictício/,
      'radio',
    );
  await user.type(
    within(group).getByRole('textbox', {
      name: 'Afirmação da contextualização',
    }),
    'O conceito contextual especializa o amplo.',
  );
  await user.type(
    within(group).getByRole('textbox', {
      name: 'Justificativa da contextualização',
    }),
    'Justificativa sintética do teste.',
  );
  await user.type(
    within(group).getByRole('textbox', { name: 'Autoria da inferência' }),
    'Curadoria de teste',
  );
  return group;
}

const save = () => screen.getByRole('button', { name: 'Salvar registro' });
async function clickSave(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(save()).not.toBeDisabled());
  await user.click(save());
}

describe('Conceito contextual — criação', () => {
  it('só mostra o grupo Contextualização para conceito contextual ativo', async () => {
    renderEditor('/edit/nodes', createFixtureServices());
    const user = userEvent.setup();
    await screen.findByRole('option', { name: 'Conceito' });
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'concept',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
      'broad',
    );
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
      'contextual',
    );
    expect(
      screen.getByRole('group', { name: 'Contextualização' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
      'pending',
    );
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Conceito contextual pendente não precisa de relação/),
    ).toBeInTheDocument();
  });

  it('grava o ponto e a contextualização em um único lote e mostra o resultado', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    await fillContextualization(user);
    await clickSave(user);
    expect(
      await screen.findByText(/Conceito contextual criado e ativado\./),
    ).toBeInTheDocument();
    expect(saveEntity).not.toHaveBeenCalled();
    expect(importBatch).toHaveBeenCalledTimes(1);
    const [body, key] = importBatch.mock.calls[0]!;
    expect(body.idempotencyKey).toBe(key);
    expect(body).toMatchObject({
      contractVersion: '1',
      policyVersion: '1',
      origin: 'manual',
      inputSummary: 'Conceito contextual criado no editor',
      dryRun: false,
      nodes: [
        {
          op: 'create',
          kind: 'concept',
          conceptScope: 'contextual',
          label: 'Gnose contextual',
          contexts: [{ id: ids.context }],
          status: 'active',
        },
      ],
      relations: [
        {
          op: 'create',
          type: 'contextualizes',
          source: { clientRef: 'conceito' },
          target: { id: ids.concept },
          evidenceStatus: 'inference',
          inferenceAuthor: 'Curadoria de teste',
          status: 'active',
        },
      ],
    });
    const result = await importBatch.mock.results[0]!.value;
    expect(
      screen.getByRole('link', { name: 'Ver importação' }),
    ).toHaveAttribute('href', `/imports/${result.batchId}`);
    // O formulário passa a editar o ponto criado, já ativo, sem o grupo.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar ponto' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
    ).toHaveValue('active');
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    const page = await services.api.search(
      'Gnose contextual',
      { ...(await import('../../src/api/domain')).defaultFilters },
      null,
      new AbortController().signal,
    );
    expect(page.items[0]).toMatchObject({
      status: 'active',
      conceptScope: 'contextual',
    });
    const links = await services.api.nodeRelations(
      page.items[0]!.id,
      'contextualizes',
    );
    expect(links.items).toHaveLength(1);
    expect(links.items[0]).toMatchObject({
      status: 'active',
      targetId: ids.concept,
    });
  });

  it('reenvia a mesma chave se nada mudou e troca a chave depois de editar', async () => {
    const services = createFixtureServices();
    const importBatch = vi
      .spyOn(services.api, 'importBatch')
      .mockRejectedValueOnce(new Error('Rede instável'));
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    await fillContextualization(user);
    await clickSave(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Rede instável');
    await clickSave(user);
    await screen.findByText(/Conceito contextual criado e ativado\./);
    expect(importBatch.mock.calls[1]![1]).toBe(importBatch.mock.calls[0]![1]);
  });

  it('com nome repetido o lote fica pendente e o editor não finge sucesso', async () => {
    const services = createFixtureServices();
    renderEditor('/edit/nodes', services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Nome' }),
      'Conceito compartilhado fictício',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Descrição' }),
      'Mesmo nome de um conceito existente.',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Tipo' }),
      'concept',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Escopo do conceito' }),
      'contextual',
    );
    await pickIn(
      screen.getByRole('group', { name: 'Contextos' }),
      'fict',
      'Contexto fictício',
      'checkbox',
    );
    await fillContextualization(user);
    await clickSave(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'O lote foi gravado, mas 2 itens ficaram pendentes.',
    );
    expect(alert).toHaveTextContent(
      `Ponto conceito: Nome já existente (candidatos: ${ids.concept}); selecione o ID explicitamente`,
    );
    expect(alert).toHaveTextContent(
      'Relação contextualizacao: Dependência pendente',
    );
    expect(screen.queryByText(/criado e ativado/)).not.toBeInTheDocument();
    expect(
      within(alert).getByRole('link', { name: 'Ver importação' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/imports\/.+/));
    // Nada foi criado: o formulário continua novo, com o rascunho preservado.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cadastrar ponto' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Afirmação da contextualização' }),
    ).toHaveValue('O conceito contextual especializa o amplo.');
    const signal = new AbortController().signal;
    const first = await services.api.pending(null, signal);
    const second = await services.api.pending(first.nextCursor, signal);
    expect(
      [...first.items, ...second.items].map((item) => item.clientRef),
    ).toEqual(expect.arrayContaining(['conceito', 'contextualizacao']));
  });

  it('descreve a pendência no singular e sem motivo', async () => {
    const services = createFixtureServices();
    const result: ImportResult = {
      batchId: 'lote-1',
      status: 'committed_with_pending',
      created: 1,
      updated: 0,
      reused: 0,
      pending: 1,
      discarded: 0,
      clientRefToId: {},
      items: [
        {
          clientRef: 'contextualizacao',
          entityType: 'relations',
          entityId: null,
          outcome: 'pending',
          reason: null,
          candidates: [],
        },
        {
          clientRef: 'conceito',
          entityType: 'nodes',
          entityId: 'x',
          outcome: 'created',
          reason: null,
          candidates: [],
        },
      ],
      viewUrl: null,
      dryRun: false,
    };
    vi.spyOn(services.api, 'importBatch').mockResolvedValue(result);
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    await fillContextualization(user);
    await clickSave(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 item ficou pendente');
    expect(alert).toHaveTextContent(
      'Relação contextualizacao: Sem motivo informado.',
    );
    expect(within(alert).getAllByRole('listitem')).toHaveLength(1);
  });

  it('mostra os caminhos de campo quando a API recusa o lote', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'importBatch').mockRejectedValue(
      new ApiError(400, 'Dados inválidos', {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: [{ path: 'relations.0.claim', message: 'Obrigatório' }],
        requestId: 'req-lote',
      }),
    );
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    await fillContextualization(user);
    await clickSave(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Dados inválidos');
    expect(alert).toHaveTextContent('relations.0.claim Obrigatório');
    expect(screen.queryByText(/criado e ativado/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cadastrar ponto' }),
    ).toBeInTheDocument();
  });

  it('pede o conceito amplo e ao menos um contexto antes de enviar', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual({ context: false });
    await fillContextualization(user, { broad: false });
    await clickSave(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Conceito contextual ativo exige ao menos um contexto.',
    );
    await pickIn(
      screen.getByRole('group', { name: 'Contextos' }),
      'fict',
      'Contexto fictício',
      'checkbox',
    );
    await clickSave(user);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Selecione o conceito amplo que contextualiza este conceito.',
      ),
    );
    expect(importBatch).not.toHaveBeenCalled();
  });

  it('só oferece como conceito amplo os conceitos amplos ativos', async () => {
    const services = createFixtureServices();
    await services.session.login();
    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Conceito amplo pendente',
        description: 'Ainda não ativo.',
        conceptScope: 'broad',
        aliases: [],
        contexts: [],
        status: 'pending',
      },
      'k-pendente',
    );
    await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Conceito contextual ativo',
        description: 'Contextual, não serve de destino.',
        conceptScope: 'contextual',
        aliases: [],
        contexts: [],
        status: 'pending',
      },
      'k-contextual',
    );
    const search = vi.spyOn(services.api, 'search');
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    const group = await screen.findByRole('group', { name: 'Conceito amplo' });
    await user.type(
      within(group).getByRole('textbox', { name: 'Buscar candidato' }),
      'conceito',
    );
    expect(
      await within(group).findByRole('radio', {
        name: /Conceito compartilhado fictício/,
      }),
    ).toBeInTheDocument();
    expect(within(group).queryByText(/Conceito amplo pendente/)).toBeNull();
    expect(within(group).queryByText(/Conceito contextual ativo/)).toBeNull();
    expect(search).toHaveBeenLastCalledWith(
      'conceito',
      expect.objectContaining({ kind: 'concept', includePending: false }),
      null,
      expect.anything(),
    );
  });

  it('rascunho pendente segue o REST, sem lote nem relação', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const saveEntity = vi.spyOn(services.api, 'save');
    renderEditor('/edit/nodes', services);
    const user = await fillNewContextual();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
      'pending',
    );
    await clickSave(user);
    expect(await screen.findByText('Registro salvo.')).toBeInTheDocument();
    expect(importBatch).not.toHaveBeenCalled();
    expect(saveEntity).toHaveBeenCalledWith(
      'nodes',
      expect.objectContaining({
        conceptScope: 'contextual',
        status: 'pending',
      }),
      expect.any(String),
      undefined,
    );
  });
});

describe('Conceito contextual — ativação', () => {
  async function openPending(
    services: Services,
    options: Parameters<typeof seed>[1],
  ) {
    const seeded = await seed(services, options);
    renderEditor(`/edit/nodes/${seeded.node.id}`, services);
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Editar ponto' });
    await screen.findByRole('group', { name: 'Contextos' });
    return { ...seeded, user };
  }
  const activate = (user: ReturnType<typeof userEvent.setup>) =>
    user.selectOptions(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
      'active',
    );

  it('ativa o ponto e a relação pendente juntos, só com o estado no update', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const saveEntity = vi.spyOn(services.api, 'save');
    const { node, relations, user } = await openPending(services, {
      links: ['Contextualização pendente de teste'],
    });
    // O REST recusa: nenhum dos dois pode ficar ativo antes do outro.
    await expect(
      services.api.save('nodes', { status: 'active' }, 'k', node),
    ).rejects.toMatchObject({ status: 422, code: 'CONTEXT_REQUIRED' });
    await expect(
      services.api.save('relations', { status: 'active' }, 'k', relations[0]!),
    ).rejects.toMatchObject({ status: 422, code: 'INACTIVE_ENDPOINT' });
    expect(
      screen.queryByRole('group', { name: 'Contextualização' }),
    ).not.toBeInTheDocument();
    await activate(user);
    const group = await screen.findByRole('group', {
      name: 'Contextualização',
    });
    expect(
      await within(group).findByText('Contextualização pendente de teste'),
    ).toBeInTheDocument();
    expect(
      await within(group).findByText(
        'Conceito amplo: Conceito compartilhado fictício · Ativo',
      ),
    ).toBeInTheDocument();
    expect(
      within(group).queryByRole('textbox', {
        name: 'Afirmação da contextualização',
      }),
    ).not.toBeInTheDocument();
    saveEntity.mockClear();
    await clickSave(user);
    expect(
      await screen.findByText(/Conceito contextual ativado\./),
    ).toBeInTheDocument();
    expect(importBatch).toHaveBeenCalledTimes(1);
    const [body, key] = importBatch.mock.calls[0]!;
    expect(body.idempotencyKey).toBe(key);
    expect(body).toMatchObject({
      origin: 'manual',
      inputSummary: 'Conceito contextual ativado no editor',
      dryRun: false,
    });
    expect(body.nodes).toEqual([
      {
        op: 'update',
        clientRef: 'conceito',
        id: node.id,
        expectedVersion: node.version,
        status: 'active',
      },
    ]);
    expect(body.relations).toEqual([
      {
        op: 'update',
        clientRef: 'contextualizacao',
        id: relations[0]!.id,
        expectedVersion: relations[0]!.version,
        status: 'active',
      },
    ]);
    expect(saveEntity).not.toHaveBeenCalled();
    expect(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
    ).toHaveValue('active');
    await waitFor(() =>
      expect(
        screen.queryByRole('group', { name: 'Contextualização' }),
      ).not.toBeInTheDocument(),
    );
    expect(await services.api.detail('nodes', node.id)).toMatchObject({
      status: 'active',
      version: node.version + 1,
    });
    expect(
      await services.api.detail('relations', relations[0]!.id),
    ).toMatchObject({ status: 'active', version: relations[0]!.version + 1 });
  });

  it('leva junto a edição da descrição feita na mesma gravação', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const { node, user } = await openPending(services, {
      links: ['Contextualização pendente de teste'],
    });
    const description = screen.getByRole('textbox', { name: 'Descrição' });
    await user.clear(description);
    await user.type(description, 'Descrição revisada.');
    await activate(user);
    await screen.findByText('Contextualização pendente de teste');
    await clickSave(user);
    await screen.findByText(/Conceito contextual ativado\./);
    expect(importBatch.mock.calls[0]![0].nodes).toEqual([
      {
        op: 'update',
        clientRef: 'conceito',
        id: node.id,
        expectedVersion: node.version,
        status: 'active',
        description: 'Descrição revisada.',
      },
    ]);
    expect(await services.api.detail('nodes', node.id)).toMatchObject({
      description: 'Descrição revisada.',
    });
  });

  it('sem relação pendente explica e oferece o grupo para criá-la no mesmo lote', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const { node, user } = await openPending(services, {});
    await activate(user);
    expect(
      await screen.findByText(
        /Este conceito não tem relação de contextualização pendente\./,
      ),
    ).toBeInTheDocument();
    await fillContextualization(user);
    await clickSave(user);
    await screen.findByText(/Conceito contextual ativado\./);
    expect(importBatch.mock.calls[0]![0].nodes).toEqual([
      expect.objectContaining({ op: 'update', id: node.id, status: 'active' }),
    ]);
    expect(importBatch.mock.calls[0]![0].relations).toEqual([
      expect.objectContaining({
        op: 'create',
        type: 'contextualizes',
        source: { id: node.id },
        target: { id: ids.concept },
        status: 'active',
      }),
    ]);
    const links = await services.api.nodeRelations(node.id, 'contextualizes');
    expect(links.items).toHaveLength(1);
    expect(links.items[0]).toMatchObject({ status: 'active' });
    expect(await services.api.detail('nodes', node.id)).toMatchObject({
      status: 'active',
    });
  });

  it('com mais de uma relação pendente deixa escolher qual ativar', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const { relations, user } = await openPending(services, {
      links: ['Primeira contextualização', 'Segunda contextualização'],
    });
    await activate(user);
    const group = await screen.findByRole('group', {
      name: 'Contextualização',
    });
    const first = await within(group).findByRole('radio', {
      name: /Primeira contextualização/,
    });
    const second = within(group).getByRole('radio', {
      name: /Segunda contextualização/,
    });
    expect(first).toBeChecked();
    expect(second).not.toBeChecked();
    await user.click(second);
    expect(second).toBeChecked();
    expect(first).not.toBeChecked();
    await clickSave(user);
    await screen.findByText(/Conceito contextual ativado\./);
    expect(importBatch.mock.calls[0]![0].relations).toEqual([
      expect.objectContaining({
        op: 'update',
        id: relations[1]!.id,
        expectedVersion: relations[1]!.version,
      }),
    ]);
    expect(
      await services.api.detail('relations', relations[0]!.id),
    ).toMatchObject({ status: 'pending' });
  });

  it('se o conceito amplo não está ativo avisa antes e mostra as pendências depois', async () => {
    const services = createFixtureServices();
    await services.session.login();
    const broad = (await services.api.save(
      'nodes',
      {
        kind: 'concept',
        label: 'Conceito amplo ainda pendente',
        description: 'Aguardando ativação.',
        conceptScope: 'broad',
        aliases: [],
        contexts: [],
        status: 'pending',
      },
      'k-amplo',
    )) as Node;
    const { node, relations, user } = await openPending(services, {
      links: ['Contextualização para amplo pendente'],
      target: broad.id,
    });
    await activate(user);
    const group = await screen.findByRole('group', {
      name: 'Contextualização',
    });
    expect(
      await within(group).findByText(
        'Conceito amplo: Conceito amplo ainda pendente · Pendente',
      ),
    ).toBeInTheDocument();
    expect(
      within(group).getByText(/O conceito amplo não está ativo\./),
    ).toBeInTheDocument();
    await clickSave(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'O lote foi gravado, mas 2 itens ficaram pendentes.',
    );
    expect(alert).toHaveTextContent(
      'Relação contextualizacao: Relação ativa exige pontos ativos',
    );
    expect(alert).toHaveTextContent(
      'Ponto conceito: Conceito contextual ativo exige contexto e relação com conceito amplo',
    );
    expect(screen.queryByText(/ativado\./)).not.toBeInTheDocument();
    // O ponto voltou a pendente na API e o rascunho de ativação continua.
    expect(await services.api.detail('nodes', node.id)).toMatchObject({
      status: 'pending',
    });
    expect(
      await services.api.detail('relations', relations[0]!.id),
    ).toMatchObject({ status: 'pending' });
    expect(
      screen.getByRole('group', { name: 'Contextualização' }),
    ).toBeInTheDocument();
  });

  it('conflito de versão no lote abre a comparação com a versão atual', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'importBatch').mockRejectedValue(
      new ApiError(409, 'Versão foi alterada', {
        code: 'VERSION_CONFLICT',
        message: 'Versão foi alterada',
      }),
    );
    const { user } = await openPending(services, {
      links: ['Contextualização pendente de teste'],
    });
    await activate(user);
    await screen.findByText('Contextualização pendente de teste');
    await clickSave(user);
    expect(
      await screen.findByRole('group', { name: 'Conflito de edição' }),
    ).toBeInTheDocument();
  });

  it('mostra falha ao buscar a relação e tenta de novo', async () => {
    const services = createFixtureServices();
    const nodeRelations = vi.spyOn(services.api, 'nodeRelations');
    const { user } = await openPending(services, {
      links: ['Contextualização pendente de teste'],
    });
    nodeRelations.mockRejectedValueOnce(new Error('Falha ao buscar relações'));
    await activate(user);
    const group = await screen.findByRole('group', {
      name: 'Contextualização',
    });
    expect(await within(group).findByRole('alert')).toHaveTextContent(
      'Falha ao buscar relações',
    );
    await user.click(
      within(group).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await within(group).findByText('Contextualização pendente de teste'),
    ).toBeInTheDocument();
  });

  it('reativa um ponto arquivado pelo mesmo caminho', async () => {
    const services = createFixtureServices();
    const importBatch = vi.spyOn(services.api, 'importBatch');
    const { node } = await seed(services, {});
    await services.api.save('nodes', { status: 'archived' }, 'k-arq', node);
    renderEditor(`/edit/nodes/${node.id}`, services);
    const user = userEvent.setup();
    await screen.findByRole('group', { name: 'Contextos' });
    expect(
      screen.getByRole('combobox', { name: 'Estado editorial' }),
    ).toHaveValue('archived');
    await activate(user);
    await screen.findByText(
      /Este conceito não tem relação de contextualização/,
    );
    await fillContextualization(user);
    await clickSave(user);
    await screen.findByText(/Conceito contextual ativado\./);
    expect(importBatch.mock.calls[0]![0].nodes).toEqual([
      expect.objectContaining({
        op: 'update',
        id: node.id,
        expectedVersion: node.version + 1,
      }),
    ]);
  });
});
