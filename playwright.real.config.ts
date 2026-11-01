import { defineConfig, devices } from '@playwright/test';

// E2E contra uma API real, não contra as fixtures. Exige uma API descartável
// (banco de teste que pode ser sujo) em AUTH_MODE=local, com a origem
// http://127.0.0.1:4173 em ALLOWED_ORIGINS, e `E2E_API_URL` com a origem dela
// (ex.: http://127.0.0.1:3000). Sem `E2E_API_URL` nada sobe e os testes são
// pulados com uma mensagem. O build vai para `dist-e2e-real`, para não
// sobrescrever o `dist` usado pelos outros E2E.
const api = process.env.E2E_API_URL;
const out = 'dist-e2e-real';

export default defineConfig({
  testDir: './tests/e2e-real',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(api
    ? {
        webServer: {
          // `vite build` direto: sem lint/typecheck, só o bundle apontando para a API.
          command: `npx vite build --outDir ${out} --emptyOutDir && npx vite preview --outDir ${out} --host 127.0.0.1 --port 4173 --strictPort`,
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            VITE_API_BASE_URL: api,
            VITE_AUTH_MODE: 'none',
            VITE_ENABLE_FIXTURES: 'false',
          },
        },
      }
    : {}),
});
