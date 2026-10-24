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
