import type { ElementDefinition } from 'cytoscape';
import type { Catalog, Node, Relation } from '../../api/domain';
import { contextColors, neutralColor } from '../styles/palette';
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
          ? contextColors[
              contexts.indexOf(n.contexts[0] ?? '') % contextColors.length
            ]
          : neutralColor,
      },
    })),
    ...relations.map((r) => {
      const type = catalog.relationTypes.find((t) => t.code === r.type);
      return {
        group: 'edges' as const,
        data: {
          id: r.id,
          source: r.sourceId,
          target: r.targetId,
          label: type?.label ?? r.type,
          line: {
            documented: 'solid',
            attributed_interpretation: 'dashed',
            inference: 'dotted',
          }[r.evidenceStatus],
          width: r.intensity === null ? 1 : r.intensity * 1.5,
          arrow: type?.symmetric ? 'none' : 'triangle',
          contested: r.contested,
        },
      };
    }),
  ];
}
