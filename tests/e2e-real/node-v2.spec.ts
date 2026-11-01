import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Modelo de dados v2 contra a API real: figura com período e identificador pelo
// editor, e a recusa de um identificador que já é de outro ponto. Roda só com
// `E2E_API_URL` (API descartável); veja playwright.real.config.ts.
const api = process.env.E2E_API_URL;
test.skip(
  !api,
  'E2E_API_URL não definida: este E2E exige uma API descartável (AUTH_MODE=local).',
);

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// Identificador único no banco inteiro: um QID novo a cada execução.
const qid = `Q${Date.now() + 1}`;

test('figura com período e identificador; identificador repetido é recusado na linha', async ({
  page,
  request,
}) => {
  async function fill(label: string, identifier: string) {
    await page.goto('/edit/nodes');
    await page.getByLabel('Nome', { exact: true }).fill(label);
    await page
      .getByLabel('Descrição', { exact: true })
      .fill('Figura fictícia criada pelo E2E.');
    await page
      .getByRole('combobox', { name: 'Tipo', exact: true })
      .selectOption('figure');
    await page
      .getByRole('spinbutton', { name: 'Ano inicial', exact: true })
      .fill('500');
    await page
      .getByRole('combobox', { name: 'Era do início', exact: true })
      .selectOption('bce');
    await page
      .getByRole('combobox', { name: 'Precisão do período' })
      .selectOption('approximate');
    const group = page.getByRole('group', {
      name: 'Identificadores',
      exact: true,
    });
    await group
      .getByRole('button', { name: 'Adicionar identificador' })
      .click();
    await group.getByRole('textbox', { name: 'Valor 1' }).fill(identifier);
    await page.getByRole('button', { name: 'Salvar registro' }).click();
    return group;
  }

  const first = `Figura E2E ${run}`;
  const group = await fill(first, `https://www.wikidata.org/wiki/${qid}`);
  await expect(page.getByText('Registro salvo.')).toBeVisible();
  // A API devolve a forma normalizada e o formulário a mostra.
  await expect(group.getByRole('textbox', { name: 'Valor 1' })).toHaveValue(
    qid,
  );
  const found = await request.get(
    `${api}/api/v1/nodes?q=${encodeURIComponent(first)}&match=exact`,
  );
  const body: { items: Record<string, unknown>[] } = await found.json();
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    kind: 'figure',
    startYear: -499,
    endYear: null,
    precision: 'approximate',
    identifiers: [{ scheme: 'wikidata', value: qid }],
  });

  const second = await fill(`Figura repetida E2E ${run}`, qid);
  await expect(
    second.getByText('Identificador já cadastrado em outro ponto'),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Conflito de edição' }),
  ).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
});
