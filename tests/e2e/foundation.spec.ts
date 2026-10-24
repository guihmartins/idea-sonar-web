import { expect, test } from '@playwright/test';

test('estrutura acessível, navegação e recarga de deep link', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/map');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Explore conexões entre ideias');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('link', { name: 'Importações', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Importações');
  await page.goto('/imports/exemplo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Detalhes da importação');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  // O primeiro marco não realiza chamadas sem autenticação nem carrega fixtures.
  expect(requests.filter((url) => url.includes('/api/v1'))).toEqual([]);
});
