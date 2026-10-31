export interface Point {
  x: number;
  y: number;
}
/** Converte do modelo do Cytoscape para pixels do contêiner. */
export function toRendered(p: Point, zoom: number, pan: Point): Point {
  return { x: p.x * zoom + pan.x, y: p.y * zoom + pan.y };
}
interface QuadraticSegment {
  a: Point;
  c: Point;
  b: Point;
}
function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
/**
 * Reproduz exatamente a cadeia de quadráticas que o Cytoscape desenha para
 * `unbundled-bezier` com N pontos de controle reais (`edge.controlPoints()`):
 * entre cada par de controles consecutivos ele insere o PONTO MÉDIO deles
 * como destino intermediário, e cada segmento é uma quadrática
 * origem→controle→destino (ver `edge-control-points.mjs`/`drawing-edges.mjs`
 * do pacote `cytoscape`, função `calculateArrowAngles`/loop de
 * `quadraticCurveTo`). Para 0 controles a aresta é reta; para 1, a cadeia tem
 * um único segmento (igual ao comportamento anterior, sem mudança).
 */
function quadraticChain(
  source: Point,
  controls: Point[],
  target: Point,
): QuadraticSegment[] {
  const pts: Point[] = [source];
  controls.forEach((control, i) => {
    pts.push(control);
    const next = controls[i + 1];
    if (next) pts.push(midpoint(control, next));
  });
  pts.push(target);
  const segments: QuadraticSegment[] = [];
  for (let i = 0; i + 2 < pts.length; i += 2) {
    segments.push({
      a: pts[i] as Point,
      c: pts[i + 1] as Point,
      b: pts[i + 2] as Point,
    });
  }
  return segments;
}
function pointOnQuadratic(
  a: Point,
  c: Point,
  b: Point,
  t: number,
): { x: number; y: number; angle: number } {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    angle:
      (Math.atan2(
        2 * u * (c.y - a.y) + 2 * t * (b.y - c.y),
        2 * u * (c.x - a.x) + 2 * t * (b.x - c.x),
      ) *
        180) /
      Math.PI,
  };
}
export interface ArcPath {
  length: number;
  samples: { distance: number; segment: number; t: number }[];
  segments: QuadraticSegment[];
}

/** Amostragem por comprimento de arco; construída novamente somente se a geometria mudar. */
export function samplePath(
  source: Point,
  controls: Point[],
  target: Point,
): ArcPath {
  const segments = controls.length
    ? quadraticChain(source, controls, target)
    : [{ a: source, c: midpoint(source, target), b: target }];
  const samples = [{ distance: 0, segment: 0, t: 0 }];
  let length = 0;
  let previous = source;
  segments.forEach((segment, index) => {
    for (let i = 1; i <= 32; i += 1) {
      const t = i / 32;
      const point = pointOnQuadratic(segment.a, segment.c, segment.b, t);
      length += Math.hypot(point.x - previous.x, point.y - previous.y);
      samples.push({ distance: length, segment: index, t });
      previous = point;
    }
  });
  return { length, samples, segments };
}

export function pointOnSampledPath(
  path: ArcPath,
  fraction: number,
): { x: number; y: number; angle: number } {
  const distance = Math.max(0, Math.min(1, fraction)) * path.length;
  let low = 0;
  let high = path.samples.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if ((path.samples[middle]?.distance ?? 0) < distance) low = middle;
    else high = middle;
  }
  const previous = path.samples[low]!;
  const next = path.samples[high]!;
  const ratio =
    next.distance === previous.distance
      ? 0
      : (distance - previous.distance) / (next.distance - previous.distance);
  const segment = path.segments[next.segment]!;
  const startT = previous.segment === next.segment ? previous.t : 0;
  return pointOnQuadratic(
    segment.a,
    segment.c,
    segment.b,
    startT + (next.t - startT) * ratio,
  );
}

export function pointOnEdge(
  source: Point,
  controls: Point[],
  target: Point,
  t: number,
) {
  return pointOnSampledPath(samplePath(source, controls, target), t);
}
export function pathLength(
  source: Point,
  controls: Point[],
  target: Point,
): number {
  return samplePath(source, controls, target).length;
}
