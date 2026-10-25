import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/schema';

const valid = {
  VITE_AUTH_MODE: 'oidc',
  VITE_API_BASE_URL: 'https://api.example.com',
  VITE_OIDC_ISSUER: 'https://identity.example.com/',
  VITE_OIDC_CLIENT_ID: 'test-public-spa',
  VITE_OIDC_AUDIENCE: 'https://api.example.com',
};

describe('configuração pública', () => {
  it('por padrão requer só API e desativa OIDC', () => {
    expect(
      parseEnvironment({ VITE_API_BASE_URL: 'https://api.example.com' }, false),
    ).toEqual({
      apiBaseUrl: 'https://api.example.com',
      apiV1Url: 'https://api.example.com/api/v1',
      authMode: 'none',
    });
  });
  it('rejeita modo de autenticação desconhecido', () => {
    expect(() =>
      parseEnvironment({ ...valid, VITE_AUTH_MODE: 'disabled-typo' }, false),
    ).toThrow('VITE_AUTH_MODE');
  });
  it('proíbe ativar fixtures em build', () => {
    expect(() =>
      parseEnvironment({ ...valid, VITE_ENABLE_FIXTURES: 'true' }, false),
    ).toThrow('fixtures proibidas');
  });
  it.each(['https://api.example.com', 'https://api.example.com/'])(
    'normaliza %s e acrescenta /api/v1 uma vez',
    (url) => {
      expect(
        parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, false),
      ).toMatchObject({
        apiBaseUrl: 'https://api.example.com',
        apiV1Url: 'https://api.example.com/api/v1',
      });
    },
  );
  it.each([
    undefined,
    '',
    ' ',
    '/api',
    'api.example.com',
    'ftp://api.example.com',
    'http://api.example.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://user:password@api.example.com',
    'https://@api.example.com',
    'https://api.example.com/api/v1',
    'https://api.example.com/../',
    'https://api.example.com//',
    'https://api.example.com/?q=x',
    'https://api.example.com/?',
    'https://api.example.com/#',
    ' https://api.example.com',
    'https://api.example.com\\path',
  ])('rejeita API inválida no build: %s', (url) => {
    expect(() =>
      parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, false),
    ).toThrow('VITE_API_BASE_URL');
  });
  it.each(['http://localhost:3000/', 'http://127.0.0.1:3000/'])(
    'permite HTTP local somente em desenvolvimento: %s',
    (url) => {
      expect(
        parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, true).apiBaseUrl,
      ).toBe(url.slice(0, -1));
    },
  );
  it('não permite HTTP remoto em desenvolvimento', () => {
    expect(() =>
      parseEnvironment(
        { ...valid, VITE_API_BASE_URL: 'http://api.example.com' },
        true,
      ),
    ).toThrow('HTTPS');
  });
  it.each(['VITE_OIDC_ISSUER', 'VITE_OIDC_CLIENT_ID', 'VITE_OIDC_AUDIENCE'])(
    'exige configuração OIDC: %s',
    (key) => {
      expect(() =>
        parseEnvironment({ ...valid, [key]: undefined }, false),
      ).toThrow(key);
    },
  );
  it.each([
    'http://identity.example.com',
    'https://user@identity.example.com',
    'https://identity.example.com/#',
  ])('valida issuer: %s', (issuer) => {
    expect(() =>
      parseEnvironment({ ...valid, VITE_OIDC_ISSUER: issuer }, false),
    ).toThrow('VITE_OIDC_ISSUER');
  });
});

describe('limites de configuração', () => {
  it('normaliza issuer e preserva a configuração OIDC explícita', () => {
    expect(parseEnvironment(valid, false)).toEqual({
      apiBaseUrl: 'https://api.example.com',
      apiV1Url: 'https://api.example.com/api/v1',
      authMode: 'oidc',
      oidc: {
        issuer: 'https://identity.example.com/',
        clientId: 'test-public-spa',
        audience: 'https://api.example.com',
      },
    });
  });
  it('permite flag false no build e ignora provedor desativado', () => {
    expect(
      parseEnvironment(
        {
          VITE_API_BASE_URL: 'https://api.example.com',
          VITE_AUTH_MODE: 'none',
          VITE_ENABLE_FIXTURES: 'false',
          VITE_OIDC_ISSUER: 'ignored-invalid-issuer',
        },
        false,
      ).authMode,
    ).toBe('none');
  });
  it('permite fixtures explícitas somente no desenvolvimento', () => {
    expect(
      parseEnvironment({ ...valid, VITE_ENABLE_FIXTURES: 'true' }, true)
        .authMode,
    ).toBe('oidc');
  });
  it.each([undefined, '', ' ', 123, ' client ', 'two clients'])(
    'valida client ID público: %s',
    (value) => {
      expect(() =>
        parseEnvironment({ ...valid, VITE_OIDC_CLIENT_ID: value }, false),
      ).toThrow('VITE_OIDC_CLIENT_ID');
    },
  );
  it.each([undefined, '', ' ', 123, ' audience ', 'two audiences'])(
    'valida audience pública: %s',
    (value) => {
      expect(() =>
        parseEnvironment({ ...valid, VITE_OIDC_AUDIENCE: value }, false),
      ).toThrow('VITE_OIDC_AUDIENCE');
    },
  );
  it.each([
    'https://identity.example.com/?q=1',
    'https://identity.example.com/?',
    'https://identity.example.com/#',
    'https://user:password@identity.example.com/',
    'https://@identity.example.com/',
    'identity.example.com',
    'ftp://identity.example.com/',
    'https://identity.example.com/ path',
  ])(
    'rejeita issuer inválido sem depender da validação da API: %s',
    (issuer) => {
      expect(() =>
        parseEnvironment({ ...valid, VITE_OIDC_ISSUER: issuer }, false),
      ).toThrow('VITE_OIDC_ISSUER');
    },
  );
  it('HTTP local de issuer é permitido apenas no desenvolvimento', () => {
    const input = { ...valid, VITE_OIDC_ISSUER: 'http://localhost:9000/' };
    expect(parseEnvironment(input, true).oidc?.issuer).toBe(
      'http://localhost:9000/',
    );
    expect(() => parseEnvironment(input, false)).toThrow('HTTPS');
  });
});
