// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vite = fileURLToPath(
  new URL('../../node_modules/vite/bin/vite.js', import.meta.url),
);

describe('validação na entrada real do Vite', () => {
  it('bloqueia fixtures também no CLI real de build', () => {
    const result = spawnSync(process.execPath, [vite, 'build'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, VITE_ENABLE_FIXTURES: 'true' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fixtures proibidas');
  });
  it.each([
    { label: 'URL ausente', api: '', args: [], nodeEnv: 'production' },
    {
      label: 'caminho não raiz',
      api: 'https://api.example.com/api/v1',
      args: [],
      nodeEnv: 'production',
    },
    {
      label: 'HTTP com mode development',
      api: 'http://localhost:3000',
      args: ['--mode', 'development'],
      nodeEnv: 'production',
    },
    {
      label: 'HTTP com NODE_ENV development',
      api: 'http://localhost:3000',
      args: [],
      nodeEnv: 'development',
    },
  ])('bloqueia $label antes de emitir bundle', ({ api, args, nodeEnv }) => {
    const result = spawnSync(process.execPath, [vite, 'build', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        NODE_ENV: nodeEnv,
        VITE_API_BASE_URL: api,
        VITE_OIDC_ISSUER: 'https://identity.example.com/',
        VITE_OIDC_CLIENT_ID: 'public-test-spa',
        VITE_OIDC_AUDIENCE: 'test-api',
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('VITE_API_BASE_URL');
  });
});
