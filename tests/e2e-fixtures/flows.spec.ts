import { expect, test } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/map');
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
});
test('buscar, expandir, ler evidência, salvar/restaurar view e resolver pendência', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page
    .getByRole('button', { name: /Jung \(exemplo fictício\).*Pessoa/ })
    .click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('button', { name: 'Mais conexões' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mais conexões' }).click();
  await page.getByRole('button', { name: 'Modo lista' }).click();
  const list = page.locator('.graph-list');
  await list
    .getByRole('button', {
      name: 'Gnosticismo (exemplo fictício)',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await list
    .getByRole('button', { name: /Jung.*estudou.*Gnosticismo.*Interpretação/ })
    .click();
  await expect(
    page.getByRole('heading', { name: /Afirmação inteiramente fictícia/ }),
  ).toBeVisible();
  await expect(page.getByText('Página fictícia 12')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Fonte sintética/ }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await page.getByLabel('Nome da view').fill('Meu recorte de teste');
  await page.getByRole('button', { name: 'Salvar view' }).click();
  await expect(page.getByRole('status')).toContainText('View salva');
  await page.getByRole('link', { name: 'Views salvas', exact: true }).click();
  await page.getByRole('link', { name: 'Restaurar view' }).click();
  await expect(page.getByRole('status')).toContainText(
    'View restaurada com dados atuais',
  );
  await page.getByRole('link', { name: 'Pendências', exact: true }).click();
  const candidate = page.getByRole('combobox', {
    name: 'Candidato',
    exact: true,
  });
  await expect(candidate.locator('option')).toHaveCount(2);
  await candidate.selectOption({ index: 1 });
  await page
    .getByLabel('Justificativa da resolução')
    .fill('Candidato revisado no cenário fictício.');
  await page.getByRole('button', { name: 'Resolver pendência' }).click();
  await expect(page.getByText('Nenhuma pendência encontrada.')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test('cadastra, edita, consulta histórico e arquiva ponto', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Novo ponto', exact: true }).click();
  await page
    .getByLabel('Nome', { exact: true })
    .fill('Autor inteiramente fictício');
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Registro sintético criado pelo E2E.');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo.' }),
  ).toHaveText('Registro salvo.');
  await page
    .getByLabel('Descrição', { exact: true })
    .fill('Descrição revisada.');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo.' }),
  ).toHaveText('Registro salvo.');
  await page.getByRole('link', { name: 'Ver histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Criação' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Edição' })).toBeVisible();
  await expect(page.getByText(/Versão 2 · campos: description/)).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao registro' }).click();
  await expect(page.getByLabel('Descrição', { exact: true })).toHaveValue(
    'Descrição revisada.',
  );
  await page.getByRole('button', { name: 'Arquivar registro' }).click();
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Registro arquivado pela API.',
  );
});
test('consulta importação, confirma desfazer e encerra sessão', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Importações', exact: true }).click();
  await page.getByRole('link', { name: 'Importação fictícia' }).click();
  await page.getByRole('button', { name: 'Desfazer importação' }).click();
  await page
    .getByLabel('Motivo para desfazer')
    .fill('Lote fictício revertido no teste.');
  await page.getByRole('button', { name: 'Confirmar desfazer lote' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Importação desfeita pela API',
  );
  await expect(page.getByText('Esta importação foi desfeita.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar na demonstração fictícia' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('formulários de fonte, contexto histórico e relação validam evidências', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Fontes', exact: true }).click();
  await page.getByRole('link', { name: 'Cadastrar', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Fonte fictícia E2E');
  await page.getByLabel('Autor da fonte').fill('Autoria sintética');
  await page
    .getByLabel('URL da fonte (HTTP/HTTPS)')
    .fill('https://example.com/test');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo.' }),
  ).toHaveText('Registro salvo.');
  await page.getByRole('link', { name: 'Contextos', exact: true }).click();
  await page.getByRole('link', { name: 'Cadastrar', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('Contexto fictício E2E');
  await page
    .getByRole('spinbutton', { name: 'Ano inicial', exact: true })
    .fill('1');
  await page
    .getByRole('combobox', { name: 'Era do início', exact: true })
    .selectOption('bce');
  await page
    .getByRole('spinbutton', { name: 'Ano final', exact: true })
    .fill('2');
  await page
    .getByRole('combobox', { name: 'Era do fim', exact: true })
    .selectOption('ce');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo.' }),
  ).toHaveText('Registro salvo.');
  await page.getByRole('link', { name: 'Relações', exact: true }).click();
  await page.getByRole('link', { name: 'Cadastrar', exact: true }).click();
  const origin = page.getByRole('group', {
    name: 'Ponto de origem',
    exact: true,
  });
  await origin.getByRole('textbox', { name: 'Buscar candidato' }).fill('Jung');
  await origin.getByRole('radio').check();
  const target = page.getByRole('group', {
    name: 'Ponto de destino',
    exact: true,
  });
  await target
    .getByRole('textbox', { name: 'Buscar candidato' })
    .fill('Gnosticismo');
  await target.getByRole('radio').check();
  await page
    .getByRole('combobox', { name: 'Predicado', exact: true })
    .selectOption('studied');
  await page
    .getByLabel('Afirmação', { exact: true })
    .fill('Afirmação de teste, sem valor histórico.');
  await page
    .getByLabel('Justificativa', { exact: true })
    .fill('Justificativa sintética do teste.');
  await page
    .getByRole('combobox', { name: 'Classificação da evidência' })
    .selectOption('documented');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Uma fonte é obrigatória',
  );
  await page.getByRole('button', { name: 'Adicionar evidência' }).click();
  await page
    .getByRole('combobox', { name: 'Fonte', exact: true })
    .selectOption({ label: 'Fonte fictícia E2E · Autoria sintética' });
  await page.getByLabel('Localizador / página').fill('p. 1');
  await page
    .getByLabel('Explicação da evidência')
    .fill('Evidência sintética que sustenta a afirmação.');
  await page.getByRole('button', { name: 'Salvar registro' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Registro salvo.' }),
  ).toHaveText('Registro salvo.');
});

test('preserva posição arrastada ao expandir e ao alternar modo lista', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  const canvas = page.getByRole('img', { name: /Mapa com 1 pontos/ });
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Mapa sem dimensão.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 40,
    box.y + box.height / 2 + 25,
    { steps: 10 },
  );
  await page.mouse.up();
  await page.getByLabel('Nome da view').fill('Antes da expansão');
  await page.getByRole('button', { name: 'Salvar view' }).click();
  await expect(page.getByText('View salva.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Modo lista' }).click();
  await page.getByRole('button', { name: 'Mostrar grafo' }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('img', { name: /Mapa com 3 pontos/ }),
  ).toBeVisible();
  await page.getByLabel('Nome da view').fill('Depois da expansão');
  await page.getByRole('button', { name: 'Salvar view' }).click();
  await expect(page.getByText('View salva.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Exportar dados', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar exportação' }).click();
  const download = await downloaded;
  const { readFile } = await import('node:fs/promises');
  const path = await download.path();
  if (!path) throw new Error('Exportação ausente.');
  const exported: {
    views: Array<{
      name: string;
      positions: Record<string, { x: number; y: number }>;
    }>;
  } = JSON.parse(await readFile(path, 'utf8'));
  const before = exported.views.find(
    (view) => view.name === 'Antes da expansão',
  );
  const after = exported.views.find(
    (view) => view.name === 'Depois da expansão',
  );
  const root = '00000000-0000-4000-8000-000000000001';
  expect(before?.positions[root]).toBeDefined();
  expect(before?.positions[root]).not.toEqual({ x: 410, y: 220 });
  expect(after?.positions[root]).toEqual(before?.positions[root]);
  expect(Object.keys(after?.positions ?? {})).toHaveLength(3);
});
