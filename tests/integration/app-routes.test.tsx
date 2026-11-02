import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { ServicesProvider } from '../../src/app/services';
import { createQueryClient } from '../../src/app/queryClient';
import { createFixtureServices, ids } from '../../src/dev/fixtures';

function Where() {
  return <output aria-label="rota">{useLocation().pathname}</output>;
}
// `anonymous` é o modo sem token (VITE_AUTH_MODE=none): sem sessão, sem portão.
async function open(path: string, anonymous = false) {
  const services = createFixtureServices();
  await services.session.login();
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider
          services={
            anonymous
              ? { api: services.api, session: null, fictitious: false }
              : services
          }
        >
          <App />
          <Where />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, services };
}
const route = () => screen.getByLabelText('rota').textContent;
// Espera o título aparecer e ficar visível (a árvore pode ser remontada pelo
// redirecionamento antes de estabilizar).
const title = (name: string) =>
  waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name })).toBeVisible(),
  );

describe('rotas do App', () => {
  it.each([
    ['/nodes', 'Pontos'],
    ['/relations', 'Relações'],
    ['/sources', 'Fontes'],
    ['/contexts', 'Contextos'],
    ['/views', 'Views salvas'],
    ['/edit/nodes', 'Cadastrar ponto'],
    ['/edit/relations', 'Cadastrar relação'],
    ['/edit/sources', 'Cadastrar fonte'],
    ['/edit/contexts', 'Cadastrar contexto'],
    [`/edit/nodes/${ids.jung}`, 'Editar ponto'],
    ['/edit/imports', 'Tipo de cadastro inválido'],
    ['/imports', 'Importações'],
    [`/imports/${ids.import}`, 'Detalhes da importação'],
    ['/pending', 'Pendências'],
    [`/history/nodes/${ids.jung}`, 'Histórico do registro'],
    ['/history/sources/x', 'Tipo de histórico inválido'],
    ['/export', 'Exportar dados'],
    ['/access-denied', 'Acesso negado'],
    ['/map', 'Explorar mapa'],
  ])(
    '%s mostra o título "%s" e continua na mesma rota',
    async (path, title) => {
      await open(path);
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(route()).toBe(path);
    },
  );

  it.each(['/', '/login', '/callback'])(
    '%s redireciona para o mapa',
    async (path) => {
      await open(path);
      await title('Explorar mapa');
      await waitFor(() => expect(route()).toBe('/map'));
    },
  );

  it.each(['/inexistente', '/edit', '/imports/a/b', '/map/extra'])(
    '%s mostra a página não encontrada com volta ao mapa',
    async (path) => {
      await open(path);
      await title('Página não encontrada');
      expect(route()).toBe(path);
      expect(
        screen.getByRole('link', { name: 'Voltar ao mapa' }),
      ).toHaveAttribute('href', '/map');
    },
  );
});

describe('moldura do App', () => {
  it('fora do mapa mostra cabeçalho, navegação principal e conteúdo focável', async () => {
    const { container } = await open('/nodes');
    await title('Pontos');
    expect(screen.getByRole('link', { name: 'Idea Sonar' })).toHaveAttribute(
      'href',
      '/map',
    );
    expect(screen.getByText('Conhecimento em perspectiva')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByText('Seu mapa de ideias')).toBeVisible();
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Explorar mapa', '/map'],
      ['Pontos', '/nodes'],
      ['Relações', '/relations'],
      ['Fontes', '/sources'],
      ['Contextos', '/contexts'],
      ['Importações', '/imports'],
      ['Pendências', '/pending'],
      ['Sugestões', '/sugestoes'],
      ['Views salvas', '/views'],
      ['Exportar dados', '/export'],
    ]);
    expect(within(nav).getByRole('link', { name: 'Pontos' })).toHaveClass(
      'active',
    );
    expect(within(nav).getByRole('link', { name: 'Fontes' })).not.toHaveClass(
      'active',
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'conteudo');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(container.querySelector('.shell')).not.toHaveClass('shell--atlas');
    expect(container.querySelector('header.header')).not.toBeNull();
  });

  it('no mapa omite o cabeçalho e a navegação genéricos', async () => {
    const { container } = await open('/map');
    await title('Explorar mapa');
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Conhecimento em perspectiva')).toBeNull();
    expect(container.querySelector('header.header')).toBeNull();
    expect(container.querySelector('.shell')).toHaveClass('shell--atlas');
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toBeInTheDocument();
  });

  it('ao navegar, o foco vai para o conteúdo principal', async () => {
    const user = userEvent.setup();
    await open('/nodes', true);
    await title('Pontos');
    expect(screen.getByRole('main')).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'Fontes' }));
    await title('Fontes');
    expect(route()).toBe('/sources');
    expect(screen.getByRole('main')).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'Explorar mapa' }));
    await title('Explorar mapa');
    expect(route()).toBe('/map');
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('a marca do cabeçalho leva ao mapa', async () => {
    const user = userEvent.setup();
    await open('/export');
    await title('Exportar dados');
    await user.click(screen.getByRole('link', { name: 'Idea Sonar' }));
    await title('Explorar mapa');
    expect(route()).toBe('/map');
  });
});
