import type { Session } from '../auth/session';
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: unknown = null,
    public readonly requestId = '',
    public readonly retryAfter = 0,
  ) {
    super(message);
  }
}
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  version?: string;
}
export type Transport = (
  path: string,
  options?: RequestOptions,
) => Promise<unknown>;
function validateRequest(path: string, options: RequestOptions) {
  if (
    !/^\/[a-z][a-z0-9/-]*(?:\?[^#]*)?$/iu.test(path) ||
    path.includes('..') ||
    path.includes('://')
  )
    throw new Error('Caminho de API inválido.');
  if (options.method === 'POST' && !options.idempotencyKey)
    throw new Error('Ação sem Idempotency-Key.');
  if (options.method === 'PATCH' && !options.version)
    throw new Error('Edição sem versão If-Match.');
}
async function accessToken(session: Session | null, force: boolean) {
  if (!session) return undefined;
  try {
    return await session.token(force);
  } catch {
    throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
  }
}
function requestInit(
  options: RequestOptions,
  signal: AbortSignal,
  requestId: string,
  token?: string,
): RequestInit {
  const headers = new Headers({
    'X-Request-Id': requestId,
    Accept: 'application/json',
  });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body !== undefined)
    headers.set('Content-Type', 'application/json');
  if (options.idempotencyKey)
    headers.set('Idempotency-Key', options.idempotencyKey);
  if (options.version) headers.set('If-Match', options.version);
  return {
    method: options.method ?? 'GET',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    headers,
    signal,
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  };
}
function networkError(options: RequestOptions, timedOut: boolean) {
  if (options.signal?.aborted)
    return new DOMException('Operação cancelada.', 'AbortError');
  return new ApiError(
    0,
    timedOut
      ? 'Tempo esgotado. O resultado da ação pode ser incerto; reutilize a mesma ação ao tentar novamente.'
      : 'Falha de rede. Verifique a conexão e a configuração CORS da API.',
  );
}
function retrySeconds(response: Response) {
  const header = response.headers.get('Retry-After');
  if (!header) return 1;
  return /^\d+$/u.test(header)
    ? Number(header)
    : Math.max(0, (Date.parse(header) - Date.now()) / 1000);
}
function waitForRetry(signal: AbortSignal, seconds: number) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(wait);
      reject(new DOMException('Operação cancelada.', 'AbortError'));
    };
    const wait = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, seconds * 1000);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
function errorDetails(payload: unknown) {
  const error =
    payload && typeof payload === 'object' && 'error' in payload
      ? payload.error
      : null;
  return error && typeof error === 'object' ? error : {};
}
function responseMessage(
  status: number,
  authenticated: boolean,
  seconds: number,
) {
  if (status === 401)
    return authenticated
      ? 'Sua sessão expirou. Entre novamente.'
      : 'A API exige autenticação. O frontend está no modo sem token.';
  if (status === 429)
    return `Limite de requisições. Aguarde ${Math.ceil(Number.isFinite(seconds) ? seconds : 1)} segundos.`;
  const messages: Record<number, string> = {
    403: 'Acesso negado para esta conta ou operação.',
    409: 'O registro mudou. Compare a versão atual antes de editar novamente.',
    412: 'O registro mudou. Compare a versão atual antes de editar novamente.',
  };
  return messages[status] ?? 'Não foi possível concluir a operação.';
}
async function parseResponse(
  response: Response,
  session: Session | null,
  seconds: number,
) {
  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      responseMessage(response.status, !!session, seconds),
      errorDetails(payload),
      response.headers.get('X-Request-Id') ?? '',
      seconds,
    );
  return payload;
}
interface RetryState {
  refreshed: boolean;
  rateRetried: boolean;
}
function canRenew(
  response: Response,
  session: Session | null,
  state: RetryState,
) {
  return response.status === 401 && !state.refreshed && !!session;
}
function canRetry(
  response: Response,
  options: RequestOptions,
  state: RetryState,
  seconds: number,
) {
  return (
    response.status === 429 &&
    (options.method ?? 'GET') === 'GET' &&
    !state.rateRetried &&
    Number.isFinite(seconds) &&
    seconds <= 2
  );
}
export function createTransport(
  base: string,
  session: Session | null,
  fetcher: typeof fetch = fetch,
  timeout = 15000,
): Transport {
  return async (path, options = {}) => {
    validateRequest(path, options);
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const timer = setTimeout(() => controller.abort(), timeout);
    const state: RetryState = { refreshed: false, rateRetried: false };
    const requestId = crypto.randomUUID();
    try {
      let token = await accessToken(session, false);
      while (true) {
        if (signal.aborted) throw signal.reason;
        let response: Response;
        try {
          response = await fetcher(
            `${base}${path}`,
            requestInit(options, signal, requestId, token),
          );
        } catch {
          throw networkError(options, controller.signal.aborted);
        }
        if (canRenew(response, session, state)) {
          state.refreshed = true;
          token = await accessToken(session, true);
          continue;
        }
        const seconds = retrySeconds(response);
        if (canRetry(response, options, state, seconds)) {
          state.rateRetried = true;
          await waitForRetry(signal, seconds);
          continue;
        }
        return await parseResponse(response, session, seconds);
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
