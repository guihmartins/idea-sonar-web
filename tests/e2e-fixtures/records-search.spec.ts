import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Busca nas listas de Pontos, Fontes e Contextos (API fictícia): teclado,
// estado na URL, voltar/avançar, estado vazio, erro de ano e axe WCAG A/AA.
// Roda em desktop e celular (projetos de playwright.fixtures.config.ts).
const tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];
async function noViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(result.violations).toEqual([]);
}
const box = (page: Page) => page.getByRole('searchbox', { name: 'Buscar' });
const status = (page: Page) => page.locator('[aria-live="polite"]');
const results = (page: Page) => page.locator('.record-list h2');
const exact = (page: Page) =>
  page.getByRole('checkbox', { name: 'Nome ou identificador exato' });

test.beforeEach(async ({ page }) => {
  await page.goto('/map');
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Pontos', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Pontos', level: 1 }),
  ).toBeVisible();
});

test('pontos: busca por Enter, URL, voltar e avançar, exato, vazio e Limpar', async ({
  page,
}) => {
  await expect(status(page)).toHaveText('2 registros carregados · há mais');
  await noViolations(page);
  // O botão primário da tela segue sendo só "Cadastrar".
  await expect(page.locator('.primary')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Cadastrar' })).toHaveClass(
    /primary/,
  );

  await box(page).fill('JUNG');
  await box(page).press('Enter');
  await expect(page).toHaveURL(/\/nodes\?q=JUNG$/);
  await expect(results(page)).toHaveText(['Jung (exemplo fictício)']);
  await expect(status(page)).toHaveText('1 registro carregado');
  await noViolations(page);

  // Voltar refaz a lista sem busca e o formulário; avançar refaz a busca.
  await page.goBack();
  await expect(page).toHaveURL(/\/nodes$/);
  await expect(box(page)).toHaveValue('');
  await expect(results(page)).toHaveCount(2);
  await page.goForward();
  await expect(page).toHaveURL(/\/nodes\?q=JUNG$/);
  await expect(box(page)).toHaveValue('JUNG');
  await expect(results(page)).toHaveText(['Jung (exemplo fictício)']);

  // Exato não acha trecho: o vazio nomeia a busca e sugere desmarcar "exato".
  await box(page).fill('gnosticismo');
  await exact(page).check();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/nodes\?q=gnosticismo&match=exact$/);
  await expect(page.locator('.empty')).toHaveText(
    'Nenhum ponto encontrado para “gnosticismo”. Desmarque “Nome ou identificador exato” para buscar por trecho.',
  );
  await expect(status(page)).toHaveText('0 registros carregados');
  await noViolations(page);

  await exact(page).uncheck();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(results(page)).toHaveText(['Gnosticismo (exemplo fictício)']);

  await page.getByRole('button', { name: 'Limpar' }).click();
  await expect(page).toHaveURL(/\/nodes$/);
  await expect(box(page)).toHaveValue('');
  await expect(exact(page)).not.toBeChecked();
  await expect(results(page)).toHaveCount(2);
});

test('pontos: tipo, período em a.C./d.C., erro de ano e "Carregar mais" dentro da busca', async ({
  page,
}) => {
  const kind = page.getByRole('combobox', { name: 'Tipo' });
  await expect(kind.locator('option')).toHaveText([
    'Todos',
    'Pessoa',
    'Tradição',
    'Conceito',
    'Obra',
    'Figura',
  ]);
  await kind.selectOption('work');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/nodes\?kind=work$/);
  await expect(results(page)).toHaveText(['Obra de demonstração']);

  await kind.selectOption('');
  await page.getByRole('spinbutton', { name: 'Ano inicial' }).fill('5');
  await page
    .getByRole('combobox', { name: 'Era do início' })
    .selectOption('bce');
  await page.getByRole('spinbutton', { name: 'Ano final' }).fill('10');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/nodes\?startYear=-4&endYear=10$/);
  await expect(results(page)).toHaveCount(2);
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(results(page)).toHaveCount(4);
  await expect(status(page)).toHaveText('4 registros carregados · há mais');
  await page.getByRole('button', { name: 'Carregar mais' }).click();
  await expect(results(page)).toHaveCount(6);
  await expect(status(page)).toHaveText('6 registros carregados');

  // Sem período desconhecido, só os dois pontos que o contexto fictício cobre.
  await page
    .getByRole('checkbox', { name: 'Incluir período desconhecido' })
    .uncheck();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(
    /\/nodes\?startYear=-4&endYear=10&includeUnknownPeriod=false$/,
  );
  await expect(results(page)).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Carregar mais' })).toHaveCount(
    0,
  );

  // Ano fora dos limites da API: erro no campo, a URL não muda.
  await page.getByRole('spinbutton', { name: 'Ano inicial' }).fill('100002');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Ano fora do intervalo aceito: de 100001 a.C. a 3000 d.C.',
  );
  await expect(page).toHaveURL(/includeUnknownPeriod=false$/);
  await expect(
    page.getByRole('spinbutton', { name: 'Ano inicial' }),
  ).toHaveAttribute('aria-invalid', 'true');
  await noViolations(page);
});

test('fontes e contextos: busca sem acento, sem tipo nem período, pendentes e axe', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Fontes', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fontes', level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByText('Incluir período desconhecido')).toHaveCount(0);
  await expect(status(page)).toHaveText('1 registro carregado');
  await noViolations(page);

  await box(page).fill('SINTETICA');
  await box(page).press('Enter');
  await expect(page).toHaveURL(/\/sources\?q=SINTETICA$/);
  await expect(results(page)).toHaveText(['Fonte sintética de demonstração']);
  // O endereço inteiro, em modo exato, também acha a fonte.
  await box(page).fill('https://example.com/fonte-ficticia');
  await exact(page).check();
  await page.getByRole('checkbox', { name: 'Incluir pendentes' }).check();
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(
    /\/sources\?q=https%3A%2F%2Fexample\.com%2Ffonte-ficticia&match=exact&includePending=true$/,
  );
  await expect(results(page)).toHaveText(['Fonte sintética de demonstração']);
  await box(page).fill('example.com');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.empty')).toContainText(
    'Nenhuma fonte encontrada para “example.com”.',
  );
  await noViolations(page);

  await page.getByRole('link', { name: 'Contextos', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Contextos', level: 1 }),
  ).toBeVisible();
  await expect(box(page)).toHaveValue('');
  await box(page).fill('FICTICIO');
  await box(page).press('Enter');
  await expect(results(page)).toHaveText(['Contexto fictício']);
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toHaveCount(0);
  await noViolations(page);
});

test('relações e views não ganham busca', async ({ page }) => {
  for (const name of ['Relações', 'Views salvas']) {
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByRole('search')).toHaveCount(0);
    await expect(status(page)).toHaveCount(0);
  }
});
