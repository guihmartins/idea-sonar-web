import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import {
  ServicesProvider,
  SessionGate,
  useServices,
} from '../../src/app/services';
import { ApiError } from '../../src/api/client';
import type { Services } from '../../src/app/services';
import type { Session } from '../../src/auth/session';
import { createFixtureServices } from '../../src/dev/fixtures';

function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    authenticated: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    callback: vi.fn().mockResolvedValue(undefined),
    token: vi.fn().mockResolvedValue('token'),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
const identity = {
  issuer: 'https://fixture.invalid/',
  subject: 'u',
  scopes: [],
};
function servicesWith(
  me: unknown,
  session: Session,
  fictitious = false,
): Services {
  return {
    api: { ...createFixtureServices().api, me: me as Services['api']['me'] },
    session,
    fictitious,
  };
}
/** Mostra onde o roteador está e como chegou lá (PUSH, REPLACE ou POP). */
function Where() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output aria-label="rota">
      {location.pathname} {type}
    </output>
  );
}
function renderGate(
  services: Services,
  path: string,
  children: React.ReactNode = <p>conteúdo protegido</p>,
) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <ServicesProvider services={services}>
          <SessionGate>{children}</SessionGate>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('useServices', () => {
  it('avisa quando falta o provedor de serviços', () => {
    function Probe() {
      useServices();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('Serviços indisponíveis.');
  });
});

describe('SessionGate — telas de acesso', () => {
  it('pedido de login: título de boas-vindas, sem alerta nem botões dos outros estados', async () => {
    const session = fakeSession({
      authenticated: vi.fn().mockResolvedValue(false),
    });
    renderGate(servicesWith(vi.fn(), session), '/map');
    expect(
      await screen.findByRole('heading', {
        name: 'Seu mapa pessoal de ideias',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Explore conexões com contexto, fontes e evidências.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sair da conta' }),
    ).not.toBeInTheDocument();
    // O contêiner recebe o foco por programa, nunca por Tab.
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('falha de rede: só o botão de tentar novamente, com o título de boas-vindas', async () => {
    renderGate(
      servicesWith(
        vi.fn().mockRejectedValue(new Error('rede caiu')),
        fakeSession(),
      ),
      '/map',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('rede caiu');
    expect(
      screen.getByRole('heading', { name: 'Seu mapa pessoal de ideias' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Entrar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Sair da conta' }),
    ).not.toBeInTheDocument();
  });

  it('erro da API que não é 401 nem 403 não pede login', async () => {
    renderGate(
      servicesWith(
        vi.fn().mockRejectedValue(new ApiError(500, 'Erro interno')),
        fakeSession(),
      ),
      '/map',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno');
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Entrar/ }),
    ).not.toBeInTheDocument();
  });

  it('rejeição que não é um Error usa a mensagem padrão', async () => {
    renderGate(
      servicesWith(vi.fn().mockRejectedValue('texto solto'), fakeSession()),
      '/map',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao verificar acesso.',
    );
  });

  it('acesso negado: só o botão de sair da conta', async () => {
    renderGate(
      servicesWith(
        vi.fn().mockRejectedValue(new ApiError(403, 'Proibido')),
        fakeSession(),
      ),
      '/map',
    );
    expect(
      await screen.findByRole('heading', { name: 'Acesso negado' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Tentar novamente' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Entrar/ }),
    ).not.toBeInTheDocument();
  });
});

describe('SessionGate — navegação por substituição', () => {
  it('o callback concluído substitui a rota por /map, sem empilhar', async () => {
    renderGate(
      servicesWith(vi.fn().mockResolvedValue(identity), fakeSession()),
      '/callback',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('rota')).toHaveTextContent('/map REPLACE'),
    );
  });

  it('falha no callback substitui a rota por /login', async () => {
    const session = fakeSession({
      callback: vi.fn().mockRejectedValue(new Error('inválido')),
    });
    renderGate(
      servicesWith(vi.fn().mockResolvedValue(identity), session),
      '/callback',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('rota')).toHaveTextContent('/login REPLACE'),
    );
  });

  it('falha fora do callback não muda de rota', async () => {
    renderGate(
      servicesWith(vi.fn().mockRejectedValue(new Error('rede')), fakeSession()),
      '/map',
    );
    await screen.findByRole('alert');
    expect(screen.getByLabelText('rota')).toHaveTextContent('/map POP');
  });

  it('sair da conta leva a /login por substituição', async () => {
    const session = fakeSession();
    renderGate(
      servicesWith(vi.fn().mockResolvedValue(identity), session),
      '/map',
    );
    await waitFor(() =>
      expect(screen.getByLabelText('rota')).toHaveTextContent('/map POP'),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sair' }));
    expect(session.logout).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByLabelText('rota')).toHaveTextContent('/login REPLACE'),
    );
  });
});
