import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Conceito contextual contra a API real: o REST não ativa ponto e relação um
// antes do outro, então o editor grava os dois em um único POST /imports. Roda
// só com `E2E_API_URL` (API descartável); veja playwright.real.config.ts.
const api = process.env.E2E_API_URL;
test.skip(
  !api,
  'E2E_API_URL não definida: este E2E exige uma API descartável (AUTH_MODE=local).',
);

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const context = `Contexto sintético E2E ${run}`;
const broad = `Conceito amplo sintético E2E ${run}`;
const contextual = `Conceito contextual sintético E2E ${run}`;

test('cria um conceito contextual ativo pelo editor, em um único lote', async ({
  page,
  request,
}) => {
  const post = async (path: string, data: unknown, key: string) => {
    const response = await request.post(`${api}/api/v1/${path}`, {
      headers: { 'Idempotency-Key': `${key}-${run}` },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const ctx = await post(
    'contexts',
    { label: context, precision: 'unknown' },
    'ctx',
  );
  const amplo = await post(
    'nodes',
    {
      kind: 'concept',
      conceptScope: 'broad',
      label: broad,
      description: 'Conceito amplo fictício criado pelo E2E.',
      aliases: [],
      contexts: [],
      status: 'active',
    },
    'amplo',
  );

  await page.goto('/edit/nodes');
  await page.getByLabel('Nome', { exact: true }).fill(contextual);
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Conceito contextual fictício criado pelo E2E.');
  await page
    .getByRole('combobox', { name: 'Tipo', exact: true })
    .selectOption('concept');
  await page
    .getByRole('combobox', { name: 'Escopo do conceito', exact: true })
    .selectOption('contextual');
  const contexts = page.getByRole('group', { name: 'Contextos', exact: true });
  await contexts
    .getByRole('textbox', { name: 'Buscar candidato' })
    .fill(context);
  await contexts.getByRole('checkbox', { name: context }).check();
  const group = page.getByRole('group', {
    name: 'Contextualização',
    exact: true,
  });
  const picker = group.getByRole('group', { name: 'Conceito amplo' });
  await picker.getByRole('textbox', { name: 'Buscar candidato' }).fill(broad);
  await picker.getByRole('radio', { name: new RegExp(broad) }).check();
  await group
    .getByRole('textbox', { name: 'Afirmação da contextualização' })
    .fill('Afirmação sintética da contextualização.');
  await group
    .getByRole('textbox', { name: 'Justificativa da contextualização' })
    .fill('Justificativa sintética do E2E.');
  await group
    .getByRole('textbox', { name: 'Autoria da inferência' })
    .fill('E2E');
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByText(/Conceito contextual criado e ativado\./),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Editar ponto' }),
  ).toBeVisible();

  // A API confirma: ponto ativo e contextualização ativa para o conceito amplo.
  const found = await request.get(
    `${api}/api/v1/nodes?q=${encodeURIComponent(contextual)}`,
  );
  const nodes: { items: { id: string; status: string }[] } = await found.json();
  expect(nodes.items).toHaveLength(1);
  expect(nodes.items[0]?.status).toBe('active');
  const links = await request.get(
    `${api}/api/v1/relations?nodeId=${nodes.items[0]?.id}&type=contextualizes&includePending=true`,
  );
  const relations: {
    items: { status: string; targetId: string; sourceId: string }[];
  } = await links.json();
  expect(relations.items).toHaveLength(1);
  expect(relations.items[0]).toMatchObject({
    status: 'active',
    sourceId: nodes.items[0]?.id,
    targetId: amplo.id,
  });
  expect(ctx.id).toBeTruthy();

  // Abrir o link do resultado leva à importação gravada.
  await page.getByRole('link', { name: 'Ver importação' }).click();
  await expect(
    page.getByRole('heading', { name: 'Detalhes da importação' }),
  ).toBeVisible();
  await expect(
    page.getByText('Conceito contextual criado no editor'),
  ).toBeVisible();
});
