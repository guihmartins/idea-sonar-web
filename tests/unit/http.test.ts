import { describe, expect, it, vi } from 'vitest';
import { ApiError, createTransport } from '../../src/api/client';
import type { Session } from '../../src/auth/session';
function setup(responses: Response[]) {
  const session: Session = {
    authenticated: async () => true,
    login: vi.fn(async () => {}),
    callback: async () => {},
    token: vi.fn(async (force?: boolean) =>
      force ? 'renewed-access-token' : 'access-token',
    ),
    logout: async () => {},
  };
  const fetcher = vi.fn<typeof fetch>(
    async () => responses.shift() ?? new Response('{}'),
  );
  return {
    session,
    fetcher,
    send: createTransport(
      'https://external.example.com/api/v1',
      session,
      fetcher,
    ),
  };
}
describe('transporte autenticado', () => {
  it('sem sessão não envia Authorization e não renova 401', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 401 }),
    );
    const send = createTransport(
      'https://external.example.com/api/v1',
      null,
      fetcher,
    );
    await expect(send('/catalog')).rejects.toMatchObject({
      status: 401,
      message: 'A API exige autenticação. O frontend está no modo sem token.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).has('Authorization'),
    ).toBe(false);
    expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe('omit');
  });
  it('sem sessão permite mutação real com a mesma proteção de idempotência', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ id: 'created' }),
    );
    await createTransport(
      'https://external.example.com/api/v1',
      null,
      fetcher,
    )('/nodes', {
      method: 'POST',
      body: { label: 'Teste' },
      idempotencyKey: 'action',
    });
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('Idempotency-Key')).toBe('action');
  });
  it('usa origem absoluta, access token, request ID e sem Content-Type no GET', async () => {
    const { send, fetcher } = setup([Response.json({ ok: true })]);
    await send('/me');
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://external.example.com/api/v1/me');
    const headers = new Headers(request?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('X-Request-Id')).toBeTruthy();
  });
  it('renova uma vez no 401 e conserva chave de idempotência', async () => {
    const { send, fetcher, session } = setup([
      new Response('{}', { status: 401 }),
      Response.json({ id: 'x' }),
    ]);
    await send('/nodes', {
      method: 'POST',
      body: { label: 'teste' },
      idempotencyKey: 'same-action',
    });
    expect(session.token).toHaveBeenNthCalledWith(2, true);
    const headers = fetcher.mock.calls.map(
      (call) => new Headers(call[1]?.headers),
    );
    expect(headers.map((h) => h.get('Idempotency-Key'))).toEqual([
      'same-action',
      'same-action',
    ]);
    expect(headers[1]?.get('Authorization')).toBe(
      'Bearer renewed-access-token',
    );
    expect(headers[0]?.get('X-Request-Id')).toBe(
      headers[1]?.get('X-Request-Id'),
    );
  });
  it('encerra após segundo 401 e não redireciona em loop', async () => {
    const { send, fetcher, session } = setup([
      new Response('{}', { status: 401 }),
      new Response('{}', { status: 401 }),
    ]);
    await expect(send('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(session.login).not.toHaveBeenCalled();
  });
  it('403 não tenta renovar nem repetir', async () => {
    const { send, fetcher } = setup([new Response('{}', { status: 403 })]);
    await expect(send('/me')).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('PATCH leva If-Match e conflito não é repetido', async () => {
    const { send, fetcher } = setup([new Response('{}', { status: 409 })]);
    await expect(
      send('/nodes/x', {
        method: 'PATCH',
        body: { label: 'rascunho' },
        version: '"8"',
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(
      new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('If-Match'),
    ).toBe('"8"');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('429 em GET tem no máximo uma repetição e informa espera', async () => {
    const limited = () =>
      new Response('{}', { status: 429, headers: { 'Retry-After': '0' } });
    const { send, fetcher } = setup([limited(), limited()]);
    await expect(send('/catalog')).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('não repete mutação automaticamente no 429 ou falha de rede', async () => {
    const { send, fetcher } = setup([
      new Response('{}', { status: 429, headers: { 'Retry-After': '5' } }),
    ]);
    await expect(
      send('/nodes', { method: 'POST', body: {}, idempotencyKey: 'fixed' }),
    ).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockRejectedValue(new TypeError('Network failure'));
    await expect(
      send('/nodes', { method: 'POST', body: {}, idempotencyKey: 'fixed' }),
    ).rejects.toMatchObject({ status: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bloqueia URLs externas, POST sem chave e PATCH sem versão', async () => {
    const { send, fetcher } = setup([]);
    await expect(send('https://attacker.invalid')).rejects.toThrow('Caminho');
    await expect(send('/nodes', { method: 'POST' })).rejects.toThrow(
      'Idempotency',
    );
    await expect(send('/nodes/x', { method: 'PATCH' })).rejects.toThrow(
      'If-Match',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('integridade, cancelamento e erros do transporte', () => {
  it('envia método, corpo e políticas de privacidade corretos', async () => {
    const { send, fetcher } = setup([Response.json({ id: 'created' })]);
    expect(
      await send('/nodes', {
        method: 'POST',
        body: { label: 'Sintético' },
        idempotencyKey: 'action',
      }),
    ).toEqual({ id: 'created' });
    const request = fetcher.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      method: 'POST',
      body: '{"label":"Sintético"}',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    const headers = new Headers(request?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
  it('não envia corpo ou chave/versionamento que não foram informados no GET', async () => {
    const { send, fetcher } = setup([Response.json({})]);
    await send('/catalog');
    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.body).toBeUndefined();
    const headers = new Headers(request?.headers);
    expect(headers.has('Idempotency-Key')).toBe(false);
    expect(headers.has('If-Match')).toBe(false);
  });
  it('não envia request se o SDK não fornece token e informa sessão expirada', async () => {
    const { send, session, fetcher } = setup([]);
    vi.mocked(session.token).mockRejectedValue(new Error('SDK unavailable'));
    await expect(send('/me')).rejects.toMatchObject({
      status: 401,
      message: 'Sua sessão expirou. Entre novamente.',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('falha na renovação encerra após a primeira resposta 401', async () => {
    const { send, session, fetcher } = setup([
      new Response('{}', { status: 401 }),
    ]);
    vi.mocked(session.token)
      .mockResolvedValueOnce('old')
      .mockRejectedValueOnce(new Error('SDK unavailable'));
    await expect(send('/me')).rejects.toMatchObject({
      status: 401,
      message: 'Sua sessão expirou. Entre novamente.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([409, 412])(
    'conflito %i conserva detalhes e request ID da API',
    async (status) => {
      const { send } = setup([
        Response.json(
          {
            error: {
              code: 'version-conflict',
              details: { currentVersion: '2' },
            },
          },
          { status, headers: { 'X-Request-Id': 'server-request' } },
        ),
      ]);
      await expect(
        send('/nodes/x', { method: 'PATCH', body: {}, version: '1' }),
      ).rejects.toMatchObject({
        status,
        message:
          'O registro mudou. Compare a versão atual antes de editar novamente.',
        requestId: 'server-request',
        details: { code: 'version-conflict', details: { currentVersion: '2' } },
      });
    },
  );
  it('aceita 204 sem tentar ler JSON e tolera erro não JSON', async () => {
    const noContent = new Response(null, { status: 204 });
    const parse = vi.spyOn(noContent, 'json');
    const { send } = setup([
      noContent,
      new Response('bad gateway', { status: 502 }),
    ]);
    expect(await send('/catalog')).toBeNull();
    expect(parse).not.toHaveBeenCalled();
    await expect(send('/catalog')).rejects.toMatchObject({
      status: 502,
      message: 'Não foi possível concluir a operação.',
      details: {},
      requestId: '',
    });
  });
  it('um 403 é exibido sem tratar como sessão expirada', async () => {
    const { send } = setup([new Response('{}', { status: 403 })]);
    await expect(send('/me')).rejects.toMatchObject({
      status: 403,
      message: 'Acesso negado para esta conta ou operação.',
    });
  });
  it('aborto anterior ao request não envia dados', async () => {
    const { send, fetcher } = setup([]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      send('/catalog', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cancela request em andamento por AbortSignal externo', async () => {
    const { session } = setup([]);
    const controller = new AbortController();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetcher = vi.fn<typeof fetch>(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
          started();
        }),
    );
    const request = createTransport(
      'https://external.example.com/api/v1',
      session,
      fetcher,
    )('/catalog', { signal: controller.signal });
    const rejected = expect(request).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Operação cancelada.',
    });
    await ready;
    controller.abort();
    await rejected;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('timeout de criação não repete a mutação nem troca chave em retry explícito', async () => {
    vi.useFakeTimers();
    try {
      const { session } = setup([]);
      const fetcher = vi.fn<typeof fetch>(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener(
              'abort',
              () => reject(new Error('timeout')),
              { once: true },
            );
          }),
      );
      const send = createTransport(
        'https://external.example.com/api/v1',
        session,
        fetcher,
        100,
      );
      for (let attempt = 0; attempt < 2; attempt++) {
        const rejected = expect(
          send('/nodes', {
            method: 'POST',
            body: {},
            idempotencyKey: 'same-action',
          }),
        ).rejects.toMatchObject({
          status: 0,
          message: expect.stringContaining('Tempo esgotado'),
        });
        await vi.advanceTimersByTimeAsync(101);
        await rejected;
      }
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        fetcher.mock.calls.map((c) =>
          new Headers(c[1]?.headers).get('Idempotency-Key'),
        ),
      ).toEqual(['same-action', 'same-action']);
    } finally {
      vi.useRealTimers();
    }
  });
  it('respeita Retry-After com data HTTP e encerra após uma espera', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
      const { send, fetcher } = setup([
        new Response('{}', {
          status: 429,
          headers: { 'Retry-After': 'Sun, 25 Oct 2026 00:00:02 GMT' },
        }),
        Response.json({ ready: true }),
      ]);
      const result = send('/catalog');
      await vi.advanceTimersByTimeAsync(1999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toEqual({ ready: true });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each(['3', '10', 'invalid-date'])(
    'não espera indefinidamente no Retry-After %s',
    async (retryAfter) => {
      const { send, fetcher } = setup([
        new Response('{}', {
          status: 429,
          headers: { 'Retry-After': retryAfter },
        }),
      ]);
      await expect(send('/catalog')).rejects.toMatchObject({
        status: 429,
        message: expect.stringContaining('Limite de requisições'),
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    '/nodes/../export',
    '//evil.example/path',
    '/nodes/x#fragment',
    'nodes',
    '',
  ])('bloqueia caminho inválido: %s', async (path) => {
    const { send, fetcher } = setup([]);
    await expect(send(path)).rejects.toThrow('Caminho de API inválido');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('preserva queries de busca/paginação e rejeita prefixo antes do caminho interno', async () => {
  const { send, fetcher } = setup([Response.json({ items: [] })]);
  await send('/nodes?q=Jung&cursor=next-page&limit=50');
  expect(fetcher.mock.calls[0]?.[0]).toBe(
    'https://external.example.com/api/v1/nodes?q=Jung&cursor=next-page&limit=50',
  );
  await expect(send('prefix/catalog')).rejects.toThrow(
    'Caminho de API inválido',
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([null, 'opaque', 12])(
  'erro não estruturado %s mantém detalhes seguros',
  async (error) => {
    const { send } = setup([Response.json({ error }, { status: 500 })]);
    await expect(send('/catalog')).rejects.toMatchObject({
      status: 500,
      details: {},
      requestId: '',
    });
  },
);
it('cancela a espera de Retry-After e libera timers', async () => {
  vi.useFakeTimers();
  try {
    const controller = new AbortController();
    const { session, fetcher } = setup([
      new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }),
    ]);
    const send = createTransport(
      'https://external.example.com/api/v1',
      session,
      fetcher,
    );
    const rejected = expect(
      send('/catalog', { signal: controller.signal }),
    ).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Operação cancelada.',
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
it('não deixa timeout pendente quando a obtenção de token falha', async () => {
  vi.useFakeTimers();
  try {
    const { send, session, fetcher } = setup([]);
    vi.mocked(session.token).mockRejectedValue(new Error('SDK unavailable'));
    await expect(send('/me')).rejects.toMatchObject({
      status: 401,
      requestId: '',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
