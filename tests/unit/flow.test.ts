import { describe, expect, it } from 'vitest';
import { pointOnEdge, toRendered } from '../../src/graph/flow';
import type { Point } from '../../src/graph/flow';
describe('pointOnEdge sem pontos de controle (reta)', () => {
  const source: Point = { x: 0, y: 0 };
  const target: Point = { x: 20, y: 10 };
  it('t=0 é a origem, t=1 é o destino e t=0.5 é o meio do segmento', () => {
    expect(pointOnEdge(source, [], target, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointOnEdge(source, [], target, 1)).toMatchObject({
      x: 20,
      y: 10,
    });
    const mid = pointOnEdge(source, [], target, 0.5);
    expect(mid.x).toBeCloseTo(10);
    expect(mid.y).toBeCloseTo(5);
  });
  it('o ângulo é o da reta origem → destino', () => {
    const expected = (Math.atan2(10, 20) * 180) / Math.PI;
    expect(pointOnEdge(source, [], target, 0.3).angle).toBeCloseTo(expected);
  });
});
describe('pointOnEdge com um ponto de controle (Bézier quadrática, paralelas)', () => {
  const source: Point = { x: 0, y: 0 };
  const target: Point = { x: 10, y: 0 };
  const control: Point = { x: 5, y: 8 };
  it('t=0 é a origem e t=1 é o destino', () => {
    expect(pointOnEdge(source, [control], target, 0)).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(pointOnEdge(source, [control], target, 1)).toMatchObject({
      x: 10,
      y: 0,
    });
  });
  it('t=0.5 é (source + 2*controle + target) / 4, fora da corda', () => {
    const mid = pointOnEdge(source, [control], target, 0.5);
    expect(mid.x).toBeCloseTo((source.x + 2 * control.x + target.x) / 4);
    expect(mid.y).toBeCloseTo((source.y + 2 * control.y + target.y) / 4);
    const chordMid = {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2,
    };
    expect(Math.abs(mid.y - chordMid.y)).toBeGreaterThan(1);
  });
});
describe('direção origem → destino', () => {
  it('a distância à origem cresce com t em uma reta', () => {
    const source: Point = { x: 0, y: 0 };
    const target: Point = { x: 30, y: 40 };
    const d0 = pointOnEdge(source, [], target, 0.2);
    const d1 = pointOnEdge(source, [], target, 0.6);
    const dist = (p: Point) => Math.hypot(p.x - source.x, p.y - source.y);
    expect(dist(d1)).toBeGreaterThan(dist(d0));
  });
  it('um par de arestas com sentidos opostos tem tangentes opostas', () => {
    const a: Point = { x: 0, y: 0 };
    const b: Point = { x: 30, y: -10 };
    const forward = pointOnEdge(a, [], b, 0.3).angle;
    const backward = pointOnEdge(b, [], a, 0.3).angle;
    const normalize = (deg: number) => ((deg % 360) + 360) % 360;
    expect(normalize(forward - backward)).toBeCloseTo(180, 0);
  });
});
describe('toRendered + pointOnEdge preservam afinidade sob zoom/pan', () => {
  const zoom = 1.4;
  const pan: Point = { x: 30, y: -20 };
  const source: Point = { x: 0, y: 0 };
  const control: Point = { x: 5, y: 8 };
  const target: Point = { x: 10, y: 0 };
  it('ponto em t é o mesmo calculando antes ou depois de renderizar', () => {
    const t = 0.37;
    const inModel = pointOnEdge(source, [control], target, t);
    const renderedAfter = toRendered(inModel, zoom, pan);
    const rSource = toRendered(source, zoom, pan);
    const rControl = toRendered(control, zoom, pan);
    const rTarget = toRendered(target, zoom, pan);
    const renderedBefore = pointOnEdge(rSource, [rControl], rTarget, t);
    expect(renderedBefore.x).toBeCloseTo(renderedAfter.x);
    expect(renderedBefore.y).toBeCloseTo(renderedAfter.y);
    expect(renderedBefore.angle).toBeCloseTo(inModel.angle);
  });
});
describe('cadeia de quadráticas com dois pontos de controle', () => {
  // Com >=2 controles o Cytoscape NÃO liga os controles em linha reta: ele
  // insere o PONTO MÉDIO entre controles consecutivos como destino
  // intermediário e desenha duas quadráticas (origem→c1→médio,
  // médio→c2→destino) — ver `edge-control-points.mjs`/`drawing-edges.mjs`
  // do pacote `cytoscape`. Os pontos deste teste são colineares (todos em
  // x=0) só para que o comprimento total dê exatamente 111 por coincidência
  // geométrica; o valor em t=0.5 já não é o meio do segmento por índice.
  const source: Point = { x: 0, y: 0 };
  const c1: Point = { x: 0, y: 10 };
  const c2: Point = { x: 0, y: 11 };
  const target: Point = { x: 0, y: 111 };
  it('t=0 é a origem e t=1 é o destino', () => {
    expect(pointOnEdge(source, [c1, c2], target, 0)).toMatchObject({
      x: 0,
      y: 0,
    });
    expect(pointOnEdge(source, [c1, c2], target, 1)).toMatchObject({
      x: 0,
      y: 111,
    });
  });
  it('avança distâncias semelhantes em intervalos iguais de tempo num traçado reto', () => {
    const positions = Array.from({ length: 9 }, (_, i) =>
      pointOnEdge(source, [c1, c2], target, i / 8),
    );
    const steps = positions
      .slice(1)
      .map((point, i) =>
        Math.hypot(point.x - positions[i]!.x, point.y - positions[i]!.y),
      );
    const shortest = Math.min(...steps);
    const longest = Math.max(...steps);
    expect(shortest).toBeGreaterThan(0);
    expect(longest / shortest).toBeLessThan(1.2);
  });
});
