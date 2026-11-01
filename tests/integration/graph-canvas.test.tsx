import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Catalog, Node, Relation } from '../../src/api/domain';

const cytoscapeState = vi.hoisted(() => ({ style: null as unknown }));

interface ElementState {
  id: string;
  data: Record<string, unknown>;
  group: 'nodes' | 'edges';
  position: { x: number; y: number };
  selected: boolean;
  classes: Set<string>;
  /** Pontos de controle devolvidos por `controlPoints()` (como o Cytoscape real). */
  controls: unknown;
}
interface ElementHandle {
  id: () => string;
  data: (
    d?: Record<string, unknown> | string,
  ) => Record<string, unknown> | unknown;
  position: (p?: {
    x: number;
    y: number;
  }) => { x: number; y: number } | undefined;
  isEdge: () => boolean;
  select: () => void;
  unselect: () => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  neighborhood: (kind: string) => FakeCollection;
  closedNeighborhood: () => FakeCollection;
  connectedEdges: () => FakeCollection;
  filter: (predicate: (h: ElementHandle) => boolean) => FakeCollection;
  toArray: () => ElementHandle[];
  sourceEndpoint: () => { x: number; y: number };
  targetEndpoint: () => { x: number; y: number };
  controlPoints: () => unknown;
  outerWidth: () => number;
  outerHeight: () => number;
  length: number;
}
const emptyHandle: ElementHandle = {
  id: () => '',
  data: () => undefined,
  outerWidth: () => 0,
  outerHeight: () => 0,
  position: () => ({ x: 0, y: 0 }),
  isEdge: () => false,
  select: () => {},
  unselect: () => {},
  addClass: () => {},
  removeClass: () => {},
  neighborhood: () => new FakeCollection([]),
  closedNeighborhood: () => new FakeCollection([emptyHandle]),
  connectedEdges: () => new FakeCollection([]),
  filter: () => new FakeCollection([]),
  toArray: () => [],
  sourceEndpoint: () => ({ x: 0, y: 0 }),
  targetEndpoint: () => ({ x: 0, y: 0 }),
  controlPoints: () => [],
  length: 0,
};
class FakeCollection {
  items: ElementHandle[];
  constructor(items: ElementHandle[]) {
    this.items = items;
  }
  get length() {
    return this.items.length;
  }
  toArray() {
    return [...this.items];
  }
  forEach(cb: (h: ElementHandle, i: number) => void) {
    this.items.forEach(cb);
  }
  filter(pred: (h: ElementHandle) => boolean) {
    return new FakeCollection(this.items.filter(pred));
  }
  first() {
    return this.items[0] ?? emptyHandle;
  }
  nodes() {
    return this;
  }
  map<T>(cb: (h: ElementHandle, i: number) => T) {
    return this.items.map(cb);
  }
  difference(other: FakeCollection) {
    const ids = new Set(other.items.map((item) => item.id()));
    return new FakeCollection(this.items.filter((item) => !ids.has(item.id())));
  }
  remove() {
    this.items.forEach((h) => fakeCore?.elementsMap.delete(h.id()));
  }
  unselect() {
    this.items.forEach((h) => h.unselect());
    return this;
  }
  removeClass(c: string) {
    c.split(/\s+/).forEach((name) =>
      this.items.forEach((h) => h.removeClass(name)),
    );
    return this;
  }
  addClass(c: string) {
    c.split(/\s+/).forEach((name) =>
      this.items.forEach((h) => h.addClass(name)),
    );
    return this;
  }
  select() {
    this.items.forEach((h) => h.select());
  }
}
function makeHandle(state: ElementState): ElementHandle {
  return {
    id: () => state.id,
    data: (d) => {
      if (d === undefined) return state.data;
      if (typeof d === 'string') return state.data[d];
      Object.assign(state.data, d);
      return undefined;
    },
    outerWidth: () => 100,
    outerHeight: () => 34,
    position: (p) => {
      if (p === undefined) return { ...state.position };
      state.position = { ...p };
      return undefined;
    },
    isEdge: () => state.group === 'edges',
    select: () => {
      state.selected = true;
    },
    unselect: () => {
      state.selected = false;
    },
    addClass: (c) => state.classes.add(c),
    removeClass: (c) => state.classes.delete(c),
    neighborhood: (kind) => fakeCore!.neighborhoodOf(state, kind),
    // Como no Cytoscape: o elemento, os pontos vizinhos e as relações entre eles.
    closedNeighborhood: () =>
      new FakeCollection([
        makeHandle(state),
        ...fakeCore!.neighborhoodOf(state, 'node').items,
        ...(state.group === 'nodes' ? fakeCore!.edgesOf(state.id) : []),
      ]),
    connectedEdges: () => new FakeCollection(fakeCore!.edgesOf(state.id)),
    // Um elemento também é uma coleção de um item, como no Cytoscape.
    filter: (predicate) =>
      new FakeCollection(
        predicate(makeHandle(state)) ? [makeHandle(state)] : [],
      ),
    toArray: () => [makeHandle(state)],
    sourceEndpoint: () => fakeCore!.positionOf(String(state.data.source)),
    targetEndpoint: () => fakeCore!.positionOf(String(state.data.target)),
    controlPoints: () => state.controls,
    length: 1,
  };
}
class FakeCore {
  elementsMap = new Map<string, ElementState>();
  zoomValue = 1;
  canvasWidth = 800;
  canvasHeight = 600;
  panValue = { x: 0, y: 0 };
  destroyedFlag = false;
  handlers = new Map<string, ((event: unknown) => void)[]>();
  addCalls: string[] = [];
  zoomCalls: unknown[] = [];
  styleUpdate = vi.fn();
  edgeStyleUpdate = vi.fn();
  center = vi.fn();
  fit = vi.fn();
  resize = vi.fn();
  add(item: { group: 'nodes' | 'edges'; data: Record<string, unknown> }) {
    const id = String(item.data.id);
    // O Cytoscape recusa um segundo elemento com o mesmo id.
    if (this.elementsMap.has(id))
      throw new Error(`Can not create second element with ID \`${id}\``);
    this.addCalls.push(id);
    const state: ElementState = {
      id,
      data: { ...item.data },
      group: item.group,
      position: { x: 0, y: 0 },
      selected: false,
      classes: new Set(),
      controls: [],
    };
    this.elementsMap.set(id, state);
    return makeHandle(state);
  }
  nodes() {
    return new FakeCollection(
      [...this.elementsMap.values()]
        .filter((s) => s.group === 'nodes')
        .map(makeHandle),
    );
  }
  elements() {
    return new FakeCollection([...this.elementsMap.values()].map(makeHandle));
  }
  edges() {
    return { updateStyle: this.edgeStyleUpdate };
  }
  positionOf(id: string) {
    return { ...(this.elementsMap.get(id)?.position ?? { x: 0, y: 0 }) };
  }
  edgesOf(id: string) {
    return [...this.elementsMap.values()]
      .filter(
        (edge) =>
          edge.group === 'edges' &&
          (edge.data.source === id || edge.data.target === id),
      )
      .map(makeHandle);
  }
  getElementById(id: string) {
    const state = this.elementsMap.get(id);
    return state ? makeHandle(state) : emptyHandle;
  }
  batch(fn: () => void) {
    fn();
  }
  style() {
    return { update: this.styleUpdate };
  }
  on(
    event: string,
    selectorOrHandler: string | ((event: unknown) => void),
    handler?: (event: unknown) => void,
  ) {
    const selector =
      typeof selectorOrHandler === 'string' ? selectorOrHandler : null;
    const callback =
      typeof selectorOrHandler === 'function' ? selectorOrHandler : handler;
    if (!callback) throw new Error(`handler ausente para ${event}`);
    const key = selector ? `${event}:${selector}` : event;
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), callback]);
  }
  zoom(options?: { level: number }) {
    if (options) {
      this.zoomCalls.push(options);
      this.zoomValue = options.level;
      return undefined;
    }
    return this.zoomValue;
  }
  width() {
    return this.canvasWidth;
  }
  height() {
    return this.canvasHeight;
  }
  pan() {
    return { ...this.panValue };
  }
  viewport(v: { zoom: number; pan: { x: number; y: number } }) {
    this.zoomValue = v.zoom;
    this.panValue = { ...v.pan };
  }
  destroy() {
    this.destroyedFlag = true;
  }
  destroyed() {
    return this.destroyedFlag;
  }
  neighborhoodOf(state: ElementState, kind: string) {
    if (kind !== 'node') return new FakeCollection([]);
    const neighborIds = new Set<string>();
    if (state.group === 'edges') {
      neighborIds.add(String(state.data.source));
      neighborIds.add(String(state.data.target));
    }
    for (const e of this.elementsMap.values()) {
      if (e.group !== 'edges') continue;
      const source = e.data.source as string;
      const target = e.data.target as string;
      if (source === state.id) neighborIds.add(target);
      if (target === state.id) neighborIds.add(source);
    }
    return new FakeCollection(
      [...neighborIds]
        .map((id) => this.elementsMap.get(id))
        .filter((s): s is ElementState => !!s)
        .map(makeHandle),
    );
  }
  trigger(key: string, event: unknown = {}) {
    (this.handlers.get(key) ?? []).forEach((handler) => handler(event));
  }
  triggerTap(id: string, edge: boolean) {
    this.trigger('tap:node, edge', {
      target: { id: () => id, isEdge: () => edge },
    });
  }
  triggerDragfree() {
    this.trigger('dragfree:node');
  }
  triggerZoomPan() {
    this.trigger('zoom pan');
  }
}
let fakeCore: FakeCore | null = null;
vi.mock('cytoscape', () => ({
  default: vi.fn((options: { style: unknown }) => {
    cytoscapeState.style = options.style;
    fakeCore = new FakeCore();
    return fakeCore;
  }),
}));

import { GraphCanvas } from '../../src/graph/GraphCanvas';

function makeNode(id: string, extra: Partial<Node> = {}): Node {
  return {
    id,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    kind: 'person',
    startYear: null,
    endYear: null,
    precision: 'unknown',
    periodLabel: null,
    identifiers: [],
    label: `Nó ${id}`,
    description: 'desc',
    conceptScope: null,
    aliases: [],
    contexts: [],
    degreeTotal: 1,
    archivedAt: null,
    ...extra,
  };
}
function makeRelation(
  id: string,
  sourceId: string,
  targetId: string,
): Relation {
  return {
    id,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    sourceId,
    targetId,
    type: 'influenced',
    contextId: null,
    claim: 'claim',
    justification: 'justification',
    evidenceStatus: 'documented',
    intensity: 2,
    intensityReason: null,
    attributionNodeId: null,
    attributionText: null,
    inferenceAuthor: null,
    contested: false,
    contestationNote: null,
    evidence: [],
    archivedAt: null,
  };
}
const catalog: Catalog = {
  nodeKinds: ['person', 'tradition', 'concept', 'work'],
  identifierSchemes: [],
  relationTypes: [
    {
      code: 'influenced',
      label: 'influenciou',
      inverseLabel: 'foi influenciado por',
      symmetric: false,
      allowedEndpoints: [{ source: 'person', target: 'person' }],
    },
  ],
  evidenceStatuses: ['documented', 'attributed_interpretation', 'inference'],
  editorialStatuses: ['active', 'pending', 'archived'],
  intensities: [{ value: 1, label: 'pontual' }],
};
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observe = vi.fn();
  unobserve() {}
  disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  trigger() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

function baseProps() {
  return {
    nodes: [makeNode('n1'), makeNode('n2')],
    relations: [makeRelation('r1', 'n1', 'n2')],
    catalog,
    selected: '',
    onSelect: vi.fn(),
    positions: {},
    viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    onSnapshot: vi.fn(),
    focus: '',
    focusRevision: 0,
    fitRevision: 0,
    zoomCommand: { revision: 0, factor: 1 },
    flowEnabled: false,
    groups: [],
  };
}

/** requestAnimationFrame controlado: nada roda até `flush`. */
function stubFrames() {
  let next = 0;
  const queue = new Map<number, FrameRequestCallback>();
  const raf = vi.fn((callback: FrameRequestCallback) => {
    next += 1;
    queue.set(next, callback);
    return next;
  });
  const caf = vi.fn((id: number) => {
    queue.delete(id);
  });
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  return {
    raf,
    caf,
    pending: () => queue.size,
    /** Executa os quadros pendentes uma vez, no instante `now`. */
    flush(now = 0) {
      const due = [...queue.values()];
      queue.clear();
      act(() => due.forEach((callback) => callback(now)));
    },
  };
}
let frames!: ReturnType<typeof stubFrames>;
let documentHidden = false;

describe('GraphCanvas', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    frames = stubFrames();
    documentHidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => documentHidden,
    });
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('document', document);
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'hidden');
    fakeCore = null;
    cytoscapeState.style = null;
  });

  it('configura as cores e os estilos acessíveis do grafo no Cytoscape', () => {
    render(<GraphCanvas {...baseProps()} />);
    const styles = cytoscapeState.style as {
      selector: string;
      style: Record<string, unknown>;
    }[];
    expect(styles.map(({ selector }) => selector)).toEqual([
      'node',
      'edge',
      '.neighbor',
      '.faded',
      'node:selected',
      'edge.selected-edge',
    ]);
    expect(styles[0]?.style).toMatchObject({
      label: expect.any(Function),
      shape: 'rectangle',
      width: 'label',
      height: 'label',
      'background-color': '#efebdf',
      color: '#172034',
      'font-family': 'DM Sans Variable, DM Sans, system-ui, sans-serif',
      'text-halign': 'center',
      'text-valign': 'center',
      'text-wrap': 'ellipsis',
    });
    expect(styles[1]?.style).toMatchObject({
      'curve-style': 'unbundled-bezier',
      'line-color': '#8b8f7f',
      'target-arrow-color': '#8b8f7f',
    });
    expect(styles[2]?.style).toEqual({ 'border-width': 1.5 });
    expect(styles[3]?.style).toEqual({ opacity: 0.58 });
    expect(styles[4]?.style).toMatchObject({
      'border-color': '#2145d8',
      'background-color': '#2145d8',
      color: '#f5f2e9',
    });
    expect(styles[5]?.style).toMatchObject({
      'line-color': '#2145d8',
      'target-arrow-color': '#2145d8',
    });
  });

  it('redesenha após carregar fontes enquanto o Cytoscape continua ativo', async () => {
    render(<GraphCanvas {...baseProps()} />);
    const core = fakeCore;
    await act(async () => {
      await document.fonts.ready;
      await Promise.resolve();
    });
    expect(core?.styleUpdate).toHaveBeenCalledTimes(1);
  });

  it('não atualiza os estilos se o Cytoscape foi destruído antes da fonte', async () => {
    let resolveFonts = () => {};
    const ready = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, 'fonts', {
      value: { ready },
      configurable: true,
    });
    const { unmount } = render(<GraphCanvas {...baseProps()} />);
    const core = fakeCore;
    unmount();
    resolveFonts();
    await act(async () => ready);
    expect(core?.styleUpdate).not.toHaveBeenCalled();
  });

  it('continua montando quando a API de fontes do documento não existe', () => {
    Object.defineProperty(document, 'fonts', {
      value: undefined,
      configurable: true,
    });
    expect(() => render(<GraphCanvas {...baseProps()} />)).not.toThrow();
    expect(fakeCore).not.toBeNull();
  });

  it('renderiza o rótulo acessível com as contagens atuais', () => {
    const { getByRole } = render(<GraphCanvas {...baseProps()} />);
    expect(
      getByRole('img', {
        name: 'Mapa com 2 pontos e 1 relações. Use o modo lista para navegação por teclado.',
      }),
    ).toBeInTheDocument();
  });

  it('adiciona elementos e posiciona nós novos sem posição fixada', async () => {
    render(<GraphCanvas {...baseProps()} />);
    await act(() => Promise.resolve());
    expect(fakeCore?.elementsMap.size).toBe(3);
    const n1 = fakeCore?.elementsMap.get('n1');
    expect(n1?.position).not.toEqual({ x: 0, y: 0 });
  });

  it('mantém posições fixadas ao receber novas props e preserva arraste sobre snapshot antigo', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    const core = fakeCore!;
    core.elementsMap.get('n1')!.position = { x: 10, y: 20 };
    rerender(
      <GraphCanvas
        {...props}
        nodes={[...props.nodes, makeNode('n3')]}
        relations={props.relations}
      />,
    );
    expect(core.elementsMap.get('n1')!.position).toEqual({ x: 10, y: 20 });
  });

  it('aplica posições fornecidas quando o snapshot muda', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} positions={{ n1: { x: 99, y: 88 } }} />);
    expect(fakeCore?.elementsMap.get('n1')?.position).toEqual({
      x: 99,
      y: 88,
    });
  });

  it('seleciona o elemento e marca vizinhos ao mudar a seleção', () => {
    const props = {
      ...baseProps(),
      nodes: [...baseProps().nodes, makeNode('n3')],
    };
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} selected="n1" />);
    const n1 = fakeCore?.elementsMap.get('n1');
    const n2 = fakeCore?.elementsMap.get('n2');
    const n3 = fakeCore?.elementsMap.get('n3');
    expect(n1?.selected).toBe(true);
    expect(n2?.classes.has('neighbor')).toBe(true);
    rerender(<GraphCanvas {...props} selected="n3" />);
    expect(n1?.selected).toBe(false);
    expect(n2?.classes.has('neighbor')).toBe(false);
    expect(n3?.selected).toBe(true);
  });

  it('centraliza no nó em foco quando a revisão de foco muda', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} focus="n1" focusRevision={1} />);
    expect(fakeCore?.center).toHaveBeenCalled();
  });

  it('não centraliza quando o nó em foco não existe', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} focus="inexistente" focusRevision={1} />);
    expect(fakeCore?.center).not.toHaveBeenCalled();
  });

  it('ajusta a visão apenas quando há nós e a revisão de fit muda', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} fitRevision={1} />);
    expect(fakeCore?.fit).toHaveBeenCalled();
  });

  it('não ajusta a visão quando não há nós', () => {
    const props = { ...baseProps(), nodes: [], relations: [] };
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} fitRevision={1} />);
    expect(fakeCore?.fit).not.toHaveBeenCalled();
  });

  it('aplica o viewport recebido', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(
      <GraphCanvas {...props} viewport={{ zoom: 2, pan: { x: 5, y: 6 } }} />,
    );
    expect(fakeCore?.zoomValue).toBe(2);
    expect(fakeCore?.panValue).toEqual({ x: 5, y: 6 });
  });

  it('notifica seleção ao tocar em nó ou aresta e tira snapshot ao arrastar ou aplicar zoom/pan', () => {
    const props = baseProps();
    render(<GraphCanvas {...props} />);
    fakeCore?.triggerTap('n1', false);
    expect(props.onSelect).toHaveBeenCalledWith('n1', false);
    fakeCore?.getElementById('n1').position({ x: 8, y: 10 });
    fakeCore!.zoomValue = 2;
    fakeCore!.panValue = { x: 3, y: 4 };
    const n2Position = fakeCore?.elementsMap.get('n2')?.position;
    if (!n2Position) throw new Error('posição do segundo nó não encontrada');
    fakeCore?.triggerDragfree();
    expect(props.onSnapshot).toHaveBeenLastCalledWith(
      { n1: { x: 8, y: 10 }, n2: n2Position },
      { zoom: 2, pan: { x: 3, y: 4 } },
    );
    const snapshotsBeforeZoomPan = props.onSnapshot.mock.calls.length;
    fakeCore!.zoomValue = 3;
    fakeCore!.panValue = { x: 5, y: 6 };
    fakeCore?.triggerZoomPan();
    expect(props.onSnapshot).toHaveBeenCalledTimes(snapshotsBeforeZoomPan + 1);
    expect(props.onSnapshot).toHaveBeenLastCalledWith(
      { n1: { x: 8, y: 10 }, n2: n2Position },
      { zoom: 3, pan: { x: 5, y: 6 } },
    );
  });

  it('remove elementos que deixaram de ser visíveis', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    expect(fakeCore?.elementsMap.has('r1')).toBe(true);
    rerender(<GraphCanvas {...props} nodes={props.nodes} relations={[]} />);
    expect(fakeCore?.elementsMap.has('r1')).toBe(false);
  });

  it('destrói o core cytoscape ao desmontar', () => {
    const props = baseProps();
    const { unmount } = render(<GraphCanvas {...props} />);
    const core = fakeCore;
    unmount();
    expect(core?.destroyedFlag).toBe(true);
  });

  it('redimensiona o canvas e desconecta o observer ao desmontar', () => {
    const { unmount } = render(<GraphCanvas {...baseProps()} />);
    const observer = FakeResizeObserver.instances[0];
    expect(observer?.observe).toHaveBeenCalledOnce();
    act(() => observer?.trigger());
    expect(fakeCore?.resize).toHaveBeenCalledOnce();

    unmount();

    expect(observer?.disconnect).toHaveBeenCalledOnce();
  });

  it('liga os eventos do Cytoscape aos nomes e seletores esperados', () => {
    render(<GraphCanvas {...baseProps()} />);
    expect([...(fakeCore?.handlers.keys() ?? [])].sort()).toEqual([
      'add remove:edge',
      'dragfree:node',
      'position:node',
      'tap:node, edge',
      'zoom pan',
    ]);
    // 'zoom pan' tem dois ouvintes: a geometria e o snapshot.
    expect(fakeCore?.handlers.get('zoom pan')).toHaveLength(2);
  });

  it('notifica a seleção de uma aresta tocada', () => {
    const props = baseProps();
    render(<GraphCanvas {...props} />);
    fakeCore?.triggerTap('r1', true);
    expect(props.onSelect).toHaveBeenCalledWith('r1', true);
  });

  it('envia ao pai as posições e o viewport depois de montar os elementos', () => {
    const props = { ...baseProps(), positions: { n1: { x: 5, y: 6 } } };
    render(<GraphCanvas {...props} />);
    const [positions, viewport] = props.onSnapshot.mock.calls.at(-1) ?? [];
    expect(Object.keys(positions ?? {}).sort()).toEqual(['n1', 'n2']);
    expect(positions?.n1).toEqual({ x: 5, y: 6 });
    expect(viewport).toEqual({ zoom: 1, pan: { x: 0, y: 0 } });
  });

  it('não recria elementos que já existem e atualiza os dados deles', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    expect(fakeCore?.addCalls.sort()).toEqual(['n1', 'n2', 'r1']);
    rerender(
      <GraphCanvas
        {...props}
        nodes={[makeNode('n1', { label: 'Renomeado' }), props.nodes[1]!]}
      />,
    );
    expect(fakeCore?.addCalls).toHaveLength(3);
    expect(fakeCore?.elementsMap.get('n1')?.data.label).toBe('Renomeado');
    rerender(
      <GraphCanvas
        {...props}
        nodes={[...props.nodes, makeNode('n3')]}
        relations={[]}
      />,
    );
    expect(fakeCore?.addCalls).toHaveLength(4);
    expect(fakeCore?.addCalls.at(-1)).toBe('n3');
    expect(fakeCore?.elementsMap.has('r1')).toBe(false);
    expect(fakeCore?.elementsMap.has('n2')).toBe(true);
  });

  it('reagenda a geometria quando os dados mudam, sem trocar os grupos', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    frames.flush();
    frames.raf.mockClear();
    rerender(
      <GraphCanvas {...props} nodes={[...props.nodes, makeNode('n3')]} />,
    );
    expect(frames.raf).toHaveBeenCalledTimes(1);
    frames.flush();
    expect(fakeCore?.edgeStyleUpdate).toHaveBeenCalledTimes(2);
  });

  it('não centraliza de novo na mesma revisão de foco', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    rerender(<GraphCanvas {...props} focus="n1" focusRevision={1} />);
    rerender(<GraphCanvas {...props} focus="n2" focusRevision={1} />);
    expect(fakeCore?.center).toHaveBeenCalledTimes(1);
    rerender(<GraphCanvas {...props} focus="n2" focusRevision={2} />);
    expect(fakeCore?.center).toHaveBeenCalledTimes(2);
  });

  it('aplica o comando de zoom ao centro do canvas, multiplicando o zoom atual', () => {
    const props = baseProps();
    const { rerender } = render(<GraphCanvas {...props} />);
    expect(fakeCore?.zoomCalls).toEqual([]);
    rerender(
      <GraphCanvas {...props} zoomCommand={{ revision: 1, factor: 1.25 }} />,
    );
    expect(fakeCore?.zoomCalls).toEqual([
      { level: 1.25, renderedPosition: { x: 400, y: 300 } },
    ]);
    rerender(
      <GraphCanvas {...props} zoomCommand={{ revision: 2, factor: 0.5 }} />,
    );
    expect(fakeCore?.zoomCalls.at(-1)).toEqual({
      level: 0.625,
      renderedPosition: { x: 400, y: 300 },
    });
  });

  describe('seleção', () => {
    const props = () => ({
      ...baseProps(),
      nodes: [...baseProps().nodes, makeNode('n3')],
    });

    it('destaca a relação da seleção, esmaece o resto e limpa ao trocar', () => {
      const { rerender } = render(<GraphCanvas {...props()} selected="n1" />);
      const state = (id: string) => fakeCore?.elementsMap.get(id);
      expect(state('n1')?.selected).toBe(true);
      expect(state('r1')?.classes.has('selected-edge')).toBe(true);
      expect(state('n2')?.classes.has('neighbor')).toBe(true);
      expect(state('n3')?.classes.has('faded')).toBe(true);
      for (const id of ['n1', 'n2', 'r1'])
        expect(state(id)?.classes.has('faded')).toBe(false);
      rerender(<GraphCanvas {...props()} selected="n3" />);
      expect(state('r1')?.classes.has('selected-edge')).toBe(false);
      expect(state('r1')?.classes.has('faded')).toBe(true);
      expect(state('n3')?.classes.has('faded')).toBe(false);
    });

    it('selecionar uma aresta destaca só ela e as pontas', () => {
      const { rerender } = render(<GraphCanvas {...props()} selected="r1" />);
      const state = (id: string) => fakeCore?.elementsMap.get(id);
      expect(state('r1')?.selected).toBe(true);
      expect(state('r1')?.classes.has('selected-edge')).toBe(true);
      expect(state('n3')?.classes.has('faded')).toBe(true);
      expect(state('n3')?.classes.has('selected-edge')).toBe(false);
      rerender(<GraphCanvas {...props()} selected="" />);
      for (const [, element] of fakeCore?.elementsMap ?? [])
        expect([...element.classes]).toEqual([]);
    });

    it('um id inexistente limpa a seleção anterior', () => {
      const { rerender } = render(<GraphCanvas {...props()} selected="n1" />);
      rerender(<GraphCanvas {...props()} selected="não-existe" />);
      for (const [, element] of fakeCore?.elementsMap ?? []) {
        expect(element.selected).toBe(false);
        expect([...element.classes]).toEqual([]);
      }
    });
  });

  describe('grupos de contexto', () => {
    const group = {
      id: 'g1',
      label: 'Contexto A',
      period: 'séc. XX',
      nodeIds: ['n1', 'n2', 'fantasma'],
    };
    const withGroups = (groups: (typeof group)[]) => ({
      ...baseProps(),
      positions: { n1: { x: 100, y: 200 }, n2: { x: 300, y: 260 } },
      viewport: { zoom: 2, pan: { x: 10, y: 20 } },
      groups,
    });

    it('agenda um quadro só para vários eventos e o libera depois de rodar', () => {
      render(<GraphCanvas {...withGroups([])} />);
      frames.flush();
      expect(fakeCore?.edgeStyleUpdate).toHaveBeenCalledTimes(1);
      frames.raf.mockClear();
      fakeCore?.trigger('position:node');
      fakeCore?.trigger('add remove:edge');
      fakeCore?.trigger('zoom pan');
      expect(frames.raf).toHaveBeenCalledTimes(1);
      frames.flush();
      expect(fakeCore?.edgeStyleUpdate).toHaveBeenCalledTimes(2);
      fakeCore?.trigger('position:node');
      expect(frames.raf).toHaveBeenCalledTimes(2);
    });

    it('posiciona o nome do grupo acima do ponto mais alto, centrado, em pixels do contêiner', () => {
      const { container } = render(<GraphCanvas {...withGroups([group])} />);
      expect(container.querySelector('.context-group')).toBeNull();
      frames.flush();
      const label = container.querySelector<HTMLElement>('.context-group');
      // x = (100 + 300) / 2; topo = min(200, 260) - 34/2; y = topo - 22.
      // Pixels: x * 2 + 10, y * 2 + 20.
      expect(label?.style.left).toBe('410px');
      expect(label?.style.top).toBe('342px');
      expect(label?.querySelector('.context-group-name')?.textContent).toBe(
        'Contexto A',
      );
      expect(label?.querySelector('.context-group-period')?.textContent).toBe(
        'séc. XX',
      );
    });

    it('não desenha grupo sem nenhum ponto no mapa e recalcula ao trocar os grupos', () => {
      const props = withGroups([{ ...group, nodeIds: ['x', 'y'] }]);
      const { container, rerender } = render(<GraphCanvas {...props} />);
      frames.flush();
      expect(container.querySelector('.context-group')).toBeNull();
      frames.raf.mockClear();
      rerender(<GraphCanvas {...props} groups={[group]} />);
      expect(frames.raf).toHaveBeenCalledTimes(1);
      frames.flush();
      expect(container.querySelectorAll('.context-group')).toHaveLength(1);
    });

    it('depois de desmontar, o quadro pendente é cancelado e um tardio não faz nada', () => {
      const { unmount } = render(<GraphCanvas {...withGroups([group])} />);
      const core = fakeCore;
      const late = frames.raf.mock.calls.at(-1)?.[0];
      const id = frames.raf.mock.results.at(-1)?.value;
      unmount();
      expect(frames.caf).toHaveBeenCalledWith(id);
      late?.(0);
      expect(core?.edgeStyleUpdate).not.toHaveBeenCalled();
    });
  });

  describe('fluxo da relação selecionada', () => {
    const flowProps = (extra: Record<string, unknown> = {}) => ({
      ...baseProps(),
      positions: { n1: { x: 0, y: 0 }, n2: { x: 400, y: 0 } },
      viewport: { zoom: 1.2, pan: { x: 5, y: 7 } },
      selected: 'n1',
      flowEnabled: true,
      ...extra,
    });
    const layer = (container: HTMLElement) =>
      container.querySelector('svg.flow-layer') as SVGSVGElement;
    // Posição inicial da bolinha: soma dos códigos do id módulo 100 (r1 = 0,63).
    const arrow = (container: HTMLElement) => {
      const polygon = layer(container).querySelector('polygon');
      const match = /translate\(([\d.-]+) ([\d.-]+)\) rotate\(([\d.-]+)\)/.exec(
        polygon?.getAttribute('transform') ?? '',
      );
      return match
        ? { x: Number(match[1]), y: Number(match[2]), angle: Number(match[3]) }
        : null;
    };

    it('desenha a seta sobre a relação direcional e a faz andar pelo comprimento do trajeto', () => {
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(640);
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(480);
      const { container } = render(<GraphCanvas {...flowProps()} />);
      expect(layer(container).innerHTML).toBe('');
      frames.flush(1000);
      // 0,63 * 400 = 252 no modelo; * 1,2 + 5 e * 0 + 7 em pixels.
      expect(arrow(container)).toEqual({ x: 307.4, y: 7, angle: 0 });
      const polygon = layer(container).querySelector('polygon');
      expect(polygon?.getAttribute('points')).toBe('-3.4,-3 4,0 -3.4,3');
      expect(polygon?.getAttribute('fill')).toBe('#2145d8');
      expect(layer(container).getAttribute('width')).toBe('640');
      expect(layer(container).getAttribute('height')).toBe('480');
      // Duração = 400 * 1,2 * 9 = 4320 ms: 2160 ms andam meia volta.
      frames.flush(3160);
      expect(arrow(container)?.x).toBe(67.4);
      // Relógio que volta não faz a seta recuar.
      frames.flush(2000);
      expect(arrow(container)?.x).toBe(67.4);
      // O laço continua: sempre há um próximo quadro.
      expect(frames.pending()).toBeGreaterThan(0);
    });

    it('limita a duração entre 3 e 5 segundos', () => {
      const short = render(
        <GraphCanvas
          {...flowProps({
            positions: { n1: { x: 0, y: 0 }, n2: { x: 100, y: 0 } },
            viewport: { zoom: 1, pan: { x: 0, y: 0 } },
          })}
        />,
      );
      frames.flush(0);
      expect(arrow(short.container)?.x).toBe(63);
      // 100 * 1 * 9 = 900 sobe para 3000: 1500 ms são meia volta.
      frames.flush(1500);
      expect(arrow(short.container)?.x).toBe(13);
      short.unmount();

      const long = render(
        <GraphCanvas
          {...flowProps({
            positions: { n1: { x: 0, y: 0 }, n2: { x: 1000, y: 0 } },
            viewport: { zoom: 1, pan: { x: 0, y: 0 } },
          })}
        />,
      );
      frames.flush(0);
      expect(arrow(long.container)?.x).toBe(630);
      // 1000 * 9 = 9000 desce para 5000: 2500 ms são meia volta.
      frames.flush(2500);
      expect(arrow(long.container)?.x).toBe(130);
    });

    it('relação simétrica não ganha seta', () => {
      const props = flowProps();
      const symmetric = {
        ...catalog,
        relationTypes: [{ ...catalog.relationTypes[0]!, symmetric: true }],
      };
      const { container } = render(
        <GraphCanvas {...props} catalog={symmetric} />,
      );
      frames.flush(1000);
      expect(layer(container).querySelector('polygon')).toBeNull();
    });

    it('segue a curva dos pontos de controle e aceita aresta sem controles', () => {
      const { container } = render(<GraphCanvas {...flowProps()} />);
      const edge = fakeCore!.elementsMap.get('r1')!;
      edge.controls = [{ x: 200, y: 100 }];
      frames.flush(1000);
      expect(arrow(container)?.y).toBeGreaterThan(20);
      edge.controls = undefined;
      frames.flush(1000);
      expect(arrow(container)?.y).toBe(7);
    });

    it('refaz o trajeto quando a geometria da aresta muda', () => {
      const { container } = render(
        <GraphCanvas
          {...flowProps({ viewport: { zoom: 1, pan: { x: 0, y: 0 } } })}
        />,
      );
      frames.flush(0);
      expect(arrow(container)?.x).toBe(252);
      fakeCore!.elementsMap.get('n2')!.position = { x: 100, y: 0 };
      frames.flush(0);
      expect(arrow(container)?.x).toBe(63);
    });

    it('pula a aresta com ponta ou controle não finito', () => {
      const { container } = render(<GraphCanvas {...flowProps()} />);
      const edge = fakeCore!.elementsMap.get('r1')!;
      for (const controls of [
        [{ x: Number.NaN, y: 0 }],
        [{ x: 0, y: Number.POSITIVE_INFINITY }],
      ]) {
        edge.controls = controls;
        frames.flush(1000);
        expect(layer(container).querySelector('polygon')).toBeNull();
      }
      edge.controls = [];
      fakeCore!.elementsMap.get('n2')!.position = { x: Number.NaN, y: 0 };
      frames.flush(1000);
      expect(layer(container).querySelector('polygon')).toBeNull();
    });

    it('pula o trajeto sem comprimento e desenha o de comprimento exatamente 1', () => {
      const { container } = render(
        <GraphCanvas
          {...flowProps({
            positions: { n1: { x: 0, y: 0 }, n2: { x: 0, y: 0 } },
            viewport: { zoom: 1, pan: { x: 0, y: 0 } },
          })}
        />,
      );
      frames.flush(0);
      expect(layer(container).querySelector('polygon')).toBeNull();
      fakeCore!.elementsMap.get('n2')!.position = { x: 1, y: 0 };
      frames.flush(0);
      expect(arrow(container)).not.toBeNull();
    });

    it('para de desenhar uma relação que saiu do mapa antes de o resto reagir', () => {
      const { container } = render(<GraphCanvas {...flowProps()} />);
      frames.flush(1000);
      expect(arrow(container)).not.toBeNull();
      fakeCore!.elementsMap.delete('r1');
      frames.flush(1100);
      expect(layer(container).innerHTML).toBe('');
    });

    it('sem o fluxo ligado não agenda quadros; desligar cancela e limpa a camada', () => {
      const off = flowProps({ flowEnabled: false });
      const { container, rerender } = render(<GraphCanvas {...off} />);
      frames.flush(1000);
      frames.flush(2000);
      expect(layer(container).querySelector('polygon')).toBeNull();
      rerender(<GraphCanvas {...flowProps()} />);
      frames.flush(3000);
      expect(arrow(container)).not.toBeNull();
      const scheduled = frames.raf.mock.results.at(-1)?.value;
      rerender(<GraphCanvas {...off} />);
      expect(frames.caf).toHaveBeenCalledWith(scheduled);
      expect(layer(container).innerHTML).toBe('');
      frames.flush(4000);
      expect(layer(container).innerHTML).toBe('');
    });

    it('com a aba oculta não anima; ao voltar, retoma sem pular o tempo escondido', () => {
      documentHidden = true;
      const { container } = render(<GraphCanvas {...flowProps()} />);
      // O único quadro agendado é o da geometria; nenhum de fluxo.
      frames.flush(1000);
      expect(layer(container).querySelector('polygon')).toBeNull();
      expect(frames.pending()).toBe(0);

      documentHidden = false;
      vi.spyOn(performance, 'now').mockReturnValue(50_000);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(frames.pending()).toBe(1);
      // Um segundo evento de aba visível não duplica o laço.
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(frames.pending()).toBe(1);
      frames.flush(50_000);
      const first = arrow(container)?.x ?? 0;
      frames.flush(51_000);
      expect(arrow(container)?.x).toBeGreaterThan(first);

      // Ocultar cancela o quadro e limpa a camada.
      const scheduled = frames.raf.mock.results.at(-1)?.value;
      documentHidden = true;
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(frames.caf).toHaveBeenCalledWith(scheduled);
      expect(layer(container).innerHTML).toBe('');

      // Voltar zera o relógio de cada trajeto: o primeiro quadro não avança.
      documentHidden = false;
      vi.spyOn(performance, 'now').mockReturnValue(900_000);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      frames.flush(900_300);
      const resumed = arrow(container)?.x ?? 0;
      // 300 ms de uma volta de 4320 ms, a partir da posição de antes.
      const expected =
        (((first / 1.2 - 5 / 1.2) / 400 + 1000 / 4320 + 300 / 4320) % 1) * 400;
      expect(resumed).toBeCloseTo(expected * 1.2 + 5, 0);
    });

    it('ao desmontar, cancela o quadro e deixa de ouvir a visibilidade da aba', () => {
      const { unmount } = render(<GraphCanvas {...flowProps()} />);
      const scheduled = frames.raf.mock.results.at(-1)?.value;
      frames.raf.mockClear();
      unmount();
      expect(frames.caf).toHaveBeenCalledWith(scheduled);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(frames.raf).not.toHaveBeenCalled();
    });
  });
});
