import { expect, test } from '@playwright/test';

test('dist abre sem login/token, consulta a API e não contém demonstração', async ({
  page,
}) => {
  const calls: Array<{ url: string; authorization: string | undefined }> = [];
  const oidcCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('identity.example.com'))
      oidcCalls.push(request.url());
  });
  // Respostas sintéticas fornecidas pelo runner; não fazem parte do dist.
  await page.route('https://api.example.com/api/v1/**', async (route) => {
    const request = route.request();
    calls.push({
      url: request.url(),
      authorization: request.headers()['authorization'],
    });
    const path = new URL(request.url()).pathname;
    await route.fulfill({
      json: path.endsWith('/catalog')
        ? { kinds: [], predicates: [] }
        : { items: [], nextCursor: null },
    });
  });
  await page.goto('/map');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: /Entrar|Sair/ })).toHaveCount(
    0,
  );
  await expect(page.getByText('DEMONSTRAÇÃO', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Uma ideia é o começo')).toBeVisible();
  await page.goto('/imports/exemplo');
  await expect(
    page.getByRole('heading', { name: 'Detalhes da importação', exact: true }),
  ).toBeVisible();
  await page.goto('/callback?code=old&state=old');
  await expect(page).toHaveURL(/\/map$/);
  expect(calls.some((call) => call.url.includes('/catalog'))).toBe(true);
  expect(calls.every((call) => call.authorization === undefined)).toBe(true);
  expect(calls.some((call) => call.url.endsWith('/me'))).toBe(false);
  expect(oidcCalls).toEqual([]);
});

test('401 sem token é informado sem renovação ou botão de login', async ({
  page,
}) => {
  const counts = new Map<string, number>();
  await page.route('https://api.example.com/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1);
    await route.fulfill({
      status: 401,
      json: { error: { code: 'unauthorized' } },
    });
  });
  await page.goto('/map');
  await expect(
    page
      .getByText('A API exige autenticação. O frontend está no modo sem token.')
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Entrar/ })).toHaveCount(0);
  expect(counts.get('/api/v1/catalog')).toBe(1);
  expect(counts.has('/api/v1/me')).toBe(false);
});
