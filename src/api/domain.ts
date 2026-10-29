// Respostas da API (idea-sonar-api) validadas em runtime. Fonte: snapshot em
// contracts/openapi.json; o fim do arquivo confere os tipos gerados na compilação.
import { z } from 'zod';
import type { components } from './generated/schema';
export const kindSchema = z.enum(['person', 'tradition', 'concept', 'work']);
export const statusSchema = z.enum(['active', 'pending', 'archived']);
export const evidenceStatusSchema = z.enum([
  'documented',
  'attributed_interpretation',
  'inference',
]);
export const precisionSchema = z.enum([
  'unknown',
  'approximate',
  'range',
  'exact',
]);
const optionalText = z.string().nullable().default(null);
const optionalYear = z.number().int().nullable().default(null);
const detail = {
  id: z.string(),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: statusSchema,
};
export const contextSchema = z.object({
  ...detail,
  label: z.string(),
  traditionNodeId: optionalText,
  startYear: optionalYear,
  endYear: optionalYear,
  precision: precisionSchema,
  periodLabel: optionalText,
  regionLabel: optionalText,
  notes: optionalText,
});
export const sourceSchema = z.object({
  ...detail,
  title: z.string(),
  authorText: z.string(),
  workNodeId: optionalText,
  canonicalUrl: optionalText,
  publicationLabel: optionalText,
  doi: optionalText,
  accessedAt: optionalText,
  notes: optionalText,
});
export const nodeSchema = z.object({
  ...detail,
  kind: kindSchema,
  label: z.string(),
  description: z.string(),
  conceptScope: z.enum(['broad', 'contextual']).nullable().default(null),
  aliases: z.array(z.object({ alias: z.string(), language: z.string() })),
  contexts: z.array(z.string()),
  degreeTotal: z.number().int().nonnegative(),
  archivedAt: optionalText,
});
export const evidenceSchema = z.object({
  sourceId: optionalText,
  sourceKind: z.enum(['primary', 'secondary', 'conversation', 'other']),
  stance: z.enum(['supports', 'challenges', 'contextualizes']),
  locator: z.string(),
  excerpt: optionalText,
  explanation: z.string(),
  conversationReference: optionalText,
});
export const relationSchema = z.object({
  ...detail,
  sourceId: z.string(),
  targetId: z.string(),
  type: z.string(),
  contextId: optionalText,
  claim: z.string(),
  justification: z.string(),
  evidenceStatus: evidenceStatusSchema,
  intensity: z.number().int().min(1).max(3).nullable(),
  intensityReason: optionalText,
  attributionNodeId: optionalText,
  attributionText: optionalText,
  inferenceAuthor: optionalText,
  contested: z.boolean(),
  contestationNote: optionalText,
  evidence: z.array(evidenceSchema),
  archivedAt: optionalText,
});
export const relationTypeSchema = z.object({
  code: z.string(),
  label: z.string(),
  inverseLabel: z.string(),
  symmetric: z.boolean(),
  allowedEndpoints: z.array(
    z.object({ source: kindSchema, target: kindSchema }),
  ),
});
export const catalogSchema = z.object({
  nodeKinds: z.array(kindSchema),
  relationTypes: z.array(relationTypeSchema),
  evidenceStatuses: z.array(evidenceStatusSchema),
  editorialStatuses: z.array(statusSchema),
  intensities: z.array(
    z.object({ value: z.number().int().nullable(), label: z.string() }),
  ),
});
// Filtros salvos numa view: a API só aceita campos preenchidos.
export const storedFiltersSchema = z.object({
  kind: kindSchema.optional(),
  contextId: z.string().optional(),
  includePending: z.boolean().optional(),
  startYear: z.number().int().optional(),
  endYear: z.number().int().optional(),
  includeUnknownPeriod: z.boolean().optional(),
});
export const viewSchema = z.object({
  ...detail,
  name: z.string(),
  rootNodeId: optionalText,
  filters: storedFiltersSchema,
  expandedNodes: z.array(z.string()),
  positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  viewport: z.object({
    zoom: z.number(),
    pan: z.object({ x: z.number(), y: z.number() }),
  }),
});
export const identitySchema = z.object({
  issuer: z.string(),
  subject: z.string(),
  scopes: z.array(z.string()),
});
export const historySchema = z.object({
  id: z.string(),
  operation: z.string(),
  createdAt: z.string(),
  versionAfter: z.number().int(),
  batchId: optionalText,
  beforeData: z.record(z.string(), z.unknown()).nullable(),
  afterData: z.record(z.string(), z.unknown()).nullable(),
});
export const importOutcomeSchema = z.enum([
  'created',
  'updated',
  'reused',
  'pending',
]);
export const importSummarySchema = z.object({
  id: z.string(),
  origin: z.enum(['chat', 'manual', 'local_classifier', 'seed']),
  inputSummary: z.string(),
  status: z.enum(['committed', 'committed_with_pending', 'undone']),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const importDetailSchema = importSummarySchema.extend({
  result: z.object({
    created: z.number(),
    updated: z.number(),
    reused: z.number(),
    pending: z.number(),
    items: z.array(
      z.object({
        clientRef: z.string(),
        entityType: z.string(),
        entityId: z.string().nullable(),
        outcome: importOutcomeSchema,
        reason: z.string().nullable(),
      }),
    ),
  }),
});
export const undoResultSchema = z.object({
  batchId: z.string(),
  status: z.literal('undone'),
  reason: z.string(),
});
export const pendingSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  batchVersion: z.number().int().positive(),
  clientRef: z.string(),
  entityType: z.enum(['nodes', 'relations', 'sources', 'contexts']),
  reason: optionalText,
  dependencies: z.array(z.string()),
  // Lote original enviado à API; contém os dados propostos pelo clientRef.
  payload: z.record(z.string(), z.unknown()),
});
export const resolveResultSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  version: z.number().int(),
  reason: z.string(),
});
export const schemas = {
  nodes: nodeSchema,
  relations: relationSchema,
  sources: sourceSchema,
  contexts: contextSchema,
  views: viewSchema,
};
export type EntityType = keyof typeof schemas;
export type Kind = z.infer<typeof kindSchema>;
export type Status = z.infer<typeof statusSchema>;
export type Precision = z.infer<typeof precisionSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Context = z.infer<typeof contextSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type RelationType = z.infer<typeof relationTypeSchema>;
export type SavedView = z.infer<typeof viewSchema>;
export type StoredFilters = z.infer<typeof storedFiltersSchema>;
export type HistoryEntry = z.infer<typeof historySchema>;
export type ImportSummary = z.infer<typeof importSummarySchema>;
export type ImportDetail = z.infer<typeof importDetailSchema>;
export type PendingItem = z.infer<typeof pendingSchema>;
export type Entity = Node | Relation | Source | Context | SavedView;
export const neighborSchema = z.object({
  nodes: z.array(nodeSchema),
  relations: z.array(relationSchema),
  nextCursor: z.string().nullable(),
  truncated: z.boolean(),
});
export type NeighborPage = z.infer<typeof neighborSchema>;
// Filtros da UI; vazios/nulos são omitidos na query e na view salva.
export interface Filters {
  kind: Kind | '';
  contextId: string;
  includePending: boolean;
  startYear: number | null;
  endYear: number | null;
  includeUnknownPeriod: boolean;
}
export const defaultFilters: Filters = {
  kind: '',
  contextId: '',
  includePending: false,
  startYear: null,
  endYear: null,
  includeUnknownPeriod: true,
};
export function fromStoredFilters(stored: StoredFilters): Filters {
  return {
    kind: stored.kind ?? '',
    contextId: stored.contextId ?? '',
    includePending: stored.includePending ?? false,
    startYear: stored.startYear ?? null,
    endYear: stored.endYear ?? null,
    includeUnknownPeriod: stored.includeUnknownPeriod ?? true,
  };
}
export function toStoredFilters(filters: Filters): StoredFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== '' && value !== null,
    ),
  ) as StoredFilters;
}
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

// Falha a compilação se o modelo validado divergir dos tipos gerados do OpenAPI.
type Schemas = components['schemas'];
type Assignable<T extends U, U> = T;
export type ContractCheck = [
  Assignable<Node, Schemas['NodeDetail']>,
  Assignable<Omit<Relation, 'type'>, Omit<Schemas['RelationDetail'], 'type'>>,
  Assignable<Source, Schemas['SourceDetail']>,
  Assignable<Context, Schemas['ContextDetail']>,
  Assignable<Catalog, Schemas['Catalog']>,
  Assignable<z.infer<typeof identitySchema>, Schemas['Identity']>,
];
