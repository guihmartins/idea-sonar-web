import type {
  Context,
  Entity,
  EntityType,
  Node,
  PendingItem,
  Relation,
  SavedView,
  Source,
} from '../api/domain';
import { formatPeriod } from './period';
export const kindLabels = {
  person: 'Pessoa',
  tradition: 'Tradição',
  concept: 'Conceito',
  work: 'Obra',
} as const;
export const conceptScopeLabels = {
  broad: 'Conceito amplo',
  contextual: 'Interpretação contextualizada',
} as const;
export const precisionLabels = {
  unknown: 'Desconhecida',
  approximate: 'Aproximada',
  range: 'Intervalo',
  exact: 'Exata',
} as const;
export const stanceLabels = {
  supports: 'Sustenta',
  challenges: 'Contesta',
  contextualizes: 'Contextualiza',
} as const;
export const sourceKindLabels = {
  primary: 'Fonte primária',
  secondary: 'Fonte secundária',
  conversation: 'Conversa',
  other: 'Outro tipo',
} as const;
export const originLabels = {
  chat: 'Chat',
  manual: 'Manual',
  local_classifier: 'Classificador local',
  seed: 'Carga inicial',
} as const;
export const importStatusLabels = {
  committed: 'Aplicada',
  committed_with_pending: 'Aplicada com pendências',
  undone: 'Desfeita',
} as const;
export const historyLabels: Record<string, string> = {
  create: 'Criação',
  update: 'Edição',
  undo: 'Reversão de importação',
  resolve: 'Resolução de pendência',
};
// Cada tipo de registro tem um campo de título e um resumo diferentes na API.
const titles: Record<EntityType, (entity: Entity) => string> = {
  nodes: (e) => (e as Node).label,
  contexts: (e) => (e as Context).label,
  sources: (e) => (e as Source).title,
  relations: (e) => (e as Relation).claim,
  views: (e) => (e as SavedView).name,
};
const summaries: Record<EntityType, (entity: Entity) => string> = {
  nodes: (e) => `${kindLabels[(e as Node).kind]} · ${(e as Node).description}`,
  contexts: (e) =>
    [(e as Context).regionLabel, formatPeriod(e as Context)]
      .filter(Boolean)
      .join(' · '),
  sources: (e) => (e as Source).authorText,
  relations: (e) => (e as Relation).justification,
  views: (e) => `${(e as SavedView).expandedNodes.length} pontos expandidos`,
};
export function entityTitle(type: EntityType, entity: Entity): string {
  return titles[type](entity);
}
export function entitySummary(type: EntityType, entity: Entity): string {
  return summaries[type](entity);
}
// Dados propostos para a pendência, localizados no lote original pelo clientRef.
export function pendingProposal(item: PendingItem): Record<string, unknown> {
  const ops = item.payload[item.entityType];
  const op = Array.isArray(ops)
    ? ops.find(
        (value): value is Record<string, unknown> =>
          !!value &&
          typeof value === 'object' &&
          (value as Record<string, unknown>).clientRef === item.clientRef,
      )
    : undefined;
  return op ?? {};
}
export function pendingTitle(item: PendingItem): string {
  const proposal = pendingProposal(item);
  const title = ['label', 'title', 'claim'].map((key) => proposal[key]);
  const text = title.find((value) => typeof value === 'string');
  return typeof text === 'string' ? text : item.clientRef;
}
