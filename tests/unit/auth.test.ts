import { describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
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
      return Promise.resolve(true);
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
