import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { parseEnvironment } from '../../src/config/schema';

const config = parseEnvironment({
  VITE_API_BASE_URL: 'https://api.example.com',
  VITE_OIDC_ISSUER: 'https://identity.example.com/',
  VITE_OIDC_CLIENT_ID: 'test-spa', VITE_OIDC_AUDIENCE: 'test-api',
}, false);

function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><App config={config} /></MemoryRouter>);
}

describe('estrutura de navegação', () => {
  it('redireciona raiz para mapa e indica integração pendente', () => {
    open('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Explore conexões');
    expect(screen.getByText(/Nenhum dado pessoal/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Explorar mapa' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });
  it('permite navegar com teclado', async () => {
    const user = userEvent.setup();
    open('/map');
    await user.tab();
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveFocus();
    screen.getByRole('link', { name: 'Importações' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { level: 1, name: 'Importações' })).toBeVisible();
  });
  it.each([
    ['/imports/example', 'Detalhes da importação'],
    ['/callback', 'Autenticação em preparação'],
    ['/access-denied', 'Acesso negado'],
    ['/inexistente', 'Página não encontrada'],
  ])('resolve deep link %s', (path, title) => {
    open(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible();
  });
});
