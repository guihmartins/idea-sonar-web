import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { ServicesProvider } from '../../src/app/services';
import { createQueryClient } from '../../src/app/queryClient';
import { createFixtureServices } from '../../src/dev/fixtures';
async function openMap() {
  const services = createFixtureServices();
  await services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/map']}>
        <ServicesProvider services={services}>
          <App />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'Explorar mapa' });
}
function panel(): HTMLElement {
  const el = document.getElementById('panel-content');
  if (!el) throw new Error('Painel de detalhes não encontrado.');
  return el;
}
describe('painel do nó: lista de relações e troca de fontes', () => {
  it('abre o mapa, expande Jung, lista as relações reais e troca a seção Fontes ao selecionar outra relação', async () => {
    const user = userEvent.setup();
    await openMap();

    // Modo lista evita montar o Cytoscape real (sem canvas 2D em jsdom); o
    // painel de detalhes e a lista de relações funcionam igual em ambos os
    // modos, então isso não afeta o que este teste cobre.
    await user.click(await screen.findByRole('button', { name: 'Modo lista' }));

    await user.type(screen.getByLabelText('Buscar ponto'), 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    const result = await screen.findByRole('button', {
      name: /Jung \(exemplo fictício\)/,
    });
    await user.click(result);

    await screen.findByRole('heading', {
      name: 'Jung (exemplo fictício)',
      level: 2,
    });

    // Antes de expandir, o ponto não tem relações carregadas ainda.
    expect(
      within(panel()).getByText(
        'Nenhuma relação carregada para este ponto ainda.',
      ),
    ).toBeInTheDocument();

    // Duas expansões carregam as 3 relações do cenário fictício de Jung
    // (a API fictícia pagina 2 relações por página).
    await user.click(screen.getByRole('button', { name: 'Expandir conexões' }));
    await screen.findByText('Conexões carregadas.');
    await waitFor(() =>
      expect(within(panel()).getAllByRole('listitem')).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: 'Mais conexões' }));
    await waitFor(() =>
      expect(within(panel()).getAllByRole('listitem')).toHaveLength(3),
    );

    const relationButtons = within(panel())
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'));
    expect(relationButtons.length).toBe(3);
    expect(relationButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(relationButtons[1]).toHaveAttribute('aria-pressed', 'false');

    await screen.findByRole('heading', { name: /^Fontes/, level: 3 });

    // Clicar na segunda relação troca a seleção ativa sem sair do painel.
    await user.click(relationButtons[1]!);
    expect(relationButtons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(relationButtons[0]).toHaveAttribute('aria-pressed', 'false');
    await screen.findByRole('heading', { name: /^Fontes/, level: 3 });
  });

  it('descarta as fontes da relação ativa quando a expansão é recolhida', async () => {
    const user = userEvent.setup();
    await openMap();
    await user.click(await screen.findByRole('button', { name: 'Modo lista' }));
    await user.type(screen.getByLabelText('Buscar ponto'), 'Jung');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );

    const expand = await screen.findByRole('button', {
      name: 'Expandir conexões',
    });
    await user.click(expand);
    await screen.findByText('Conexões carregadas.');
    const list = within(panel());
    await waitFor(() => expect(list.getAllByRole('listitem')).toHaveLength(2));
    const relationButtons = list
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-pressed'));
    expect(relationButtons).toHaveLength(2);
    await user.click(relationButtons[1]!);

    const sources = await screen.findByRole('heading', {
      name: /^Fontes/,
      level: 3,
    });
    expect(sources.parentElement).toHaveTextContent('Conceito compartilhado');

    await user.click(screen.getByRole('button', { name: 'Recolher expansão' }));
    expect(
      await screen.findByText(
        'Nenhuma relação carregada para este ponto ainda.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /^Fontes/, level: 3 }),
    ).toBeNull();
    expect(screen.queryByText('Conceito compartilhado')).toBeNull();
  });
});
