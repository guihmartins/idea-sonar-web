import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// Busca por significado contra a API real, com o modelo local de embeddings
// (Xenova/multilingual-e5-small): um lote sintético entra pela REST, o teste
// espera a indexação (que roda depois do commit, de forma assíncrona) e confere
// na interface a busca por paráfrase em Pontos, os pontos parecidos do painel do
// mapa, as sugestões de paralelo com a dispensa, a dica do cadastro e, no fim,
// desfaz o lote. Roda só com `E2E_API_URL` (API descartável em AUTH_MODE=local,
// com pgvector e a busca semântica ligada); `make e2e`, na raiz do workspace,
// sobe tudo isso. Veja playwright.real.config.ts.
const api = process.env.E2E_API_URL;
const skipReason =
  'E2E_API_URL não definida: este E2E exige uma API descartável (AUTH_MODE=local, banco de teste com pgvector, busca semântica ligada e origem http://127.0.0.1:4173 em ALLOWED_ORIGINS). Defina E2E_API_URL com a origem dela, ex.: http://127.0.0.1:3000.';
if (!api) console.warn(`[e2e-real] teste pulado. ${skipReason}`);
test.skip(!api, skipReason);
// O modelo carrega na primeira consulta e a indexação é assíncrona.
test.setTimeout(240_000);

// Rótulos e chave únicos por execução: o banco pode já ter dados de outras rodadas.
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const key = `e2e-real-semantica-${run}`;
const waters = `Memória das águas ${run}`;
const tides = `Memória das marés ${run}`;
const smiths = `Corporação dos ferreiros ${run}`;
// Dois textos que só diferem numa palavra (um par de paralelo) e um assunto sem relação.
const watersText =
  'Ideia de que as águas profundas guardam a lembrança dos antepassados e a devolvem aos vivos na forma de sonhos.';
const tidesText =
  'Ideia de que as águas profundas guardam a lembrança dos antepassados e a devolvem aos vivos na forma de visões.';
const smithsText =
  'Corporação de artesãos que trabalham o ferro em forjas e transmitem de geração em geração a técnica de martelar o metal.';
// Paráfrase da descrição, sem repetir as palavras dela.
const paraphrase =
  'o mar conserva as memórias dos mortos e as traz de volta nos sonhos de quem está vivo';

const concept = (clientRef: string, label: string, description: string) => ({
  op: 'create',
  clientRef,
  kind: 'concept',
  conceptScope: 'broad',
  label,
  description,
});
const batch = () => ({
  contractVersion: '1',
  policyVersion: '1',
  idempotencyKey: key,
  origin: 'chat',
  inputSummary: `Lote sintético da busca por significado E2E ${run}`,
  dryRun: false,
  nodes: [
    concept('aguas', waters, watersText),
    concept('mares', tides, tidesText),
    concept('ferreiros', smiths, smithsText),
  ],
});

interface Hit {
  node: { id: string; label: string };
  score: number;
}
async function semantic(request: APIRequestContext, q: string) {
  const response = await request.get(
    `${api}/api/v1/search/semantic?q=${encodeURIComponent(q)}&includePending=true&limit=50`,
    { timeout: 120_000 },
  );
  expect(response.ok(), await response.text()).toBe(true);
  const body: { items: Hit[] } = await response.json();
  return body.items;
}
async function parallels(request: APIRequestContext) {
  const response = await request.get(
    `${api}/api/v1/suggestions/parallels?limit=50`,
    { timeout: 120_000 },
  );
  expect(response.ok(), await response.text()).toBe(true);
  const body: { items: { a: { id: string }; b: { id: string } }[] } =
    await response.json();
  return body.items.map((pair) => [pair.a.id, pair.b.id].sort().join('|'));
}
async function noViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test('significado: o lote é indexado, a paráfrase acha o ponto, o mapa lista parecidos, o par é dispensado e o lote é desfeito', async ({
  page,
  request,
}) => {
  const created = await request.post(`${api}/api/v1/imports`, {
    headers: { 'Idempotency-Key': key },
    data: batch(),
    timeout: 120_000,
  });
  expect(created.ok(), await created.text()).toBe(true);
  const result: {
    batchId: string;
    status: string;
    created: number;
    pending: number;
    clientRefToId: Record<string, string>;
    items: { clientRef: string; similar?: { id: string }[] }[];
  } = await created.json();
  expect(result).toMatchObject({ status: 'committed', created: 3, pending: 0 });
  const { batchId } = result;
  const ids = result.clientRefToId;
  const [idWaters, idTides, idSmiths] = [
    ids['aguas']!,
    ids['mares']!,
    ids['ferreiros']!,
  ];
  // Com a busca ligada, cada ponto criado traz o campo `similar` (lista, talvez vazia).
  for (const item of result.items)
    expect(Array.isArray(item.similar), item.clientRef).toBe(true);
  const pair = [idWaters, idTides].sort().join('|');

  // A indexação roda depois do commit: espera os pontos aparecerem na busca e o
  // par aparecer entre as sugestões.
  await expect
    .poll(
      async () => {
        const found = (await semantic(request, paraphrase)).map(
          (hit) => hit.node.id,
        );
        return [idWaters, idTides, idSmiths].every((id) => found.includes(id));
      },
      { timeout: 120_000, intervals: [1000, 2000, 3000] },
    )
    .toBe(true);
  await expect
    .poll(async () => (await parallels(request)).includes(pair), {
      timeout: 120_000,
      intervals: [1000, 2000, 3000],
    })
    .toBe(true);

  // Pontos: a busca por significado acha pela paráfrase, os dois parecidos antes do outro assunto.
  await page.goto('/nodes');
  await expect(
    page.getByRole('heading', { name: 'Pontos', level: 1 }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Significado' }).check();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill(paraphrase);
  await page.getByRole('searchbox', { name: 'Buscar' }).press('Enter');
  await expect(page).toHaveURL(/\/nodes\?mode=significado&q=/);
  const titles = page.locator('.record-list h2');
  // A lista por nome também tem estes pontos: espera a de significado (a que tem pontuação).
  await expect(page.locator('.record-list .score').first()).toBeVisible();
  await expect(page.locator('.record-count')).toContainText(
    'em ordem de semelhança',
  );
  const order = (await titles.allTextContents()).map((text) => text.trim());
  expect(order.indexOf(waters)).toBeGreaterThanOrEqual(0);
  expect(order.indexOf(tides)).toBeGreaterThanOrEqual(0);
  expect(order.indexOf(smiths)).toBeGreaterThanOrEqual(0);
  expect(order.indexOf(waters)).toBeLessThan(order.indexOf(smiths));
  expect(order.indexOf(tides)).toBeLessThan(order.indexOf(smiths));
  const card = page
    .locator('.record-list article')
    .filter({ has: page.getByRole('heading', { name: waters }) });
  await expect(card.locator('.score')).toHaveText(/^semelhança 0,\d\d$/);
  await expect(
    page.getByText(
      'Ordem por sentido do texto. Semelhança não é identidade: confira antes de reutilizar.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await noViolations(page);

  // Mapa: o painel do ponto lista os parecidos e ativar a linha traz o ponto.
  await page.goto('/map');
  await page.getByLabel('Buscar ponto').fill(waters);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(waters) }).click();
  const panel = page.locator('.details-panel');
  await expect(
    panel.getByRole('heading', { name: waters, level: 2 }),
  ).toBeVisible();
  const similar = panel.getByRole('list', {
    name: 'Pontos parecidos com este',
  });
  await expect(similar.getByRole('listitem').first()).toContainText(tides);
  await expect(
    similar.getByRole('listitem').first().locator('.score'),
  ).toHaveText(/^semelhança 0,\d\d$/);
  await expect(
    panel.getByText('Pistas pelo sentido do texto; não indicam relação.'),
  ).toBeVisible();
  await noViolations(page);
  await similar.getByRole('listitem').first().getByRole('button').click();
  await expect(
    panel.getByRole('heading', { name: tides, level: 2 }),
  ).toBeVisible();

  // Sugestões: o par aparece; "Registrar paralelo" só abre o editor; dispensar guarda o motivo.
  await page.goto('/sugestoes');
  await expect(
    page.getByRole('heading', { name: 'Sugestões', level: 1 }),
  ).toBeVisible();
  // Com o modelo real outros pares também passam do limiar: acha o deste lote.
  const suggestion = page
    .getByRole('article')
    .filter({ has: page.getByRole('link', { name: waters, exact: true }) })
    .filter({ has: page.getByRole('link', { name: tides, exact: true }) });
  await expect(suggestion).toHaveCount(1);
  await expect(
    suggestion.getByRole('link', { name: tides, exact: true }),
  ).toBeVisible();
  await expect(suggestion.locator('.score')).toHaveText(/^semelhança 0,\d\d$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await noViolations(page);
  const register = suggestion.getByRole('link', { name: 'Registrar paralelo' });
  const href = (await register.getAttribute('href')) ?? '';
  expect(href).toContain('type=parallel_to');
  expect(href).toContain('evidenceStatus=inference');
  expect(href).toContain(idWaters);
  expect(href).toContain(idTides);
  await suggestion.getByRole('button', { name: 'Dispensar' }).click();
  await page.getByLabel('Motivo para dispensar').fill('Par sintético do E2E.');
  await page.getByRole('button', { name: 'Dispensar par' }).click();
  await expect(suggestion).toHaveCount(0);
  await expect(page.getByText(/^Par dispensado:/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // A API confirma: o par não volta, e repetir a dispensa devolve o primeiro registro.
  expect(await parallels(request)).not.toContain(pair);
  const again = await request.post(
    `${api}/api/v1/suggestions/parallels/dismiss`,
    {
      data: { a: idTides, b: idWaters, reason: 'Outro motivo.' },
      timeout: 120_000,
    },
  );
  expect(again.ok(), await again.text()).toBe(true);
  expect(await again.json()).toMatchObject({
    kind: 'parallel',
    reason: 'Par sintético do E2E.',
  });

  // Cadastro de ponto novo: a dica aparece com nome e descrição, sem bloquear o salvar.
  await page.goto('/edit/nodes');
  await page
    .getByLabel('Nome', { exact: true })
    .fill(`Lembrança do mar ${run}`);
  await page.getByLabel('Descrição', { exact: true }).fill(watersText);
  await expect(
    page.getByRole('heading', {
      name: 'Confira antes de criar: pontos com sentido parecido',
    }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.locator('.similar-hint').getByRole('link', { name: waters }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Salvar registro' }),
  ).toBeEnabled();
  await noViolations(page);

  // O detalhe do lote lê o aviso de parecidos contra os pontos de agora.
  await page.goto(`/imports/${batchId}`);
  await expect(
    page.getByRole('heading', { name: 'Criados', level: 3 }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await noViolations(page);

  // Desfazer pela interface, com motivo, como nos outros E2E reais.
  await page.getByRole('button', { name: 'Desfazer importação' }).click();
  await page.getByLabel('Motivo para desfazer').fill('Limpeza do E2E real.');
  await page.getByRole('button', { name: 'Confirmar desfazer lote' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Importação desfeita pela API',
  );
  const detail = await request.get(`${api}/api/v1/imports/${batchId}`);
  const undone: { status: string; result: { items: { similar?: unknown }[] } } =
    await detail.json();
  expect(undone.status).toBe('undone');
  // Lote desfeito não traz aviso de parecidos.
  for (const item of undone.result.items)
    expect(item).not.toHaveProperty('similar');
});
