import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { ServicesProvider } from '../../src/app/services';
import { createQueryClient } from '../../src/app/queryClient';
import { createFixtureServices } from '../../src/dev/fixtures';
async function open(path: string, logged = true) {
  const services = createFixtureServices();
  if (logged) await services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <App />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('navegação autenticada', () => {
  it('pede login antes de carregar dados', async () => {
    await open('/map', false);
    expect(
      await screen.findByRole('button', { name: /Entrar na demonstração/ }),
    ).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it('navega com teclado e encerra sessão', async () => {
    const user = userEvent.setup();
    await open('/map');
    const link = await screen.findByRole('link', { name: 'Importações' });
    link.focus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importações' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(
      await screen.findByRole('button', { name: /Entrar na demonstração/ }),
    ).toBeVisible();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
  it.each([
    ['/imports/exemplo', 'Detalhes da importação'],
    ['/access-denied', 'Acesso negado'],
    ['/inexistente', 'Página não encontrada'],
  ])('resolve %s', async (path, title) => {
    await open(path);
    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeVisible();
  });
});
