import { describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  authenticated: vi.fn(async () => true),
  token: vi.fn(async (_options: unknown) => 'access-token'),
  callback: vi.fn(async () => ({})),
  logout: vi.fn(async (_options: unknown) => {}),
  login: vi.fn(async () => {}),
}));
vi.mock('@auth0/auth0-spa-js', () => ({
  Auth0Client: class {
    constructor(options: unknown) {
      sdk.init(options);
    }
    isAuthenticated() {
      return sdk.authenticated();
    }
    getTokenSilently(options: unknown) {
      return sdk.token(options);
    }
    handleRedirectCallback() {
      return sdk.callback();
    }
    loginWithRedirect() {
      return sdk.login();
    }
    logout(options: unknown) {
      return sdk.logout(options);
    }
  },
}));
import { createSession } from '../../src/auth/auth0';
import { parseEnvironment } from '../../src/config/schema';
const config = parseEnvironment(
  {
    VITE_AUTH_MODE: 'oidc',
    VITE_API_BASE_URL: 'https://api.example.com',
    VITE_OIDC_ISSUER: 'https://identity.example.com/',
    VITE_OIDC_CLIENT_ID: 'public-spa',
    VITE_OIDC_AUDIENCE: 'api-audience',
  },
  false,
);
describe('SDK oficial de autenticação', () => {
  it('mantém tokens em memória e configura audience/scopes, sem secret', async () => {
    const session = createSession(config);
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheLocation: 'memory',
        useRefreshTokens: false,
        clientId: 'public-spa',
        authorizationParams: expect.objectContaining({
          audience: 'api-audience',
          scope: expect.stringContaining('idea-sonar:undo'),
        }),
      }),
    );
    expect(await session.token(true)).toBe('access-token');
    expect(sdk.token).toHaveBeenCalledWith({ cacheMode: 'off' });
  });
  it('processa callback uma vez mesmo com efeitos duplicados e delega logout', async () => {
    const session = createSession(config);
    await Promise.all([session.callback(), session.callback()]);
    expect(sdk.callback).toHaveBeenCalledTimes(1);
    await session.logout();
    expect(sdk.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });
});

it('valida modo/configuração antes de inicializar SDK', () => {
  expect(() =>
    createSession(
      parseEnvironment({ VITE_API_BASE_URL: 'https://api.example.com' }, false),
    ),
  ).toThrow('OIDC não configurado');
  expect(() =>
    createSession({
      apiBaseUrl: config.apiBaseUrl,
      apiV1Url: config.apiV1Url,
      authMode: 'oidc',
    }),
  ).toThrow('OIDC não configurado');
  expect(sdk.init).not.toHaveBeenCalled();
});
it('delega login e estado real da sessão, validando o access token retornado', async () => {
  const session = createSession(config);
  expect(sdk.init).toHaveBeenCalledWith({
    domain: 'https://identity.example.com',
    clientId: 'public-spa',
    cacheLocation: 'memory',
    useRefreshTokens: false,
    authorizationParams: {
      redirect_uri: `${window.location.origin}/callback`,
      audience: 'api-audience',
      scope: 'openid profile idea-sonar:read idea-sonar:write idea-sonar:undo',
    },
  });
  sdk.authenticated.mockResolvedValueOnce(false);
  expect(await session.authenticated()).toBe(false);
  expect(sdk.authenticated).toHaveBeenCalledTimes(1);
  await session.login();
  expect(sdk.login).toHaveBeenCalledTimes(1);
  expect(await session.token()).toBe('access-token');
  expect(sdk.token).toHaveBeenLastCalledWith({ cacheMode: 'on' });
  sdk.token.mockResolvedValueOnce('');
  await expect(session.token()).rejects.toThrow('Access token indisponível');
});
