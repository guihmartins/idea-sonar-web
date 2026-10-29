import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Api } from '../api/adapter';
import { ApiError } from '../api/client';
import type { Session } from '../auth/session';
export interface Services {
  api: Api;
  session: Session | null;
  fictitious: boolean;
}
const Context = createContext<Services | null>(null);
export function useServices(): Services {
  const services = useContext(Context);
  if (!services) throw new Error('Serviços indisponíveis.');
  return services;
}
export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <Context.Provider value={services}>{children}</Context.Provider>;
}
export function SessionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session } = useServices();
  if (!session)
    return (
      <>
        <div className="session-bar">
          <span className="marker" aria-hidden="true" />
          Acesso sem login (temporário)
        </div>
        {location.pathname === '/callback' ? (
          <Navigate to="/map" replace />
        ) : (
          children
        )}
      </>
    );
  return <AuthenticatedGate session={session}>{children}</AuthenticatedGate>;
}
function AuthenticatedGate({
  children,
  session,
}: {
  children: ReactNode;
  session: Session;
}) {
  const { api, fictitious } = useServices();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<
    'loading' | 'login' | 'ready' | 'denied' | 'error'
  >('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setState('loading');
    void (async () => {
      if (location.pathname === '/callback') {
        await session.callback();
        if (current) navigate('/map', { replace: true });
        return;
      }
      if (!(await session.authenticated())) {
        if (current) setState('login');
        return;
      }
      await api.me();
      if (current) setState('ready');
    })().catch((error: unknown) => {
      if (!current) return;
      setMessage(
        error instanceof Error ? error.message : 'Falha ao verificar acesso.',
      );
      setState(
        error instanceof ApiError && error.status === 403
          ? 'denied'
          : error instanceof ApiError && error.status === 401
            ? 'login'
            : 'error',
      );
      if (location.pathname === '/callback')
        navigate('/login', { replace: true });
    });
    return () => {
      current = false;
    };
  }, [api, session, attempt, navigate, location.pathname === '/callback']);
  async function logout() {
    setState('login');
    await cache.cancelQueries();
    cache.clear();
    navigate('/login', { replace: true });
    try {
      await session.logout();
    } catch {
      setMessage(
        'Sessão local encerrada. Não foi possível encerrar a sessão do provedor.',
      );
    }
  }
  if (state === 'loading') return <p role="status">Verificando acesso…</p>;
  if (state !== 'ready')
    return (
      <main id="conteudo" tabIndex={-1} className="login-card">
        <h1>
          {state === 'denied' ? 'Acesso negado' : 'Seu mapa pessoal de ideias'}
        </h1>
        <p>Explore conexões com contexto, fontes e evidências.</p>
        {message && <p role="alert">{message}</p>}
        {state === 'login' && (
          <button
            className="primary"
            onClick={() => {
              void session
                .login()
                .then(() => setAttempt((x) => x + 1))
                .catch(() =>
                  setMessage(
                    'Não foi possível iniciar o login. Verifique a configuração do provedor.',
                  ),
                );
            }}
          >
            Entrar{fictitious ? ' na demonstração fictícia' : ' com segurança'}
          </button>
        )}
        {state === 'error' && (
          <button onClick={() => setAttempt((x) => x + 1)}>
            Tentar novamente
          </button>
        )}
        {state === 'denied' && (
          <button onClick={() => void logout()}>Sair da conta</button>
        )}
      </main>
    );
  return (
    <>
      <div className="session-bar">
        {fictitious && (
          <strong>DEMONSTRAÇÃO — dados fictícios, sem valor histórico.</strong>
        )}
        <button className="subtle" onClick={() => void logout()}>
          Sair
        </button>
      </div>
      {children}
    </>
  );
}
