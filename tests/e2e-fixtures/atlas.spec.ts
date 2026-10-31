import { expect, test, type Locator } from '@playwright/test';
type TestPoint = { x: number; y: number };
type TestNode = {
  id(): string;
  position(): TestPoint;
  renderedPosition(): TestPoint;
  outerWidth(): number;
  outerHeight(): number;
  source(): TestNode;
  target(): TestNode;
  connectedEdges(): TestEdge[];
};
type TestEdge = {
  id(): string;
  source(): TestNode;
  target(): TestNode;
  controlPoints(): TestPoint[] | null;
  sourceEndpoint(): TestPoint;
  targetEndpoint(): TestPoint;
};
type TestCy = {
  edges(): { map<T>(callback: (edge: TestEdge) => T): T[] };
  add(element: { group: 'edges'; data: Record<string, string | number> }): void;
  getElementById(
    id: string,
  ): TestNode & { controlPoints(): TestPoint[] | null };
  pan(value?: TestPoint): TestPoint;
  zoom(value?: { level: number; renderedPosition: TestPoint }): number;
};
type CyContainer = HTMLElement & { _cyreg?: { cy?: TestCy } };
async function waitForStablePosition(element: Locator) {
  await element.evaluate(async (target) => {
    const read = () => {
      const style = (target as HTMLElement).style;
      return {
        left: Number.parseFloat(style.left),
        top: Number.parseFloat(style.top),
      };
    };
    let previous = read();
    let stableFrames = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = read();
      if (
        Math.abs(current.left - previous.left) < 0.1 &&
        Math.abs(current.top - previous.top) < 0.1
      ) {
        stableFrames += 1;
        if (stableFrames === 4) return;
      } else {
        stableFrames = 0;
      }
      previous = current;
    }
    throw new Error('A posição do título de contexto não estabilizou.');
  });
}
async function assertRealHitTarget(control: Locator, width: number) {
  const hit = await control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const target = document.elementFromPoint(x, y);
    return (
      !!target && (target === el || el.contains(target) || target.contains(el))
    );
  });
  expect(hit, `Controle obstruído no centro em ${width}px.`).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.goto('/map');
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
});
test('abrir filtros do mapa não move nem redimensiona o canvas', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  const canvas = page.getByRole('img', { name: /Mapa com 1 pontos/ });
  await expect(canvas).toBeVisible();
  const before = await canvas.boundingBox();
  if (!before) throw new Error('Mapa sem dimensão.');
  await page.getByText('Filtros do mapa', { exact: true }).click();
  await expect(page.getByText('Incluir período desconhecido')).toBeVisible();
  const after = await canvas.boundingBox();
  expect(after).toEqual(before);
});
test('selecionar um resultado da busca fecha o dropdown', async ({ page }) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const results = page.locator('.search-results');
  await expect(results).toBeVisible();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await expect(results).toHaveCount(0);
});
test('alterna Fluxo antes e depois de selecionar um ponto com relações', async ({
  page,
}) => {
  // Layout de mesa: no breakpoint mobile, o painel editorial fica fixo por
  // cima do rodapé do mapa e cobre o botão Fluxo (ver mensagem ao agente).
  await page.setViewportSize({ width: 1280, height: 800 });
  const toggle = page.getByRole('button', { name: 'Fluxo', exact: true });
  await expect(toggle).toBeVisible();
  const initial = await toggle.getAttribute('aria-pressed');
  await toggle.click();
  await expect(toggle).toHaveAttribute(
    'aria-pressed',
    initial === 'true' ? 'false' : 'true',
  );
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', initial ?? 'true');
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('img', { name: /Mapa com \d+ pontos e [1-9]\d* relações/ }),
  ).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute(
    'aria-pressed',
    initial === 'true' ? 'false' : 'true',
  );
});
test('no mobile, recolher/abrir painel alterna a visibilidade do conteúdo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const content = page.locator('#panel-content');
  const collapse = page.getByRole('button', { name: 'Recolher painel' });
  await expect(collapse).toBeVisible();
  await expect(content).toBeVisible();
  await collapse.click();
  const expand = page.getByRole('button', { name: 'Abrir painel' });
  await expect(expand).toBeVisible();
  await expect(content).toBeHidden();
  await expand.click();
  await expect(
    page.getByRole('button', { name: 'Recolher painel' }),
  ).toBeVisible();
  await expect(content).toBeVisible();
});
test('estado vazio de "Views salvas" não cobre navegação nem o botão de sessão', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('link', { name: 'Views salvas', exact: true }).click();
  const empty = page.locator('.empty');
  await expect(empty).toContainText('Nenhum registro encontrado.');
  const link = page.getByRole('link', { name: 'Explorar mapa', exact: true });
  const linkBox = await link.boundingBox();
  if (!linkBox) throw new Error('Link sem dimensão.');
  const underLink = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.textContent,
    { x: linkBox.x + linkBox.width / 2, y: linkBox.y + linkBox.height / 2 },
  );
  expect(underLink).toBe('Explorar mapa');
  await link.click();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Views salvas', exact: true }).click();
  await expect(empty).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Entrar na demonstração fictícia' }),
  ).toBeVisible();
});
test('filtros do mapa cabem na viewport e são operáveis no mobile, com o painel aberto', async ({
  page,
}) => {
  for (const width of [390, 375]) {
    await page.setViewportSize({ width, height: 844 });
    // Recarrega a cada largura: o estado de filtros mudado na iteração
    // anterior não deve ser arrastado para a próxima.
    await page.goto('/map');
    await page
      .getByRole('button', { name: 'Entrar na demonstração fictícia' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Buscar ponto').fill('Jung');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
    // O painel editorial (.details-panel) fica aberto por padrão: é
    // justamente o cenário em que o popover de filtros pode acabar atrás
    // do sheet mobile, então não o recolhemos aqui.
    await expect(page.locator('#panel-content')).toBeVisible();
    const canvas = page.getByRole('img', { name: /Mapa com 1 pontos/ });
    await expect(canvas).toBeVisible();
    const before = await canvas.boundingBox();
    await page.getByText('Filtros do mapa', { exact: true }).click();
    const panel = page.locator('.filters-panel');
    const kindSelect = panel.getByLabel('Tipo');
    const contextSelect = panel.getByLabel('Contexto');
    const startYear = panel.getByLabel('Ano inicial (astronômico)', {
      exact: true,
    });
    const endYear = panel.getByLabel('Ano final (astronômico)', {
      exact: true,
    });
    const includeUnknown = panel.getByLabel('Incluir período desconhecido', {
      exact: true,
    });
    const showPending = panel.getByLabel('Mostrar pendentes', {
      exact: true,
    });
    const controls = [
      kindSelect,
      contextSelect,
      startYear,
      endYear,
      includeUnknown,
      showPending,
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      if (!box) throw new Error(`Controle sem dimensão em ${width}px.`);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await assertRealHitTarget(control, width);
    }
    // Abrir o popover por si só não deve mover o canvas (mudar um filtro
    // altera a lista de nós e mostra uma mensagem de status, o que é
    // esperado e não faz parte desta verificação).
    const afterOpen = await canvas.boundingBox();
    expect(afterOpen).toEqual(before);
    // Operação real, sem `force`: o clique precisa alcançar o controle de
    // fato, não só despachar o evento por cima de outra camada.
    await assertRealHitTarget(kindSelect, width);
    await kindSelect.selectOption('person');
    await expect(kindSelect).toHaveValue('person');
    await assertRealHitTarget(contextSelect, width);
    await contextSelect.selectOption({ label: 'Contexto fictício' });
    await expect(contextSelect).not.toHaveValue('');
    await assertRealHitTarget(startYear, width);
    await startYear.fill('100');
    await expect(startYear).toHaveValue('100');
    await assertRealHitTarget(endYear, width);
    await endYear.fill('200');
    await expect(endYear).toHaveValue('200');
    await assertRealHitTarget(includeUnknown, width);
    await expect(includeUnknown).toBeChecked();
    await includeUnknown.uncheck();
    await expect(includeUnknown).not.toBeChecked();
    await includeUnknown.check();
    await expect(includeUnknown).toBeChecked();
    await assertRealHitTarget(showPending, width);
    await expect(showPending).not.toBeChecked();
    await showPending.check();
    await expect(showPending).toBeChecked();
    await page.getByText('Filtros do mapa', { exact: true }).click();
  }
});
test('painel recolhido no mobile permanece acessível após redimensionar para desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Recolher painel' }).click();
  await expect(
    page.getByRole('button', { name: 'Abrir painel' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 960 });
  const content = page.locator('#panel-content');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Jung (exemplo fictício)');
  await expect(
    page.getByRole('button', { name: 'Expandir conexões' }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'Abrir painel' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir painel' }).click();
  await expect(content).toBeVisible();
});
test('no mobile, o rodapé do mapa compacto fica em uma linha e sem o crachá de demonstração', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Recolher painel' }).click();
  const surface = await page.locator('.map-surface').boundingBox();
  if (!surface) throw new Error('Superfície do mapa sem dimensão.');
  expect(surface.y).toBeLessThanOrEqual(270);
  const railLinks = page.locator('.map-rail a');
  await expect(railLinks).toHaveCount(9);
  const ys = await railLinks.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().y)),
  );
  expect(new Set(ys).size).toBe(1);
  await expect(page.locator('.map-badge')).toBeHidden();
  await expect(page.locator('.session-bar strong')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Explorar mapa', exact: true }),
  ).toBeVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflows).toBe(false);
});
test('painel de relação mostra os nomes dos pontos, não UUIDs', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('button', { name: 'Mais conexões' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mais conexões' }).click();
  await page.getByRole('button', { name: 'Modo lista' }).click();
  const list = page.locator('.graph-list');
  await list
    .getByRole('button', { name: /Jung.*estudou.*Gnosticismo.*Interpretação/ })
    .click();
  const direction = page.locator('.details-panel p', {
    hasText: /^Direção:/,
  });
  await expect(direction).toContainText('Jung (exemplo fictício)');
  await expect(direction).toContainText('Gnosticismo (exemplo fictício)');
  await expect(direction).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  await list
    .getByRole('button', { name: /Jung.*estudou.*Gnosticismo.*Documentada/ })
    .click();
  const direction2 = page.locator('.details-panel p', {
    hasText: /^Direção:/,
  });
  await expect(direction2).toContainText('Jung (exemplo fictício)');
  await expect(direction2).toContainText('Gnosticismo (exemplo fictício)');
  await list
    .getByRole('button', {
      name: 'Gnosticismo (exemplo fictício)',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await list
    .getByRole('button', { name: /Gnosticismo.*paralelo a.*Conceito/ })
    .click();
  const symmetric = page.locator('.details-panel p', {
    hasText: /^Relação simétrica entre/,
  });
  await expect(symmetric).toContainText('Gnosticismo (exemplo fictício)');
  await expect(symmetric).toContainText('Conceito compartilhado fictício');
  await expect(symmetric).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});
test('as marcas de fluxo seguem as relações paralelas e desaparecem ao pausar', async ({
  page,
}) => {
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('button', { name: 'Mais conexões' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mais conexões' }).click();
  // Jung—Gnosticismo tem duas relações paralelas (007 e 010) na fixture.
  await expect(
    page.getByRole('img', { name: /Mapa com 3 pontos e 3 relações/ }),
  ).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Fluxo', exact: true });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.click();
  }
  await expect
    .poll(() => page.locator('.flow-layer polygon').count())
    .toBeGreaterThanOrEqual(2);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.locator('.flow-layer polygon').count()).toBe(0);
});

test('expansão base de Jung produz relações válidas no renderer Cytoscape real', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('img', { name: /Mapa com 3 pontos e 2 relações/ }),
  ).toBeVisible();

  // A instância é lida do registro público do container pelo renderer real:
  // esta asserção cobre os endpoints, caixas e controles já calculados pelo
  // Cytoscape após layout/style, não uma cópia da geometria do produto.
  const geometry = await page.locator('.graph-canvas').evaluate((container) => {
    const cy = (container as CyContainer)._cyreg?.cy;
    if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
    return cy.edges().map((edge) => {
      const source = edge.source();
      const target = edge.target();
      const controls = edge.controlPoints() ?? [];
      const outside = (point: TestPoint, node: TestNode) => {
        const p = node.position();
        return (
          Math.abs(point.x - p.x) > node.outerWidth() / 2 ||
          Math.abs(point.y - p.y) > node.outerHeight() / 2
        );
      };
      return {
        id: edge.id(),
        source: source.id(),
        target: target.id(),
        controls,
        sourceControlOutside:
          controls.length > 0 && outside(controls[0]!, source),
        targetControlOutside:
          controls.length > 0 &&
          outside(controls[controls.length - 1]!, target),
        endpointsFinite: [edge.sourceEndpoint(), edge.targetEndpoint()].every(
          (point: TestPoint) =>
            Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      };
    });
  });
  expect(geometry).toHaveLength(2);
  for (const edge of geometry) {
    expect(edge.endpointsFinite, edge.id).toBe(true);
    expect(edge.sourceControlOutside, edge.id).toBe(true);
    expect(edge.targetControlOutside, edge.id).toBe(true);
    expect(
      edge.controls
        .flatMap((point: TestPoint) => [point.x, point.y])
        .every(Number.isFinite),
      edge.id,
    ).toBe(true);
  }

  const flowToggle = page.getByRole('button', { name: 'Fluxo', exact: true });
  if ((await flowToggle.getAttribute('aria-pressed')) !== 'true') {
    await flowToggle.click();
  }
  await expect
    .poll(async () =>
      page
        .locator('.flow-layer polygon')
        .evaluateAll((polygons) =>
          polygons.every(
            (polygon) =>
              !/NaN|Infinity/.test(polygon.getAttribute('transform') ?? ''),
          ),
        ),
    )
    .toBe(true);
});

test('anotações de contexto acompanham pan e zoom do renderer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  await expect(
    page.getByRole('img', { name: /Mapa com 3 pontos e 2 relações/ }),
  ).toBeVisible();
  const group = page.locator('.context-group').first();
  await expect(group).toBeVisible();
  await waitForStablePosition(group);
  const before = await group.evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  await page.locator('.graph-canvas').evaluate((container) => {
    const cy = (container as CyContainer)._cyreg?.cy;
    if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
    cy.pan({ x: cy.pan().x + 43, y: cy.pan().y - 29 });
  });
  await waitForStablePosition(group);
  const afterPan = await group.evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  expect(afterPan.left - before.left).toBeCloseTo(43, 1);
  expect(afterPan.top - before.top).toBeCloseTo(-29, 1);
  await page.locator('.graph-canvas').evaluate((container) => {
    const cy = (container as CyContainer)._cyreg?.cy;
    if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
    cy.zoom({ level: cy.zoom() * 1.1, renderedPosition: { x: 0, y: 0 } });
  });
  await waitForStablePosition(group);
  const afterZoom = await group.evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
  expect(afterZoom.left).not.toBe(afterPan.left);
  expect(afterZoom.top).not.toBe(afterPan.top);
});

test('arrastar um nó atualiza os controles das relações conectadas', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  const canvas = page.locator('.graph-canvas');
  const target = await canvas.evaluate((container) => {
    const cy = (container as CyContainer)._cyreg?.cy;
    if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
    const node = cy.getElementById('00000000-0000-4000-8000-000000000001');
    const edge = node.connectedEdges()[0];
    if (!edge) throw new Error('Relação conectada a Jung não encontrada.');
    const controls = edge.controlPoints() ?? [];
    const rect = container.getBoundingClientRect();
    const p = node.renderedPosition();
    return {
      x: rect.left + p.x,
      y: rect.top + p.y,
      edgeId: edge.id(),
      before: controls.map((point: TestPoint) => ({ ...point })),
    };
  });
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await page.mouse.move(target.x + 48, target.y + 31, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(() =>
      canvas.evaluate((container, edgeId) => {
        const cy = (container as CyContainer)._cyreg?.cy;
        if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
        return cy.getElementById(edgeId).controlPoints() ?? [];
      }, target.edgeId),
    )
    .not.toEqual(target.before);
});

test('a curva reversa permanece separada no renderer Cytoscape real', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Buscar ponto').fill('Jung');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Jung.*Pessoa/ }).click();
  await page.getByRole('button', { name: 'Expandir conexões' }).click();
  const curves = await page
    .locator('.graph-canvas')
    .evaluate(async (container) => {
      const cy = (container as CyContainer)._cyreg?.cy;
      if (!cy) throw new Error('Instância Cytoscape do mapa não encontrada.');
      const jung = '00000000-0000-4000-8000-000000000001';
      const concept = '00000000-0000-4000-8000-000000000003';
      const forward = cy.getElementById('00000000-0000-4000-8000-000000000008');
      cy.add({
        group: 'edges',
        data: {
          id: 'test-reverse-curve',
          source: concept,
          target: jung,
          width: 1,
          line: 'solid',
          arrow: 'triangle',
        },
      });
      // A aresta nova altera o conjunto de paralelas da existente. Deixe o
      // renderer processar a invalidação e o recálculo dos controles antes de
      // comparar a curva em sentido oposto.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const reverse = cy.getElementById('test-reverse-curve');
      return {
        forward: forward.controlPoints() ?? [],
        reverse: reverse.controlPoints() ?? [],
      };
    });
  expect(curves.forward).toHaveLength(2);
  expect(curves.reverse).toHaveLength(2);
  const pairedDistances = curves.forward.map(
    (point: TestPoint, index: number) => {
      const reversePoint = curves.reverse[curves.reverse.length - index - 1]!;
      return Math.hypot(point.x - reversePoint.x, point.y - reversePoint.y);
    },
  );
  expect(Math.max(...pairedDistances)).toBeGreaterThan(1);
});

test('preview Atlas mantém canvas, rodapé e rótulos dentro da viewport no mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(
    '/map?atlas=preview&view=00000000-0000-4000-a000-000000000099',
  );
  await page
    .getByRole('button', { name: 'Entrar na demonstração fictícia' })
    .click();
  const graph = page.getByRole('img', {
    name: 'Mapa com 12 pontos e 16 relações. Use o modo lista para navegação por teclado.',
  });
  await expect(graph).toBeVisible();

  const flow = page.getByRole('button', { name: 'Fluxo', exact: true });
  if ((await flow.getAttribute('aria-pressed')) === 'true') await flow.click();
  await expect(flow).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await page.getByRole('button', { name: 'Diminuir zoom' }).click();

  for (const width of [390, 375]) {
    await page.setViewportSize({ width, height: 844 });
    if (width === 390) {
      await page.getByRole('button', { name: 'Recolher painel' }).click();
    }
    await page.getByRole('button', { name: 'Ajustar mapa à tela' }).click();
    await expect(
      page.getByRole('button', { name: 'Abrir painel' }),
    ).toBeVisible();

    const layout = await page.evaluate(() => {
      const footer = document.querySelector('.stage-footer');
      const title = document.querySelector('.instrument-title');
      const count = document.querySelector('.instrument-count');
      const wrap = document.querySelector('.graph-canvas-wrap');
      const groups = document.querySelector('.context-groups');
      if (!footer || !title || !count || !wrap || !groups) {
        throw new Error('Canvas, rodapé ou títulos de contexto ausentes.');
      }
      const titleBox = title.getBoundingClientRect();
      const countBox = count.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        footerHeight: footer.getBoundingClientRect().height,
        titleTop: titleBox.top,
        titleHeight: titleBox.height,
        countTop: countBox.top,
        countHeight: countBox.height,
        titleText: title.textContent?.trim(),
        countText: count.textContent?.replace(/\s+/g, ' ').trim(),
        groupsClippedByCanvas:
          groups.parentElement === wrap &&
          getComputedStyle(wrap).overflow === 'hidden',
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.footerHeight).toBeLessThan(180);
    expect(layout.titleTop).toBeCloseTo(layout.countTop, 0);
    expect(layout.titleHeight).toBeLessThan(30);
    expect(layout.countHeight).toBeLessThan(30);
    expect(layout.titleText).toContain('Jung');
    expect(layout.countText).toContain('12/500 pontos');
    expect(layout.countText).toContain('16 relações');
    expect(layout.groupsClippedByCanvas).toBe(true);
  }
});
