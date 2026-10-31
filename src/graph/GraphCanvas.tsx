import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { Core, EdgeSingular } from 'cytoscape';
import type { Catalog, Node, Relation } from '../api/domain';
import { elements } from './adapter/elements';
import { graphStyle } from './styles';
import { arrangeNew } from './layout/positions';
import type { Positions, Viewport } from './layout/positions';
import { highlightColor } from './styles/palette';
import { samplePath, pointOnSampledPath, toRendered } from './flow';
import type { ArcPath, Point } from './flow';
// Função simples (não um type guard) para não deixar o TypeScript estreitar
// `target` ao tipo de interseção CollectionReturnValue em cada ramo.
function isEdgeSelection(c: cytoscape.CollectionReturnValue): boolean {
  return c.isEdge();
}
export interface ContextGroup {
  id: string;
  label: string;
  period: string;
  nodeIds: string[];
}
export function GraphCanvas({
  nodes,
  relations,
  catalog,
  selected,
  onSelect,
  positions,
  viewport,
  onSnapshot,
  focus,
  focusRevision,
  fitRevision,
  zoomCommand,
  flowEnabled,
  groups,
}: {
  nodes: Node[];
  relations: Relation[];
  catalog: Catalog;
  selected: string;
  onSelect: (id: string, edge: boolean) => void;
  positions: Positions;
  viewport: Viewport;
  onSnapshot: (positions: Positions, viewport: Viewport) => void;
  focus: string;
  focusRevision: number;
  fitRevision: number;
  zoomCommand: { revision: number; factor: number };
  flowEnabled: boolean;
  groups: ContextGroup[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const flowLayer = useRef<SVGSVGElement>(null);
  const core = useRef<Core | null>(null);
  const appliedPositions = useRef<Positions | null>(null);
  const flowEdges = useRef<EdgeSingular[]>([]);
  const flowFrame = useRef<number | null>(null);
  const appliedFocusRevision = useRef(0);
  const [groupPositions, setGroupPositions] = useState<Record<string, Point>>(
    {},
  );
  const groupRef = useRef(groups);
  groupRef.current = groups;
  const syncGeometry = useRef<() => void>(() => {});
  const callbacks = useRef({ onSelect, onSnapshot });
  callbacks.current = { onSelect, onSnapshot };
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [],
      style: graphStyle,
      minZoom: 0.25,
      // Acima disso os rótulos viram cartazes e começam a colidir.
      maxZoom: 1.4,
    });
    core.current = cy;
    // O canvas não redesenha sozinho quando a fonte dos rótulos termina de carregar.
    void document.fonts?.ready.then(() => {
      if (!cy.destroyed()) cy.style().update();
    });
    appliedPositions.current = null;
    const snapshot = () => {
      const positions: Positions = {};
      cy.nodes().forEach((n) => {
        positions[n.id()] = { ...n.position() };
      });
      callbacks.current.onSnapshot(positions, {
        zoom: cy.zoom(),
        pan: { ...cy.pan() },
      });
    };
    cy.on('tap', 'node, edge', (event) =>
      callbacks.current.onSelect(event.target.id(), event.target.isEdge()),
    );
    let scheduled: number | null = null;
    const scheduleGeometry = () => {
      if (scheduled !== null) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = null;
        if (cy.destroyed()) return;
        (cy.edges() as unknown as { updateStyle: () => void }).updateStyle();
        const pan = cy.pan();
        const zoom = cy.zoom();
        const next: Record<string, Point> = {};
        groupRef.current.forEach((group) => {
          const members = group.nodeIds
            .map((id) => cy.getElementById(id))
            .filter((node) => node.length);
          if (!members.length) return;
          const xs = members.map((node) => node.position().x);
          const top = Math.min(
            ...members.map(
              (node) => node.position().y - node.outerHeight() / 2,
            ),
          );
          next[group.id] = toRendered(
            { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: top - 22 },
            zoom,
            pan,
          );
        });
        setGroupPositions(next);
      });
    };
    syncGeometry.current = scheduleGeometry;
    cy.on('position', 'node', scheduleGeometry);
    cy.on('add remove', 'edge', scheduleGeometry);
    cy.on('zoom pan', scheduleGeometry);
    cy.on('dragfree', 'node', snapshot);
    cy.on('zoom pan', snapshot);
    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      if (scheduled !== null) cancelAnimationFrame(scheduled);
      syncGeometry.current = () => {};
      cy.destroy();
      core.current = null;
    };
  }, []);
  useEffect(() => {
    const cy = core.current;
    if (!cy) return;
    const items = elements(nodes, relations, catalog);
    const wanted = new Set(items.map((i) => String(i.data.id)));
    const retained: Positions = {};
    cy.nodes().forEach((n) => {
      retained[n.id()] = { ...n.position() };
    });
    // Um snapshot só é aplicado quando muda. Depois de arrastar, a posição
    // atual do Cytoscape prevalece sobre snapshots antigos nas expansões.
    const pinned =
      appliedPositions.current === positions ? retained : positions;
    appliedPositions.current = positions;
    cy.batch(() => {
      cy.elements()
        .filter((e) => !wanted.has(e.id()))
        .remove();
      for (const item of items) {
        const old = cy.getElementById(String(item.data.id));
        if (old.length) old.data(item.data);
        else cy.add(item);
      }
      cy.nodes().forEach((n) => {
        const p = pinned[n.id()];
        if (p) n.position(p);
      });
      arrangeNew(cy, pinned);
    });
    const current: Positions = {};
    cy.nodes().forEach((n) => {
      current[n.id()] = { ...n.position() };
    });
    syncGeometry.current();
    callbacks.current.onSnapshot(current, {
      zoom: cy.zoom(),
      pan: { ...cy.pan() },
    });
  }, [nodes, relations, catalog, positions]);
  useEffect(() => {
    syncGeometry.current();
  }, [groups]);
  useEffect(() => {
    const cy = core.current;
    if (!cy) return;
    cy.elements().unselect().removeClass('neighbor faded selected-edge');
    const target = cy.getElementById(selected);
    if (!target.length) {
      flowEdges.current = [];
      return;
    }
    target.select();
    target.neighborhood('node').addClass('neighbor');
    // Com algo selecionado, o resto do desenho recua em vez de sumir.
    cy.elements().difference(target.closedNeighborhood()).addClass('faded');
    // Toda relação conectada à seleção (não só a aresta tocada diretamente)
    // fica ultramarina — ver `.selected-edge` em styles/index.ts.
    const edgeCollection = isEdgeSelection(target)
      ? target
      : target.connectedEdges();
    edgeCollection.addClass('selected-edge');
    // Só relações direcionais da seleção recebem o fluxo origem → destino;
    // relações simétricas não têm sentido a atribuir.
    flowEdges.current = edgeCollection
      .filter((e) => !e.data('symmetric'))
      .toArray() as EdgeSingular[];
  }, [selected, nodes, relations]);
  useEffect(() => {
    function clear() {
      const svg = flowLayer.current;
      if (svg) svg.replaceChildren();
    }
    function stop() {
      if (flowFrame.current !== null) {
        cancelAnimationFrame(flowFrame.current);
        flowFrame.current = null;
      }
      clear();
    }
    const paths = new Map<
      string,
      { key: string; path: ArcPath; phase: number; last: number }
    >();
    function tick(now: number) {
      const cy = core.current;
      const svg = flowLayer.current;
      const box = container.current;
      if (cy && svg && box) {
        svg.setAttribute('width', String(box.clientWidth));
        svg.setAttribute('height', String(box.clientHeight));
        const zoom = cy.zoom();
        const pan = cy.pan();
        let markup = '';
        flowEdges.current.forEach((edge) => {
          if (!cy.getElementById(edge.id()).length) return;
          const a = edge.sourceEndpoint();
          const b = edge.targetEndpoint();
          const controls = edge.controlPoints() ?? [];
          const points = [a, ...controls, b];
          if (
            !points.every(
              (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
            )
          )
            return;
          const key = JSON.stringify(points);
          let state = paths.get(edge.id());
          if (!state) {
            const offset =
              ([...edge.id()].reduce(
                (sum, character) => sum + character.charCodeAt(0),
                0,
              ) %
                100) /
              100;
            state = {
              key,
              path: samplePath(a, controls, b),
              phase: offset,
              last: now,
            };
            paths.set(edge.id(), state);
          } else if (state.key !== key) {
            state.key = key;
            state.path = samplePath(a, controls, b);
          }
          if (state.path.length < 1) return;
          const duration = Math.min(
            5000,
            Math.max(3000, state.path.length * zoom * 9),
          );
          state.phase =
            (state.phase + Math.max(0, now - state.last) / duration) % 1;
          state.last = now;
          const point = pointOnSampledPath(state.path, state.phase);
          const rendered = toRendered(point, zoom, pan);
          markup += `<polygon points="-3.4,-3 4,0 -3.4,3" fill="${highlightColor}" transform="translate(${rendered.x.toFixed(1)} ${rendered.y.toFixed(1)}) rotate(${point.angle.toFixed(1)})" />`;
        });
        svg.innerHTML = markup;
      }
      flowFrame.current = requestAnimationFrame(tick);
    }
    function start() {
      if (flowFrame.current === null)
        flowFrame.current = requestAnimationFrame(tick);
    }
    if (!flowEnabled) {
      stop();
      return;
    }
    if (!document.hidden) start();
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        paths.forEach((state) => {
          state.last = performance.now();
        });
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, [flowEnabled]);
  useEffect(() => {
    core.current?.viewport(viewport);
  }, [viewport]);
  useEffect(() => {
    const cy = core.current;
    const node = cy?.getElementById(focus);
    if (cy && node?.length && focusRevision !== appliedFocusRevision.current) {
      appliedFocusRevision.current = focusRevision;
      cy.center(node);
    }
  }, [focus, focusRevision]);
  useEffect(() => {
    const cy = core.current;
    if (cy && zoomCommand.revision)
      cy.zoom({
        level: cy.zoom() * zoomCommand.factor,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
      });
  }, [zoomCommand]);
  useEffect(() => {
    const cy = core.current;
    if (fitRevision && cy?.nodes().length) cy.fit(cy.elements(), 70);
  }, [fitRevision]);
  return (
    <div className="graph-canvas-wrap">
      <div
        ref={container}
        className="graph-canvas"
        role="img"
        aria-label={`Mapa com ${nodes.length} pontos e ${relations.length} relações. Use o modo lista para navegação por teclado.`}
      />
      <svg
        ref={flowLayer}
        className="flow-layer"
        aria-hidden="true"
        focusable="false"
      />
      <div className="context-groups" aria-hidden="true">
        {groups.map((group) => {
          const p = groupPositions[group.id];
          if (!p) return null;
          return (
            <div
              key={group.id}
              className="context-group"
              style={{ left: p.x, top: p.y }}
            >
              <div className="context-group-name">{group.label}</div>
              <div className="context-group-period">{group.period}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
