import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
test('mapa, formulários e pendências sem violações automáticas WCAG A/AA', async ({
  page,
}) => {
  await page.goto('/map');
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
  for (const link of ['', 'Novo ponto', 'Pendências']) {
    if (link) await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
