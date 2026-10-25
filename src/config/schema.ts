export type EnvironmentInput = Readonly<Record<string, unknown>>;

export interface AppConfig {
  readonly apiBaseUrl: string;
  readonly apiV1Url: string;
  readonly authMode: 'none' | 'oidc';
  readonly oidc?: {
    readonly issuer: string;
    readonly clientId: string;
    readonly audience: string;
  };
}

function required(input: EnvironmentInput, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(
      `${key}: informe um valor público válido, sem espaços nas extremidades.`,
    );
  }
  return value;
}

function publicUrl(
  input: EnvironmentInput,
  key: string,
  development: boolean,
): URL {
  const value = required(input, key);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key}: use uma URL absoluta HTTP(S).`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    url.protocol !== 'https:' &&
    !(development && local && url.protocol === 'http:')
  ) {
    throw new Error(
      `${key}: HTTPS obrigatório; HTTP somente em localhost/127.0.0.1 no desenvolvimento.`,
    );
  }
  validateUrlSyntax(url, value, key);
  return url;
}
function validateUrlSyntax(url: URL, value: string, key: string) {
  // Verifica também delimitadores vazios e sintaxe antes da normalização de URL.
  if (
    url.username ||
    url.password ||
    /[?#@\\\s]/u.test(value) ||
    !/^https?:\/\//u.test(value)
  ) {
    throw new Error(
      `${key}: não use credenciais, query, fragmento ou espaços.`,
    );
  }
}

export function parseEnvironment(
  input: EnvironmentInput,
  development: boolean,
): AppConfig {
  if (
    !development &&
    input['VITE_ENABLE_FIXTURES'] !== undefined &&
    input['VITE_ENABLE_FIXTURES'] !== 'false'
  )
    throw new Error('VITE_ENABLE_FIXTURES: fixtures proibidas em builds.');
  const api = publicUrl(input, 'VITE_API_BASE_URL', development);
  const rawApi = required(input, 'VITE_API_BASE_URL');
  if (!/^https?:\/\/[^/]+\/?$/u.test(rawApi) || api.pathname !== '/') {
    throw new Error(
      'VITE_API_BASE_URL: use somente a origem, sem caminho ou /api/v1.',
    );
  }
  const authMode = input['VITE_AUTH_MODE'] ?? 'none';
  if (authMode !== 'none' && authMode !== 'oidc')
    throw new Error('VITE_AUTH_MODE: use none ou oidc.');
  const base = {
    apiBaseUrl: api.origin,
    apiV1Url: `${api.origin}/api/v1`,
    authMode,
  } as const;
  if (authMode === 'none') return base;
  return { ...base, oidc: parseOidc(input, development) };
}
function parseOidc(input: EnvironmentInput, development: boolean) {
  const issuer = publicUrl(input, 'VITE_OIDC_ISSUER', development);
  const clientId = required(input, 'VITE_OIDC_CLIENT_ID');
  const audience = required(input, 'VITE_OIDC_AUDIENCE');
  if (/\s/u.test(clientId) || /\s/u.test(audience)) {
    throw new Error(
      'VITE_OIDC_CLIENT_ID e VITE_OIDC_AUDIENCE: não use espaços.',
    );
  }
  return { issuer: issuer.href, clientId, audience };
}
