import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { EntityEditor } from '../../src/pages/EntityEditor';

function renderEditor(path: string) {
  const services = createFixtureServices();
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
/** Campo de texto pelo rótulo: tag, id, obrigatoriedade e limite de tamanho. */
function shape(label: string | RegExp) {
  const field = screen.getByLabelText(label);
  return {
    tag: field.tagName.toLowerCase(),
    id: field.id,
    required: (field as HTMLInputElement).required,
    maxLength:
      field.tagName === 'INPUT' && (field as HTMLInputElement).maxLength > 0
        ? (field as HTMLInputElement).maxLength
        : null,
  };
}
function optionTexts(label: string) {
  return within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((o) => o.textContent);
}
async function ready(path: string, heading: string) {
  renderEditor(path);
  await screen.findByRole('heading', { name: heading });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Salvar registro' }),
    ).toBeEnabled(),
  );
}

describe('EntityEditor — forma dos campos', () => {
  it('ponto: nome e descrição obrigatórios, descrição em área de texto', async () => {
    await ready('/edit/nodes', 'Cadastrar ponto');
    expect(shape('Nome')).toEqual({
      tag: 'input',
      id: 'field-nodes-label',
      required: true,
      maxLength: 200,
    });
    expect(shape('Descrição')).toEqual({
      tag: 'textarea',
      id: 'field-nodes-description',
      required: true,
      maxLength: null,
    });
    expect(shape(/^Outros nomes/)).toEqual({
      tag: 'input',
      id: 'field-nodes-aliases',
      required: false,
      maxLength: 2000,
    });
  });

  it('fonte: título e autor obrigatórios; notas em área de texto opcional', async () => {
    await ready('/edit/sources', 'Cadastrar fonte');
    expect(shape('Título')).toMatchObject({
      id: 'field-sources-title',
      required: true,
      tag: 'input',
    });
    expect(shape('Autor da fonte')).toMatchObject({
      id: 'field-sources-authorText',
      required: true,
    });
    expect(shape(/^URL da fonte/)).toMatchObject({
      id: 'field-sources-canonicalUrl',
      required: false,
    });
    expect(shape('Publicação')).toMatchObject({
      id: 'field-sources-publicationLabel',
      required: false,
      tag: 'input',
    });
    expect(shape('DOI')).toMatchObject({
      id: 'field-sources-doi',
      required: false,
    });
    expect(shape('Notas')).toMatchObject({
      id: 'field-sources-notes',
      required: false,
      tag: 'textarea',
    });
  });

  it('contexto: nome obrigatório e notas em área de texto opcional', async () => {
    await ready('/edit/contexts', 'Cadastrar contexto');
    expect(shape('Nome')).toMatchObject({
      id: 'field-contexts-label',
      required: true,
      maxLength: 200,
    });
    expect(shape('Região')).toMatchObject({
      id: 'field-contexts-regionLabel',
      required: false,
    });
    expect(shape('Notas')).toMatchObject({
      id: 'field-contexts-notes',
      required: false,
      tag: 'textarea',
    });
  });

  it('relação: afirmação e justificativa obrigatórias em áreas de texto; contestação só quando marcada', async () => {
    await ready('/edit/relations', 'Cadastrar relação');
    expect(shape('Afirmação')).toMatchObject({
      id: 'field-relations-claim',
      required: true,
      tag: 'textarea',
    });
    expect(shape('Justificativa')).toMatchObject({
      id: 'field-relations-justification',
      required: true,
      tag: 'textarea',
    });
    expect(shape('Justificativa da intensidade')).toMatchObject({
      id: 'field-relations-intensityReason',
      required: false,
      tag: 'input',
    });
    expect(
      screen.queryByLabelText('Nota de contestação'),
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByLabelText('Relação contestada'));
    expect(shape('Nota de contestação')).toMatchObject({
      id: 'field-relations-contestationNote',
      required: true,
      tag: 'textarea',
    });
    const predicate = screen.getByLabelText('Predicado');
    expect(predicate).toBeRequired();
    const options = within(predicate)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options[0]).toBe('Selecione');
    expect(options).toContain('estudou');
    expect(options).toContain('paralelo a (simétrica)');
    expect(options).not.toContain('estudou (simétrica)');
    const intensity = screen.getByLabelText('Intensidade');
    expect(
      within(intensity)
        .getAllByRole('option')
        .map((o) => [o.getAttribute('value'), o.textContent])
        .sort(),
    ).toEqual([
      ['', 'Não avaliada'],
      ['1', '1 — Pontual'],
      ['2', '2 — Relevante'],
      ['3', '3 — Central'],
    ]);
  });

  it('relação: as opções de intensidade seguem a ordem de exibição, com "Não avaliada" primeiro', async () => {
    await ready('/edit/relations', 'Cadastrar relação');
    // Chaves inteiras ('1'..'3') vêm antes de '' num objeto: a ordem vem da lista.
    expect(optionTexts('Intensidade')).toEqual([
      'Não avaliada',
      '1 — Pontual',
      '2 — Relevante',
      '3 — Central',
    ]);
    expect(
      within(screen.getByLabelText('Intensidade')).getByRole('option', {
        name: 'Não avaliada',
      }),
    ).toHaveValue('');
    expect(screen.getByLabelText('Intensidade')).toHaveValue('');
    expect(optionTexts('Classificação da evidência')).toEqual([
      'Documentada',
      'Interpretação atribuída',
      'Inferência / hipótese',
    ]);
  });

  it('ponto: tipo na ordem do catálogo e escopo do conceito com "Selecione" primeiro', async () => {
    await ready('/edit/nodes', 'Cadastrar ponto');
    expect(optionTexts('Tipo')).toEqual([
      'Pessoa',
      'Tradição',
      'Conceito',
      'Obra',
      'Figura',
    ]);
    expect(optionTexts('Precisão do período')).toEqual([
      'Desconhecida',
      'Aproximada',
      'Intervalo',
      'Exata',
    ]);
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'concept');
    expect(optionTexts('Escopo do conceito')).toEqual([
      'Selecione',
      'Conceito amplo',
      'Interpretação contextualizada',
    ]);
  });

  it('o link de volta nomeia a lista do tipo e o título troca entre Cadastrar e Editar', async () => {
    renderEditor('/edit/sources');
    expect(
      await screen.findByRole('heading', { name: 'Cadastrar fonte' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar a fontes' }),
    ).toHaveAttribute('href', '/sources');
  });

  it('editar um ponto usa "Editar" e mantém o estado arquivado como opção', async () => {
    renderEditor(`/edit/nodes/${ids.jung}`);
    expect(
      await screen.findByRole('heading', { name: 'Editar ponto' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voltar a pontos' }),
    ).toHaveAttribute('href', '/nodes');
    const status = screen.getByLabelText('Estado editorial');
    expect(
      within(status)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Ativo', 'Pendente']);
  });
});
