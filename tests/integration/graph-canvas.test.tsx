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
}
interface ElementHandle {
  id: () => string;
  data: (d?: Record<string, unknown>) => Record<string, unknown> | undefined;
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
  length: number;
}
const emptyHandle: ElementHandle = {
  id: () => '',
  data: () => undefined,
  position: () => ({ x: 0, y: 0 }),
  isEdge: () => false,
  select: () => {},
  unselect: () => {},
  addClass: () => {},
  removeClass: () => {},
  neighborhood: () => new FakeCollection([]),
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
  remove() {
    this.items.forEach((h) => fakeCore?.elementsMap.delete(h.id()));
  }
  unselect() {
    this.items.forEach((h) => h.unselect());
    return this;
  }
  removeClass(c: string) {
    this.items.forEach((h) => h.removeClass(c));
    return this;
  }
  addClass(c: string) {
    this.items.forEach((h) => h.addClass(c));
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
      Object.assign(state.data, d);
      return undefined;
    },
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
    length: 1,
  };
}
class FakeCore {
  elementsMap = new Map<string, ElementState>();
  zoomValue = 1;
  panValue = { x: 0, y: 0 };
  destroyedFlag = false;
  handlers = new Map<string, (event: unknown) => void>();
  styleUpdate = vi.fn();
  center = vi.fn();
  fit = vi.fn();
  resize = vi.fn();
  add(item: { group: 'nodes' | 'edges'; data: Record<string, unknown> }) {
    const id = String(item.data.id);
    const state: ElementState = {
      id,
      data: { ...item.data },
      group: item.group,
      position: { x: 0, y: 0 },
      selected: false,
      classes: new Set(),
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
  on(event: string, selector: string, handler: (event: unknown) => void) {
    this.handlers.set(`${event}:${selector}`, handler);
  }
  zoom() {
    return this.zoomValue;
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
  triggerTap(id: string, edge: boolean) {
    const handler = this.handlers.get('tap:node, edge');
    handler?.({ target: { id: () => id, isEdge: () => edge } });
  }
  triggerDragfree() {
    this.handlers.get('dragfree:node')?.({});
  }
  triggerZoomPan() {
    this.handlers.get('zoom pan:undefined')?.({});
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
  };
}

describe('GraphCanvas', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('document', document);
    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
      ':selected',
      '.neighbor',
      'edge[?contested]',
    ]);
    expect(styles[0]?.style).toMatchObject({
      label: 'data(label)',
      color: '#dfe5d8',
      'font-family': 'IBM Plex Mono',
      'text-wrap': 'ellipsis',
    });
    expect(styles[1]?.style).toMatchObject({
      'line-color': '#6d7a64',
      'target-arrow-color': '#6d7a64',
    });
    expect(styles[2]?.style).toMatchObject({
      'border-color': '#e76732',
      'line-color': '#e76732',
    });
    expect(styles[3]?.style['border-color']).toBe('#c3cabc');
    expect(styles[4]?.style['line-color']).toBe('#f08a9b');
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
    fakeCore?.triggerZoomPan();
    expect(props.onSnapshot).toHaveBeenCalledTimes(2);
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
});
