import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/schema';

const valid = {
  VITE_API_BASE_URL: 'https://api.example.com',
  VITE_OIDC_ISSUER: 'https://identity.example.com/',
  VITE_OIDC_CLIENT_ID: 'test-public-spa',
  VITE_OIDC_AUDIENCE: 'https://api.example.com',
};

describe('configuração pública', () => {
  it.each(['https://api.example.com', 'https://api.example.com/'])(
    'normaliza %s e acrescenta /api/v1 uma vez', (url) => {
      expect(parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, false)).toMatchObject({
        apiBaseUrl: 'https://api.example.com', apiV1Url: 'https://api.example.com/api/v1',
      });
    },
  );
  it.each([
    undefined, '', ' ', '/api', 'api.example.com', 'ftp://api.example.com',
    'http://api.example.com', 'http://localhost:3000', 'http://127.0.0.1:3000',
    'https://user:password@api.example.com', 'https://@api.example.com',
    'https://api.example.com/api/v1', 'https://api.example.com/../',
    'https://api.example.com//', 'https://api.example.com/?q=x',
    'https://api.example.com/?', 'https://api.example.com/#',
    ' https://api.example.com', 'https://api.example.com\\path',
  ])('rejeita API inválida no build: %s', (url) => {
    expect(() => parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, false)).toThrow('VITE_API_BASE_URL');
  });
  it.each(['http://localhost:3000/', 'http://127.0.0.1:3000/'])(
    'permite HTTP local somente em desenvolvimento: %s', (url) => {
      expect(parseEnvironment({ ...valid, VITE_API_BASE_URL: url }, true).apiBaseUrl).toBe(url.slice(0, -1));
    },
  );
  it('não permite HTTP remoto em desenvolvimento', () => {
    expect(() => parseEnvironment({ ...valid, VITE_API_BASE_URL: 'http://api.example.com' }, true)).toThrow('HTTPS');
  });
  it.each(['VITE_OIDC_ISSUER', 'VITE_OIDC_CLIENT_ID', 'VITE_OIDC_AUDIENCE'])(
    'exige configuração OIDC: %s', (key) => {
      expect(() => parseEnvironment({ ...valid, [key]: undefined }, false)).toThrow(key);
    },
  );
  it.each(['http://identity.example.com', 'https://user@identity.example.com', 'https://identity.example.com/#'])('valida issuer: %s', (issuer) => {
    expect(() => parseEnvironment({ ...valid, VITE_OIDC_ISSUER: issuer }, false)).toThrow('VITE_OIDC_ISSUER');
  });
});
