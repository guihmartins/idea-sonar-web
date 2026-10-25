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
export function createTransport(
  base: string,
  session: Session | null,
  fetcher: typeof fetch = fetch,
  timeout = 15000,
): Transport {
  return async (path, options = {}) => {
    // Somente caminhos relativos internos; tokens nunca são encaminhados a URLs arbitrárias.
    if (
      !/^\/[a-z][a-z0-9/-]*(?:\?[^#]*)?$/iu.test(path) ||
      path.includes('..') ||
      path.includes('://')
    )
      throw new Error('Caminho de API inválido.');
    const method = options.method ?? 'GET';
    if (method === 'POST' && !options.idempotencyKey)
      throw new Error('Ação sem Idempotency-Key.');
    if (method === 'PATCH' && !options.version)
      throw new Error('Edição sem versão If-Match.');
    const controller = new AbortController();
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const timer = setTimeout(() => controller.abort(), timeout);
    let refreshed = false;
    let token: string | undefined;
    try {
      if (session) token = await session.token(false);
    } catch {
      clearTimeout(timer);
      throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
    }
    let rateRetried = false;
    const requestId = crypto.randomUUID();
    try {
      while (true) {
        if (signal.aborted) throw signal.reason;
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
        let response: Response;
        try {
          response = await fetcher(`${base}${path}`, {
            method,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            headers,
            signal,
            ...(options.body !== undefined
              ? { body: JSON.stringify(options.body) }
              : {}),
          });
        } catch {
          if (options.signal?.aborted)
            throw new DOMException('Operação cancelada.', 'AbortError');
          throw new ApiError(
            0,
            controller.signal.aborted
              ? 'Tempo esgotado. O resultado da ação pode ser incerto; reutilize a mesma ação ao tentar novamente.'
              : 'Falha de rede. Verifique a conexão e a configuração CORS da API.',
          );
        }
        if (response.status === 401 && !refreshed && session) {
          refreshed = true;
          try {
            token = await session.token(true);
          } catch {
            throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
          }
          continue;
        }
        const retryHeader = response.headers.get('Retry-After');
        const seconds = retryHeader
          ? /^\d+$/u.test(retryHeader)
            ? Number(retryHeader)
            : Math.max(0, (Date.parse(retryHeader) - Date.now()) / 1000)
          : 1;
        if (
          response.status === 429 &&
          method === 'GET' &&
          !rateRetried &&
          Number.isFinite(seconds) &&
          seconds <= 2
        ) {
          rateRetried = true;
          await new Promise<void>((resolve, reject) => {
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
          continue;
        }
        const payload: unknown =
          response.status === 204
            ? null
            : await response.json().catch(() => null);
        if (!response.ok) {
          const e =
            payload && typeof payload === 'object' && 'error' in payload
              ? payload.error
              : null;
          const record = e && typeof e === 'object' ? e : {};
          const message =
            response.status === 403
              ? 'Acesso negado para esta conta ou operação.'
              : response.status === 401
                ? session
                  ? 'Sua sessão expirou. Entre novamente.'
                  : 'A API exige autenticação. O frontend está no modo sem token.'
                : response.status === 409 || response.status === 412
                  ? 'O registro mudou. Compare a versão atual antes de editar novamente.'
                  : response.status === 429
                    ? `Limite de requisições. Aguarde ${Math.ceil(Number.isFinite(seconds) ? seconds : 1)} segundos.`
                    : 'Não foi possível concluir a operação.';
          throw new ApiError(
            response.status,
            message,
            record,
            response.headers.get('X-Request-Id') ?? '',
            seconds,
          );
        }
        return payload;
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
