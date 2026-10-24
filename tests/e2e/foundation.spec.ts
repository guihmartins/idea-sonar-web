import { expect, test } from '@playwright/test';
test('dist exige login e não contém demonstração', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));
  await page.goto('/map');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(
    page.getByRole('button', { name: 'Entrar com segurança' }),
  ).toBeVisible();
  await expect(page.getByText('DEMONSTRAÇÃO', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.goto('/imports/exemplo');
  await expect(
    page.getByRole('button', { name: 'Entrar com segurança' }),
  ).toBeVisible();
  expect(requests.filter((url) => url.includes('/api/v1'))).toEqual([]);
});
