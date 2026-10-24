// Modelo de apresentação PROVISÓRIO. Não representa um contrato OpenAPI publicado.
import { z } from 'zod';
export const kindSchema = z.enum(['person', 'tradition', 'concept', 'work']);
export const periodSchema = z.object({
  start: z.number().int().nullable(),
  end: z.number().int().nullable(),
  approximate: z.boolean(),
});
export const baseSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  version: z.string(),
  status: z.enum(['active', 'pending', 'archived']),
});
export const contextSchema = baseSchema.extend({
  region: z.string(),
  period: periodSchema,
});
export const sourceSchema = baseSchema.extend({
  url: z.string(),
  author: z.string(),
});
export const nodeSchema = baseSchema.extend({
  kind: kindSchema,
  aliases: z.array(z.string()),
  conceptScope: z.string(),
  contexts: z.array(z.string()),
  degreeTotal: z.number().nonnegative(),
});
export const evidenceSchema = z.object({
  sourceId: z.string(),
  role: z.enum(['supports', 'challenges', 'contextualizes']),
  sourceRole: z.enum(['primary', 'secondary']),
  excerpt: z.string(),
  locator: z.string(),
});
export const relationSchema = baseSchema.extend({
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  claim: z.string(),
  justification: z.string(),
  context: z.string(),
  evidenceStatus: z.enum([
    'documented',
    'attributed_interpretation',
    'inference',
  ]),
  intensity: z.number().int().min(1).max(3).nullable(),
  intensityReason: z.string(),
  attribution: z.string(),
  contested: z.boolean(),
  evidence: z.array(evidenceSchema),
});
export const predicateSchema = z.object({
  id: z.string(),
  label: z.string(),
  inverse: z.string(),
  symmetric: z.boolean(),
  sourceKinds: z.array(kindSchema),
  targetKinds: z.array(kindSchema),
});
export const catalogSchema = z.object({
  kinds: z.array(z.object({ id: kindSchema, label: z.string() })),
  predicates: z.array(predicateSchema),
});
export const filtersSchema = z.object({
  kind: z.string(),
  context: z.string(),
  pending: z.boolean(),
  from: z.number().nullable(),
  to: z.number().nullable(),
  unknown: z.boolean(),
});
export const viewSchema = baseSchema.extend({
  root: z.string(),
  filters: filtersSchema,
  expandedNodes: z.array(z.string()),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  viewport: z.object({
    zoom: z.number(),
    pan: z.object({ x: z.number(), y: z.number() }),
  }),
});
export const historySchema = z.object({
  id: z.string(),
  at: z.string(),
  action: z.string(),
  description: z.string(),
});
export const pendingSchema = baseSchema.extend({
  reason: z.string(),
  candidates: z.array(z.string()),
});
export const importSchema = baseSchema.extend({
  at: z.string(),
  created: z.array(z.string()),
  updated: z.array(z.string()),
  reused: z.array(z.string()),
  pending: z.array(z.string()),
  conflicts: z.array(z.string()),
  undone: z.boolean(),
});
export const schemas = {
  nodes: nodeSchema,
  relations: relationSchema,
  sources: sourceSchema,
  contexts: contextSchema,
  views: viewSchema,
};
export type EntityType = keyof typeof schemas;
export type Node = z.infer<typeof nodeSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Context = z.infer<typeof contextSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Filters = z.infer<typeof filtersSchema>;
export type SavedView = z.infer<typeof viewSchema>;
export type Entity = Node | Relation | Source | Context | SavedView;
export const neighborSchema = z.object({
  nodes: z.array(nodeSchema),
  relations: z.array(relationSchema),
  nextCursor: z.string().nullable(),
  truncated: z.boolean(),
});
export type NeighborPage = z.infer<typeof neighborSchema>;
export const defaultFilters: Filters = {
  kind: '',
  context: '',
  pending: false,
  from: null,
  to: null,
  unknown: true,
};
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };
