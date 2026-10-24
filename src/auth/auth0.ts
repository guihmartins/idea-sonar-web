import { Auth0Client } from '@auth0/auth0-spa-js';
import type { AppConfig } from '../config/schema';
import type { Session } from './session';
export function createSession(config: AppConfig): Session {
  const client = new Auth0Client({
    domain: config.oidc.issuer,
    clientId: config.oidc.clientId,
    cacheLocation: 'memory',
    useRefreshTokens: false,
    authorizationParams: {
      redirect_uri: `${window.location.origin}/callback`,
      audience: config.oidc.audience,
      scope: 'openid profile idea-sonar:read idea-sonar:write idea-sonar:undo',
    },
  });
  let callback: Promise<void> | undefined;
  return {
    authenticated: () => client.isAuthenticated(),
    login: () => client.loginWithRedirect(),
    callback: () => {
      callback ??= client.handleRedirectCallback().then(() => undefined);
      return callback;
    },
    token: async (force = false) => {
      const token = await client.getTokenSilently({
        cacheMode: force ? 'off' : 'on',
      });
      if (!token) throw new Error('Access token indisponível.');
      return token;
    },
    logout: () =>
      client.logout({ logoutParams: { returnTo: window.location.origin } }),
  };
}
