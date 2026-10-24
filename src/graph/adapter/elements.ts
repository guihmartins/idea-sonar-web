import type { ElementDefinition } from 'cytoscape';
import type { Catalog, Node, Relation } from '../../api/domain';
export const shapes = {
  person: 'ellipse',
  tradition: 'hexagon',
  concept: 'diamond',
  work: 'rectangle',
} as const;
export function elements(
  nodes: Node[],
  relations: Relation[],
  catalog: Catalog,
): ElementDefinition[] {
  const colors = ['#2e7064', '#785ca0', '#95601f', '#356899'];
  const contexts = [...new Set(nodes.flatMap((n) => n.contexts))].sort();
  return [
    ...nodes.map((n) => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        label: n.label,
        shape: shapes[n.kind],
        size: Math.min(68, 30 + Math.sqrt(n.degreeTotal) * 5),
        color: n.contexts.length
          ? colors[contexts.indexOf(n.contexts[0] ?? '') % colors.length]
          : '#697c81',
      },
    })),
    ...relations.map((r) => ({
      group: 'edges' as const,
      data: {
        id: r.id,
        source: r.sourceId,
        target: r.targetId,
        label: catalog.predicates.find((p) => p.id === r.type)?.label ?? r.type,
        line: {
          documented: 'solid',
          attributed_interpretation: 'dashed',
          inference: 'dotted',
        }[r.evidenceStatus],
        width: r.intensity === null ? 1 : r.intensity * 1.5,
        arrow: catalog.predicates.find((p) => p.id === r.type)?.symmetric
          ? 'none'
          : 'triangle',
        contested: r.contested,
      },
    })),
  ];
}
