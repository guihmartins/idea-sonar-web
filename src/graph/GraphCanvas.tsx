import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core } from 'cytoscape';
import type { Catalog, Node, Relation } from '../api/domain';
import { elements } from './adapter/elements';
import { graphStyle } from './styles';
import { arrangeNew } from './layout/positions';
import type { Positions, Viewport } from './layout/positions';
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
}) {
  const container = useRef<HTMLDivElement>(null);
  const core = useRef<Core | null>(null);
  const appliedPositions = useRef<Positions | null>(null);
  const callbacks = useRef({ onSelect, onSnapshot });
  callbacks.current = { onSelect, onSnapshot };
  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [],
      style: graphStyle,
      minZoom: 0.15,
      maxZoom: 3,
    });
    core.current = cy;
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
    cy.on('dragfree', 'node', snapshot);
    cy.on('zoom pan', snapshot);
    const resize = new ResizeObserver(() => cy.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
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
    callbacks.current.onSnapshot(current, {
      zoom: cy.zoom(),
      pan: { ...cy.pan() },
    });
  }, [nodes, relations, catalog, positions]);
  useEffect(() => {
    const cy = core.current;
    if (!cy) return;
    cy.elements().unselect().removeClass('neighbor');
    const target = cy.getElementById(selected);
    target.select();
    target.neighborhood('node').addClass('neighbor');
  }, [selected, nodes, relations]);
  useEffect(() => {
    core.current?.viewport(viewport);
  }, [viewport]);
  useEffect(() => {
    const cy = core.current;
    const node = cy?.getElementById(focus);
    if (cy && node?.length) cy.center(node);
  }, [focus, focusRevision]);
  useEffect(() => {
    const cy = core.current;
    if (fitRevision && cy?.nodes().length) cy.fit(cy.elements(), 45);
  }, [fitRevision]);
  return (
    <div
      ref={container}
      className="graph-canvas"
      role="img"
      aria-label={`Mapa com ${nodes.length} pontos e ${relations.length} relações. Use o modo lista para navegação por teclado.`}
    />
  );
}
