import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/client';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import type { Services } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { CandidatePicker, NodePicker } from '../../src/pages/editor/pickers';
import type { Node } from '../../src/api/domain';

function setup(ui: React.ReactNode, services: Services) {
  void services.session?.login();
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ServicesProvider services={services}>{ui}</ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function withApi(
  build: (original: Services['api']) => Partial<Services['api']>,
): Services {
  const base = createFixtureServices();
  return { ...base, api: { ...base.api, ...build(base.api) } };
}
const picked = () => screen.getByLabelText('escolhidos').textContent;

function Candidates({
  type = 'contexts',
  multiple = false,
  initial = [] as string[],
}: {
  type?: 'contexts' | 'sources';
  multiple?: boolean;
  initial?: string[];
}) {
  const [values, setValues] = useState(initial);
  return (
    <>
      <CandidatePicker
        type={type}
        label="Escolha"
        values={values}
        multiple={multiple}
        onChange={setValues}
      />
      <output aria-label="escolhidos">{JSON.stringify(values)}</output>
    </>
  );
}
function Nodes({
  filters,
  accept,
}: {
  filters?: Partial<Parameters<Services['api']['search']>[1]>;
  accept?: (node: Node) => boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <>
      <NodePicker
        label="Ponto"
        value={value}
        onChange={setValue}
        filters={filters}
        accept={accept}
      />
      <output aria-label="escolhidos">{value}</output>
    </>
  );
}

describe('CandidatePicker', () => {
  it('escolha única: mostra a busca, o item escolhido pelo nome e limpa a seleção', async () => {
    const user = userEvent.setup();
    setup(<Candidates />, createFixtureServices());
    await user.type(screen.getByLabelText('Buscar candidato'), 'Contexto');
    expect(await screen.findByText('Buscando candidatos…')).toBeVisible();
    const option = await screen.findByRole('radio', {
      name: 'Contexto fictício',
    });
    expect(screen.queryByText('Buscando candidatos…')).not.toBeInTheDocument();
    expect(option).not.toBeChecked();
    await user.click(option);
    expect(picked()).toBe(JSON.stringify([ids.context]));
    expect(option).toBeChecked();
    expect(
      await screen.findByText('Selecionado: Contexto fictício'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(picked()).toBe('[]');
    expect(option).not.toBeChecked();
    expect(
      screen.queryByRole('button', { name: 'Limpar seleção' }),
    ).not.toBeInTheDocument();
  });

  it('escolha única troca o item em vez de somar', async () => {
    const user = userEvent.setup();
    setup(<Candidates initial={['ctx-antigo']} />, createFixtureServices());
    expect(screen.getByText('Selecionado: ctx-antigo')).toBeVisible();
    await user.type(screen.getByLabelText('Buscar candidato'), 'Contexto');
    await user.click(
      await screen.findByRole('radio', { name: 'Contexto fictício' }),
    );
    expect(picked()).toBe(JSON.stringify([ids.context]));
  });

  it('escolha múltipla: marcar e desmarcar preserva os outros; Remover tira só o item', async () => {
    const user = userEvent.setup();
    setup(
      <Candidates type="sources" multiple initial={['outra-fonte']} />,
      createFixtureServices(),
    );
    const title = 'Fonte sintética de demonstração · Autor fictício';
    await user.type(screen.getByLabelText('Buscar candidato'), 'Fonte');
    const box = await screen.findByRole('checkbox', { name: title });
    await user.click(box);
    expect(picked()).toBe(JSON.stringify(['outra-fonte', ids.source]));
    expect(
      screen.queryByRole('button', { name: 'Limpar seleção' }),
    ).not.toBeInTheDocument();
    await user.click(box);
    expect(picked()).toBe(JSON.stringify(['outra-fonte']));
    await user.click(box);
    await user.click(
      await screen.findByRole('button', { name: `Remover ${title}` }),
    );
    expect(picked()).toBe(JSON.stringify(['outra-fonte']));
    await user.click(
      screen.getByRole('button', { name: 'Remover outra-fonte' }),
    );
    expect(picked()).toBe('[]');
  });

  it('busca com termo aparado, sem resultados e com aviso de mais páginas', async () => {
    const candidates = vi.fn();
    const services = withApi(() => ({ candidates }));
    candidates.mockResolvedValueOnce({ items: [], nextCursor: null });
    const user = userEvent.setup();
    setup(<Candidates />, services);
    expect(screen.queryByText('Nenhum candidato.')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar candidato'), '  zzz  ');
    expect(await screen.findByText('Nenhum candidato.')).toBeVisible();
    expect(candidates.mock.calls[0]?.[1]).toBe('zzz');
    expect(
      screen.queryByText('Há mais resultados. Refine a busca.'),
    ).not.toBeInTheDocument();
    candidates.mockResolvedValueOnce({
      items: [{ id: 'c1', label: 'Um', status: 'active' }],
      nextCursor: 'mais',
    });
    await user.clear(screen.getByLabelText('Buscar candidato'));
    await user.type(screen.getByLabelText('Buscar candidato'), 'um');
    expect(
      await screen.findByText('Há mais resultados. Refine a busca.'),
    ).toBeVisible();
    expect(screen.queryByText('Nenhum candidato.')).not.toBeInTheDocument();
  });

  it('erro na busca ou no item escolhido tem nova tentativa', async () => {
    const candidates = vi.fn();
    const detail = vi.fn();
    const services = withApi((original) => {
      candidates
        .mockRejectedValueOnce(new ApiError(500, 'Busca fora do ar'))
        .mockImplementation((...args: Parameters<typeof original.candidates>) =>
          original.candidates(...args),
        );
      detail
        .mockRejectedValueOnce(new ApiError(500, 'Item fora do ar'))
        .mockImplementation((...args: Parameters<typeof original.detail>) =>
          original.detail(...args),
        );
      return { candidates, detail } as Partial<Services['api']>;
    });
    const user = userEvent.setup();
    setup(<Candidates initial={[ids.context]} />, services);
    const itemAlert = await screen.findByRole('alert');
    expect(itemAlert).toHaveTextContent('Item fora do ar');
    await user.click(
      within(itemAlert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByText('Selecionado: Contexto fictício'),
    ).toBeVisible();
    await user.type(screen.getByLabelText('Buscar candidato'), 'Contexto');
    const searchAlert = await screen.findByRole('alert');
    expect(searchAlert).toHaveTextContent('Busca fora do ar');
    await user.click(
      within(searchAlert).getByRole('button', { name: 'Tentar novamente' }),
    );
    expect(
      await screen.findByRole('radio', { name: 'Contexto fictício' }),
    ).toBeVisible();
    expect(candidates).toHaveBeenCalledTimes(2);
  });
});

describe('NodePicker', () => {
  it('lista pontos com tipo, descrição e ID, e guarda o escolhido pelo nome', async () => {
    const user = userEvent.setup();
    setup(<Nodes />, createFixtureServices());
    expect(screen.queryByText(/^Selecionado:/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar candidato'), 'Jung');
    expect(await screen.findByText('Buscando candidatos…')).toBeVisible();
    const option = await screen.findByRole('radio', {
      name: `Jung (exemplo fictício) · Pessoa · Registro sintético para testar a interface; não é uma afirmação histórica. · ID ${ids.jung}`,
    });
    await user.click(option);
    expect(picked()).toBe(ids.jung);
    expect(option).toBeChecked();
    expect(
      await screen.findByText('Selecionado: Jung (exemplo fictício)'),
    ).toBeVisible();
    expect(screen.queryByText('Buscando candidatos…')).not.toBeInTheDocument();
  });

  it('envia os filtros à API, com pendentes, e descarta o que o filtro de cliente recusa', async () => {
    const search = vi.fn();
    const services = withApi((original) => {
      search.mockImplementation((...args: Parameters<typeof original.search>) =>
        original.search(...args),
      );
      return { search } as Partial<Services['api']>;
    });
    const user = userEvent.setup();
    setup(
      <Nodes
        filters={{ kind: 'person' }}
        accept={(node) => node.label.startsWith('Jung')}
      />,
      services,
    );
    await user.type(screen.getByLabelText('Buscar candidato'), '  fictício ');
    await screen.findByRole('radio', { name: /^Jung/ });
    expect(search.mock.calls[0]?.[0]).toBe('fictício');
    expect(search.mock.calls[0]?.[1]).toMatchObject({
      kind: 'person',
      includePending: true,
    });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByText('Nenhum candidato.')).not.toBeInTheDocument();
  });

  it('sem nenhum aceito e sem próxima página, avisa; com próxima página, oferece mais', async () => {
    const search = vi.fn();
    const services = withApi(() => ({ search }) as Partial<Services['api']>);
    const user = userEvent.setup();
    search.mockResolvedValueOnce({ items: [], nextCursor: null });
    setup(<Nodes />, services);
    await user.type(screen.getByLabelText('Buscar candidato'), 'nada');
    expect(await screen.findByText('Nenhum candidato.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Mais candidatos' }),
    ).not.toBeInTheDocument();
    const node = (id: string, label: string) => ({
      id,
      label,
      kind: 'work' as const,
      description: 'd',
      status: 'active' as const,
    });
    search.mockResolvedValueOnce({
      items: [node('a', 'Primeiro')],
      nextCursor: 'p2',
    });
    await user.clear(screen.getByLabelText('Buscar candidato'));
    await user.type(screen.getByLabelText('Buscar candidato'), 'obra');
    const more = await screen.findByRole('button', { name: 'Mais candidatos' });
    expect(screen.queryByText('Nenhum candidato.')).not.toBeInTheDocument();
    expect(more).toBeEnabled();
    search.mockResolvedValueOnce({
      items: [node('b', 'Segundo')],
      nextCursor: null,
    });
    await user.click(more);
    expect(await screen.findByRole('radio', { name: /Segundo/ })).toBeVisible();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Mais candidatos' }),
    ).not.toBeInTheDocument();
  });

  it('erros na busca e no ponto escolhido têm nova tentativa', async () => {
    const search = vi.fn();
    const node = vi.fn();
    const services = withApi((original) => {
      search
        .mockRejectedValueOnce(new ApiError(500, 'Busca de pontos fora do ar'))
        .mockImplementation((...args: Parameters<typeof original.search>) =>
          original.search(...args),
        );
      node
        .mockRejectedValueOnce(new ApiError(500, 'Ponto fora do ar'))
        .mockImplementation((...args: Parameters<typeof original.node>) =>
          original.node(...args),
        );
      return { search, node } as Partial<Services['api']>;
    });
    const user = userEvent.setup();
    setup(<Nodes />, services);
    await user.type(screen.getByLabelText('Buscar candidato'), 'Jung');
    const searchAlert = await screen.findByRole('alert');
    expect(searchAlert).toHaveTextContent('Busca de pontos fora do ar');
    await user.click(
      within(searchAlert).getByRole('button', { name: 'Tentar novamente' }),
    );
    await user.click(await screen.findByRole('radio', { name: /^Jung/ }));
    const nodeAlert = await screen.findByRole('alert');
    expect(nodeAlert).toHaveTextContent('Ponto fora do ar');
    expect(screen.getByText(`Selecionado: ${ids.jung}`)).toBeVisible();
    await user.click(
      within(nodeAlert).getByRole('button', { name: 'Tentar novamente' }),
    );
    await waitFor(() =>
      expect(
        screen.getByText('Selecionado: Jung (exemplo fictício)'),
      ).toBeVisible(),
    );
  });
});
