import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Busca na lista de Pontos contra a API real: o QID em modo exato, o endereço
// da Wikidata, trecho do nome sem acento e o filtro de tipo. Roda só com
// `E2E_API_URL` (API descartável em AUTH_MODE=local); veja playwright.real.config.ts.
const api = process.env.E2E_API_URL;
const skipReason =
  'E2E_API_URL não definida: este E2E exige uma API descartável (AUTH_MODE=local, banco de teste e origem http://127.0.0.1:4173 em ALLOWED_ORIGINS). Defina E2E_API_URL com a origem dela, ex.: http://127.0.0.1:3000.';
if (!api) console.warn(`[e2e-real] teste pulado. ${skipReason}`);
test.skip(!api, skipReason);

// Rótulos e chave únicos por execução: o banco pode já ter dados de outras rodadas.
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const base = `Pensador Cândido E2E ${run}`;
const target = `${base} da Escola`;
const decoy = `${base} (conceito)`;
const key = `e2e-real-busca-${run}`;
// O identificador é único no banco inteiro (até de ponto arquivado): um QID
// novo a cada execução, com dígitos a mais para não colidir com os outros specs.
const qid = `Q${Date.now()}77`;

const batch = () => ({
  contractVersion: '1',
  policyVersion: '1',
  idempotencyKey: key,
  origin: 'chat',
  inputSummary: `Lote sintético da busca E2E ${run}`,
  dryRun: false,
  nodes: [
    {
      op: 'create',
      clientRef: 'alvo',
      kind: 'person',
      label: target,
      description: 'Pessoa fictícia criada pelo E2E; não é registro histórico.',
      identifiers: [{ scheme: 'wikidata', value: qid }],
    },
    {
      op: 'create',
      clientRef: 'isca',
      kind: 'concept',
      conceptScope: 'broad',
      label: decoy,
      description: 'Conceito fictício criado pelo E2E.',
    },
  ],
});

const box = (page: Page) => page.getByRole('searchbox', { name: 'Buscar' });
const results = (page: Page) => page.locator('.record-list h2');
const exact = (page: Page) =>
  page.getByRole('checkbox', { name: 'Nome ou identificador exato' });
const search = (page: Page) =>
  page.getByRole('button', { name: 'Buscar', exact: true });

test('pontos: acha pelo QID em modo exato, pelo endereço da Wikidata e por trecho sem acento', async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/api/v1/imports`, {
    headers: { 'Idempotency-Key': key },
    data: batch(),
  });
  expect(created.ok(), await created.text()).toBe(true);
  expect(await created.json()).toMatchObject({
    status: 'committed',
    created: 2,
    pending: 0,
  });

  await page.goto('/nodes');
  await expect(
    page.getByRole('heading', { name: 'Pontos', level: 1 }),
  ).toBeVisible();

  // O QID inteiro, em modo exato: só o ponto dono do identificador.
  await box(page).fill(qid);
  await exact(page).check();
  await search(page).click();
  await expect(page).toHaveURL(new RegExp(`/nodes\\?q=${qid}&match=exact$`));
  await expect(results(page)).toHaveText([target]);
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    '1 registro carregado',
  );
  await expect(
    page.getByRole('link', { name: new RegExp(`Wikidata: ${qid}`) }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);

  // O endereço do registro também é identificador válido: acha o mesmo dono.
  await box(page).fill(`https://www.wikidata.org/wiki/${qid}`);
  await search(page).click();
  await expect(results(page)).toHaveText([target]);

  // Exato exige o nome inteiro: um trecho não acha nada e o vazio sugere desmarcar.
  await box(page).fill(base);
  await search(page).click();
  await expect(page.locator('.empty')).toContainText(
    `Nenhum ponto encontrado para “${base}”. Desmarque “Nome ou identificador exato”`,
  );

  // Sem exato, o trecho sem acento nem caixa acha os dois; o tipo separa.
  await box(page).fill(`pensador candido e2e ${run}`);
  await exact(page).uncheck();
  await search(page).click();
  await expect(results(page)).toHaveCount(2);
  expect((await results(page).allTextContents()).sort()).toEqual(
    [target, decoy].sort(),
  );
  await page.getByRole('combobox', { name: 'Tipo' }).selectOption('concept');
  await search(page).click();
  await expect(results(page)).toHaveText([decoy]);
  await expect(page).toHaveURL(/kind=concept$/);

  // Voltar refaz a busca anterior pela URL.
  await page.goBack();
  await expect(page).not.toHaveURL(/kind=concept/);
  await expect(results(page)).toHaveCount(2);
});
