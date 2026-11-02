import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Busca por significado (API fictícia, contrato 1.3.0): a busca em Pontos, a
// página Sugestões com a dispensa e a seção "Pontos parecidos" do painel do
// mapa. Teclado, URL, axe WCAG A/AA e sem rolagem horizontal, em desktop e
// celular (projetos de playwright.fixtures.config.ts).
const tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];
async function noViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(result.violations).toEqual([]);
}
async function noHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}
const individuation = 'Individuação (exemplo fictício)';
const coniunctio = 'Coniunctio (exemplo fictício)';
const phrase = 'união de opostos como caminho de autoconhecimento';
const box = (page: Page) => page.getByRole('searchbox', { name: 'Buscar' });
const titles = (page: Page) => page.locator('.record-list h2');

test.beforeEach(async ({ page }) => {
  await page.goto('/map');
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
});

test('pontos: busca por significado, URL, voltar e avançar, vazio e axe', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Pontos', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Pontos', level: 1 }),
  ).toBeVisible();
  const mode = page.getByRole('radiogroup', { name: 'Buscar por' });
  await expect(mode.getByRole('radio', { name: 'Nome' })).toBeChecked();
  await noViolations(page);

  // O texto digitado atravessa a troca de modo; o período some.
  await box(page).fill('opostos');
  await mode.getByRole('radio', { name: 'Significado' }).check();
  await expect(page).toHaveURL(/\/nodes\?mode=significado&q=opostos$/);
  await expect(mode.getByRole('radio', { name: 'Significado' })).toBeChecked();
  await expect(box(page)).toHaveValue('opostos');
  await expect(page.getByRole('group', { name: 'Tipo e período' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: 'Nome ou identificador exato' }),
  ).toHaveCount(0);

  await box(page).fill(phrase);
  await box(page).press('Enter');
  await expect(page).toHaveURL(/mode=significado&q=uni%C3%A3o\+de\+opostos/);
  await expect(titles(page).first()).toHaveText(individuation);
  await expect(titles(page).nth(1)).toHaveText(coniunctio);
  await expect(
    page.locator('.record-list article').first().locator('.score'),
  ).toHaveText(/^semelhança 0,\d\d$/);
  await expect(page.locator('.record-count')).toContainText(
    'em ordem de semelhança',
  );
  await expect(
    page.getByText(
      'Ordem por sentido do texto. Semelhança não é identidade: confira antes de reutilizar.',
    ),
  ).toBeVisible();
  await expect(page.locator('.primary')).toHaveCount(1);
  await noViolations(page);
  await noHorizontalScroll(page);

  // Voltar restaura a busca por nome; avançar, a por significado.
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/\/nodes$/);
  await expect(mode.getByRole('radio', { name: 'Nome' })).toBeChecked();
  await expect(titles(page)).toHaveCount(2);
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(/mode=significado&q=uni%C3%A3o\+de\+opostos/);
  await expect(titles(page).first()).toHaveText(individuation);

  // Nada em comum: o vazio nomeia a busca, sem a linha de ordem.
  await box(page).fill('zzz yyy');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.empty')).toHaveText(
    'Nenhum ponto de sentido parecido com “zzz yyy”.',
  );
  await noViolations(page);

  // Limpar continua em Significado; o teclado troca de modo com as setas.
  await page.getByRole('button', { name: 'Limpar' }).click();
  await expect(page).toHaveURL(/\/nodes\?mode=significado$/);
  await mode.getByRole('radio', { name: 'Significado' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/nodes$/);
  await expect(mode.getByRole('radio', { name: 'Nome' })).toBeFocused();
});

test('sugestões: o par, registrar paralelo no editor e dispensar com motivo', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Sugestões', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sugestões', level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sugestoes$/);
  await expect(page.getByText(/Semelhança não prova influência/)).toBeVisible();
  const pair = page.getByRole('article');
  await expect(pair).toHaveCount(1);
  await expect(pair.getByRole('link', { name: individuation })).toBeVisible();
  await expect(pair.getByRole('link', { name: coniunctio })).toBeVisible();
  await expect(pair.locator('.score')).toHaveText(/^semelhança 0,\d\d$/);
  await expect(page.locator('.record-count')).toHaveText('1 par sugerido');
  await noViolations(page);
  await noHorizontalScroll(page);

  // "Registrar paralelo" só abre o editor preenchido; nada é gravado.
  await pair.getByRole('link', { name: 'Registrar paralelo' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cadastrar relação', level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/edit\/relations\?type=parallel_to&sourceId=.+&targetId=.+&evidenceStatus=inference$/,
  );
  await expect(page.getByRole('combobox', { name: 'Predicado' })).toHaveValue(
    'parallel_to',
  );
  await expect(
    page.getByRole('group', { name: 'Ponto de origem' }),
  ).toContainText(`Selecionado: ${individuation}`);
  await expect(
    page.getByRole('group', { name: 'Ponto de destino' }),
  ).toContainText(`Selecionado: ${coniunctio}`);
  await expect(page.getByRole('textbox', { name: 'Afirmação' })).toHaveValue(
    '',
  );
  await noViolations(page);

  // De volta, o par segue lá (nada foi salvo); dispensar pede o motivo.
  await page.getByRole('link', { name: 'Sugestões', exact: true }).click();
  await expect(pair).toHaveCount(1);
  await pair.getByRole('button', { name: 'Dispensar' }).click();
  const form = page.getByRole('group', {
    name: `Dispensar ${individuation} e ${coniunctio}`,
  });
  // O foco vai para o motivo, que é obrigatório: sem ele o navegador não envia.
  const reason = form.getByLabel('Motivo para dispensar');
  await expect(reason).toBeFocused();
  await noViolations(page);
  await form.getByRole('button', { name: 'Dispensar par' }).click();
  expect(
    await reason.evaluate(
      (el) => (el as HTMLTextAreaElement).validity.valueMissing,
    ),
  ).toBe(true);
  await expect(pair).toHaveCount(1);
  await reason.fill('Parecem iguais só pelo vocabulário.');
  await form.getByRole('button', { name: 'Dispensar par' }).click();
  await expect(pair).toHaveCount(0);
  await expect(
    page.getByText(
      `Par dispensado: “${individuation}” e “${coniunctio}” não serão sugeridos de novo.`,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Nenhuma sugestão agora. Elas aparecem quando há pontos com textos parecidos e sem relação entre si.',
    ),
  ).toBeVisible();
  await noViolations(page);
});

test('mapa: pontos parecidos no painel do ponto e ativar uma linha', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Individua');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Individuação.*Conceito/ }).click();
  const panel = page.locator('.details-panel');
  await expect(
    panel.getByRole('heading', { name: individuation, level: 2 }),
  ).toBeVisible();
  const similar = panel.getByRole('list', {
    name: 'Pontos parecidos com este',
  });
  await expect(
    panel.getByRole('heading', { name: 'Pontos parecidos', level: 3 }),
  ).toBeVisible();
  await expect(similar.getByRole('listitem')).toHaveCount(5);
  const first = similar.getByRole('listitem').first();
  await expect(first).toContainText(coniunctio);
  await expect(first).toContainText('Conceito');
  await expect(first.locator('.score')).toHaveText(/^semelhança 0,\d\d$/);
  await expect(
    panel.getByText('Pistas pelo sentido do texto; não indicam relação.'),
  ).toBeVisible();
  await noViolations(page);
  await noHorizontalScroll(page);

  // Ativar a linha traz o ponto para o mapa, como o resultado da busca.
  await first.getByRole('button').click();
  await expect(
    panel.getByRole('heading', { name: coniunctio, level: 2 }),
  ).toBeVisible();
  await expect(
    panel
      .getByRole('list', { name: 'Pontos parecidos com este' })
      .getByRole('listitem')
      .first(),
  ).toContainText(individuation);
  await noViolations(page);
});

test('importação: o item criado traz "Parecido com" e o aviso', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Importações', exact: true }).click();
  await page.getByRole('link', { name: 'Importação fictícia' }).click();
  await expect(
    page.getByRole('heading', { name: 'Criados', level: 3 }),
  ).toBeVisible();
  await expect(page.getByText('Parecido com:')).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: 'Parecidos com individuacao' }),
  ).toContainText(coniunctio);
  await expect(
    page.getByText('Aviso, não desfecho: confira se não é o mesmo ponto.'),
  ).toBeVisible();
  await noViolations(page);
  await noHorizontalScroll(page);
});

test('cadastro de ponto novo: "Confira antes de criar" depois de nome e descrição', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Novo ponto', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('União dos contrários');
  await expect(
    page.getByRole('heading', {
      name: 'Confira antes de criar: pontos com sentido parecido',
    }),
  ).toHaveCount(0);
  await page
    .getByLabel('Descrição', { exact: true })
    .fill(
      'Texto sintético sobre a união de opostos como caminho de autoconhecimento.',
    );
  const hint = page.getByRole('heading', {
    name: 'Confira antes de criar: pontos com sentido parecido',
  });
  await expect(hint).toBeVisible();
  const region = page.locator('.similar-hint');
  await expect(region.getByRole('listitem')).toHaveCount(3);
  await expect(
    region.getByRole('link', { name: individuation }),
  ).toHaveAttribute('href', /\/edit\/nodes\/.+/);
  await noViolations(page);
  await noHorizontalScroll(page);
  // É dica: salvar continua liberado.
  await expect(
    page.getByRole('button', { name: 'Salvar registro' }),
  ).toBeEnabled();
});
