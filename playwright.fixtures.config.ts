import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e-fixtures',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command:
      'npm run dev:fixtures -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: {
      VITE_API_BASE_URL: 'https://api.example.com',
      VITE_OIDC_ISSUER: 'https://identity.example.com/',
      VITE_OIDC_CLIENT_ID: 'public-fixture-spa',
      VITE_OIDC_AUDIENCE: 'https://api.example.com',
    },
  },
});
