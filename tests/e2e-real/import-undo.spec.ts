import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// Fluxo completo contra uma API real: um lote sintético entra pela REST, aparece
// na tela de importação e no mapa, e é desfeito pela interface. Roda só com
// `E2E_API_URL` (API descartável em AUTH_MODE=local); veja playwright.real.config.ts.
const api = process.env.E2E_API_URL;
const skipReason =
  'E2E_API_URL não definida: este E2E exige uma API descartável (AUTH_MODE=local, banco de teste e origem http://127.0.0.1:4173 em ALLOWED_ORIGINS). Defina E2E_API_URL com a origem dela, ex.: http://127.0.0.1:3000.';
// O reporter de lista não mostra o motivo do skip, então ele também vai ao terminal.
if (!api) console.warn(`[e2e-real] teste pulado. ${skipReason}`);
test.skip(!api, skipReason);

// Rótulos e chave únicos por execução: o banco pode já ter dados de outras rodadas.
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const person = `Pessoa sintética E2E ${run}`;
const concept = `Conceito sintético E2E ${run}`;
const key = `e2e-real-${run}`;
// O identificador é único no banco inteiro (até de ponto arquivado): um QID
// novo a cada execução.
const qid = `Q${Date.now()}`;

function batch() {
  return {
    contractVersion: '1',
    policyVersion: '1',
    idempotencyKey: key,
    origin: 'chat',
    inputSummary: `Lote sintético E2E ${run}`,
    dryRun: false,
    nodes: [
      {
        op: 'create',
        clientRef: 'pessoa',
        kind: 'person',
        label: person,
        description:
          'Pessoa fictícia criada pelo E2E; não é registro histórico.',
        startYear: -499,
        endYear: -399,
        precision: 'approximate',
        periodLabel: 'séc. V a.C.',
        identifiers: [{ scheme: 'wikidata', value: qid }],
      },
      {
        op: 'create',
        clientRef: 'conceito',
        kind: 'concept',
        conceptScope: 'broad',
        label: concept,
        description: 'Conceito fictício criado pelo E2E.',
      },
    ],
    relations: [
      {
        op: 'create',
        clientRef: 'relacao',
        type: 'studied',
        source: { clientRef: 'pessoa' },
        target: { clientRef: 'conceito' },
        claim: `Hipótese sintética ${run}`,
        justification: 'Inferência de teste, sem alegação histórica.',
        evidenceStatus: 'inference',
        inferenceAuthor: 'E2E',
        intensity: null,
        evidence: [],
      },
    ],
  };
}

async function pendingBatchIds(request: APIRequestContext) {
  const batches: string[] = [];
  let cursor: string | null = null;
  do {
    const query = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const response = await request.get(
      `${api}/api/v1/pending?limit=200${query}`,
    );
    expect(response.ok()).toBe(true);
    const page: {
      items: { batchId: string }[];
      nextCursor: string | null;
    } = await response.json();
    batches.push(...page.items.map((item) => item.batchId));
    cursor = page.nextCursor;
  } while (cursor);
  return batches;
}

test('lote sintético: importa pela API, aparece na tela e no mapa e é desfeito pela interface', async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/api/v1/imports`, {
    headers: { 'Idempotency-Key': key },
    data: batch(),
  });
  expect(created.ok(), await created.text()).toBe(true);
  const result: {
    batchId: string;
    status: string;
    created: number;
    pending: number;
  } = await created.json();
  expect(result).toMatchObject({ status: 'committed', created: 3, pending: 0 });
  const { batchId } = result;

  // Tela da importação: contagens por resultado e acessibilidade.
  await page.goto(`/imports/${batchId}`);
  await expect(
    page.getByRole('heading', { name: 'Detalhes da importação', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(`Lote sintético E2E ${run}`)).toBeVisible();
  await expect(page.getByText(/Chat · Aplicada/)).toBeVisible();
  const items = (title: string) =>
    page
      .getByRole('heading', { name: title, level: 3 })
      .locator('xpath=following-sibling::*[1]');
  // Só os itens do lote: o aviso "Parecido com" (busca por significado) pode
  // trazer linhas aninhadas, e os outros specs já criaram pontos parecidos.
  await expect(items('Criados').locator(':scope > li')).toHaveCount(3);
  await expect(items('Pendentes')).toHaveText('Nenhum item.');
  await expect(items('Atualizados')).toHaveText('Nenhum item.');
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);

  // Mapa: busca a pessoa, escolhe como raiz e expande até o conceito.
  await page.goto('/map');
  await page.getByLabel('Buscar ponto').fill(person);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(person) }).click();
  // Período e identificador do ponto, vindos da API, no painel.
  const panel = page.locator('.details-panel');
  await expect(
    panel.getByText('Aproximadamente 500 a.C. — 400 a.C. (séc. V a.C.)'),
  ).toBeVisible();
  const wikidata = panel.getByRole('link', {
    name: new RegExp(`Wikidata: ${qid}`),
  });
  await expect(wikidata).toHaveAttribute(
    'href',
    `https://www.wikidata.org/wiki/${qid}`,
  );
  await expect(wikidata).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('img', { name: /Mapa com 2 pontos e 1 relações/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Modo lista' }).click();
  await expect(
    page
      .locator('.graph-list')
      .getByRole('button', { name: concept, exact: true }),
  ).toBeVisible();

  // Desfazer pela interface, com motivo.
  await page.goto(`/imports/${batchId}`);
  await page.getByRole('button', { name: 'Desfazer importação' }).click();
  await page.getByLabel('Motivo para desfazer').fill('Limpeza do E2E real.');
  await page.getByRole('button', { name: 'Confirmar desfazer lote' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Importação desfeita pela API',
  );
  await expect(page.getByText(/Chat · Desfeita/)).toBeVisible();
  await expect(page.getByText('Esta importação foi desfeita.')).toBeVisible();

  // A API confirma: lote desfeito e nenhuma pendência dele.
  const detail = await request.get(`${api}/api/v1/imports/${batchId}`);
  expect((await detail.json()).status).toBe('undone');
  expect(await pendingBatchIds(request)).not.toContain(batchId);
});
