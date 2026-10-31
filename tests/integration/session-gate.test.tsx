import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { SessionGate, ServicesProvider } from '../../src/app/services';
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

function renderGate(
  services: Services,
  path = '/map',
  children: React.ReactNode = <p>Conteúdo protegido</p>,
  queryClient = createQueryClient(),
) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <SessionGate>{children}</SessionGate>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

function RouteProbe() {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

function readyApi(): Services['api'] {
  return {
    ...createFixtureServices().api,
    me: vi.fn().mockResolvedValue({
      issuer: 'https://fixture.invalid/',
      subject: 'fixture-user',
      scopes: [],
    }),
  };
}

describe('SessionGate — sem sessão (modo none)', () => {
  it('mostra o aviso de acesso sem login e renderiza o conteúdo', () => {
    renderGate({
      api: createFixtureServices().api,
      session: null,
      fictitious: false,
    });
    expect(
      screen.getByText('Acesso sem login (temporário)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });

  it('redireciona /callback para /map sem sessão', async () => {
    renderGate(
      {
        api: readyApi(),
        session: null,
        fictitious: false,
      },
      '/callback',
      <RouteProbe />,
    );
    expect(await screen.findByText('/map')).toBeInTheDocument();
  });
});

describe('SessionGate — rota de callback com sessão', () => {
  it('completa o callback e navega para o mapa', async () => {
    const session = fakeSession();
    renderGate(
      { api: readyApi(), session, fictitious: true },
      '/callback',
      <RouteProbe />,
    );
    expect(await screen.findByText('/map')).toBeInTheDocument();
    expect(session.callback).toHaveBeenCalled();
  });

  it('envia falha no callback ao login', async () => {
    const session = fakeSession({
      callback: vi.fn().mockRejectedValue(new Error('Callback inválido')),
    });
    renderGate(
      { api: readyApi(), session, fictitious: false },
      '/callback',
      <RouteProbe />,
    );

    expect(await screen.findByText('/login')).toBeInTheDocument();
    expect(session.callback).toHaveBeenCalledOnce();
  });
});

describe('SessionGate — estados de autenticação', () => {
  it('mostra carregando, depois pede login e autentica ao clicar', async () => {
    const session = fakeSession({
      authenticated: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true),
    });
    const services = {
      api: readyApi(),
      session,
      fictitious: true,
    };
    renderGate(services);
    expect(screen.getByText('Verificando acesso…')).toBeInTheDocument();
    const button = await screen.findByRole('button', {
      name: 'Entrar na demonstração fictícia',
    });
    const user = userEvent.setup();
    await user.click(button);
    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
  });

  it('mostra erro ao falhar o início do login', async () => {
    const session = fakeSession({
      authenticated: vi.fn().mockResolvedValue(false),
      login: vi.fn().mockRejectedValue(new Error('sem provedor')),
    });
    renderGate({
      api: readyApi(),
      session,
      fictitious: false,
    });
    const button = await screen.findByRole('button', {
      name: 'Entrar com segurança',
    });
    const user = userEvent.setup();
    await user.click(button);
    expect(
      await screen.findByText(
        'Não foi possível iniciar o login. Verifique a configuração do provedor.',
      ),
    ).toBeInTheDocument();
  });

  it('nega acesso em 403 e desconecta ao sair da conta', async () => {
    const session = fakeSession({
      logout: vi.fn().mockResolvedValue(undefined),
    });
    const services = {
      api: {
        ...createFixtureServices().api,
        me: vi.fn().mockRejectedValue(new ApiError(403, 'Sem permissão')),
      },
      session,
      fictitious: false,
    };
    const cache = createQueryClient();
    cache.setQueryData(['private'], { confidential: true });
    const cancel = vi.spyOn(cache, 'cancelQueries');
    const clear = vi.spyOn(cache, 'clear');
    renderGate(services, '/map', undefined, cache);
    expect(
      await screen.findByRole('heading', { name: 'Acesso negado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sem permissão');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(session.logout).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(cache.getQueryData(['private'])).toBeUndefined();
  });

  it('volta para o login em 401 ao verificar identidade', async () => {
    const services = {
      api: {
        ...createFixtureServices().api,
        me: vi.fn().mockRejectedValue(new ApiError(401, 'Sessão expirou')),
      },
      session: fakeSession(),
      fictitious: false,
    };
    renderGate(services);
    expect(
      await screen.findByRole('button', { name: 'Entrar com segurança' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sessão expirou');
  });

  it('mostra erro genérico e permite tentar novamente', async () => {
    const me = vi
      .fn()
      .mockRejectedValueOnce(new Error('Falha de rede'))
      .mockResolvedValue({
        issuer: 'https://fixture.invalid/',
        subject: 'u',
        scopes: [],
      });
    const services = {
      api: { ...createFixtureServices().api, me },
      session: fakeSession(),
      fictitious: false,
    };
    renderGate(services);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
  });

  it('mostra demonstração e mensagem quando o provedor falha ao sair', async () => {
    const authenticated = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const session = fakeSession({
      authenticated,
      logout: vi.fn().mockRejectedValue(new Error('provedor indisponível')),
    });
    const services = {
      api: readyApi(),
      session,
      fictitious: true,
    };
    renderGate(services);
    expect(
      await screen.findByText(
        'DEMONSTRAÇÃO — dados fictícios, sem valor histórico.',
      ),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(
      await screen.findByText(
        'Sessão local encerrada. Não foi possível encerrar a sessão do provedor.',
      ),
    ).toBeInTheDocument();
  });
});
