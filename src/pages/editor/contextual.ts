// Conceito contextual: criar ou ativar um ponto contextual exige, na API, uma
// relação `contextualizes` ativa com um conceito amplo ativo, e uma relação
// ativa exige pontos ativos. Pelo REST um não ativa antes do outro; só o lote
// (POST /imports) grava os dois na mesma transação e confere o escopo no fim.
import type {
  BatchNode,
  BatchRef,
  BatchRelation,
  Entity,
  ImportBatch,
  ImportItem,
  ImportResult,
  Node,
  Relation,
} from '../../api/domain';
import {
  evidenceInput,
  nodeBody,
  orNull,
  text,
  validateAttribution,
  validateSupport,
} from './payload';
import type { EditorDraft, Editable } from './payload';

export const NODE_REF = 'conceito';
export const RELATION_REF = 'contextualizacao';

export type ContextualFlow = 'create' | 'activate';
export interface BatchOutcome {
  flow: ContextualFlow;
  result: ImportResult;
}

export const isContextualConcept = (fields: Record<string, string>) =>
  fields.kind === 'concept' && fields.conceptScope === 'contextual';

// Cadastro novo ativo, ou ponto pendente/arquivado sendo ativado: nos dois a
// gravação precisa do lote. Conceito já ativo e rascunho pendente seguem o REST.
export function contextualFlow(
  type: Editable,
  fields: Record<string, string>,
  baseline: Entity | undefined,
): ContextualFlow | null {
  if (type !== 'nodes' || !isContextualConcept(fields)) return null;
  if (fields.status !== 'active') return null;
  if (!baseline) return 'create';
  return baseline.status === 'active' ? null : 'activate';
}

// Relações de contextualização pendentes que partem deste conceito.
export function pendingContextualizations(
  relations: Relation[],
  node: Node,
): Relation[] {
  return relations.filter(
    (r) =>
      r.type === 'contextualizes' &&
      r.sourceId === node.id &&
      r.status === 'pending',
  );
}

const envelope = (key: string, inputSummary: string) => ({
  contractVersion: '1' as const,
  policyVersion: '1' as const,
  idempotencyKey: key,
  origin: 'manual' as const,
  inputSummary,
  dryRun: false,
});

const toRef = (id: string): BatchRef => ({ id });

function requireContexts(draft: EditorDraft) {
  if (draft.contexts.length === 0)
    throw new Error('Conceito contextual ativo exige ao menos um contexto.');
}

function evidenceStatusOf(
  fields: Record<string, string>,
): 'documented' | 'attributed_interpretation' | 'inference' {
  const status = fields.evidenceStatus;
  if (status === 'documented' || status === 'attributed_interpretation')
    return status;
  return 'inference';
}

// Relação nova `contextualizes`: origem é o conceito (por clientRef ou ID) e
// destino o conceito amplo escolhido. Mesmas regras da relação do editor.
function contextualizationOp(
  draft: EditorDraft,
  source: BatchRef,
): BatchRelation {
  const { fields } = draft;
  if (!fields.targetId)
    throw new Error(
      'Selecione o conceito amplo que contextualiza este conceito.',
    );
  if (!text(fields.claim) || !text(fields.justification))
    throw new Error(
      'Informe a afirmação e a justificativa da contextualização.',
    );
  const evidence = draft.evidence.map(evidenceInput);
  validateSupport(fields.evidenceStatus, evidence);
  validateAttribution(fields);
  const status = evidenceStatusOf(fields);
  return {
    op: 'create',
    clientRef: RELATION_REF,
    type: 'contextualizes',
    source,
    target: toRef(fields.targetId),
    claim: text(fields.claim),
    justification: text(fields.justification),
    evidenceStatus: status,
    intensity: null,
    attributionText:
      status === 'attributed_interpretation'
        ? orNull(fields.attributionText)
        : null,
    inferenceAuthor:
      status === 'inference' ? orNull(fields.inferenceAuthor) : null,
    contested: false,
    status: 'active',
    evidence: evidence.map((e) => ({
      ...e,
      sourceId: e.sourceId ? toRef(e.sourceId) : null,
    })),
  };
}

// Criação: ponto contextual ativo e sua contextualização, no mesmo lote.
export function createContextualBatch(
  draft: EditorDraft,
  key: string,
): ImportBatch {
  requireContexts(draft);
  const body = nodeBody(draft);
  return {
    ...envelope(key, 'Conceito contextual criado no editor'),
    nodes: [
      {
        op: 'create',
        clientRef: NODE_REF,
        kind: 'concept',
        label: body.label,
        description: body.description,
        conceptScope: 'contextual',
        startYear: body.startYear,
        endYear: body.endYear,
        precision: body.precision,
        periodLabel: body.periodLabel,
        aliases: body.aliases,
        identifiers: body.identifiers,
        contexts: body.contexts.map(toRef),
        status: 'active',
      },
    ],
    relations: [contextualizationOp(draft, { clientRef: NODE_REF })],
  };
}

type NodeUpdate = Extract<BatchNode, { op: 'update' }>;

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
// A API devolve aliases, identificadores e contextos ordenados, não na ordem
// digitada: mudança de verdade é mudança do conjunto, não da ordem.
const canonical = (list: unknown[]) =>
  list.map((x) => JSON.stringify(x)).sort();
const sameSet = (a: unknown[], b: unknown[]) =>
  sameJson(canonical(a), canonical(b));

// Update parcial: só o que mudou no formulário além do estado. Tipo e escopo
// não mudam depois da criação, então nunca entram.
function changedNodeFields(
  draft: EditorDraft,
  baseline: Node,
): Partial<NodeUpdate> {
  const body = nodeBody(draft);
  const changed: Partial<NodeUpdate> = {};
  if (body.label !== baseline.label) changed.label = body.label;
  if (body.description !== baseline.description)
    changed.description = body.description;
  Object.assign(changed, changedPeriod(body, baseline));
  if (!sameSet(body.aliases, baseline.aliases)) changed.aliases = body.aliases;
  if (!sameSet(body.identifiers, baseline.identifiers))
    changed.identifiers = body.identifiers;
  if (!sameSet(body.contexts, baseline.contexts))
    changed.contexts = body.contexts.map(toRef);
  return changed;
}
function changedPeriod(
  body: ReturnType<typeof nodeBody>,
  baseline: Node,
): Partial<NodeUpdate> {
  const keys = ['startYear', 'endYear', 'precision', 'periodLabel'] as const;
  const changed: Partial<NodeUpdate> = {};
  for (const key of keys)
    if (body[key] !== baseline[key])
      Object.assign(changed, { [key]: body[key] });
  return changed;
}

// Ativação: o ponto e uma relação de contextualização vão para `active` juntos.
// Com relação pendente, ela só muda de estado; sem ela, o lote a cria.
export function activateContextualBatch(
  draft: EditorDraft,
  baseline: Node,
  relation: Relation | undefined,
  key: string,
): ImportBatch {
  requireContexts(draft);
  const node: NodeUpdate = {
    op: 'update',
    clientRef: NODE_REF,
    id: baseline.id,
    expectedVersion: baseline.version,
    status: 'active',
    ...changedNodeFields(draft, baseline),
  };
  const link: BatchRelation = relation
    ? {
        op: 'update',
        clientRef: RELATION_REF,
        id: relation.id,
        expectedVersion: relation.version,
        status: 'active',
      }
    : contextualizationOp(draft, toRef(baseline.id));
  return {
    ...envelope(key, 'Conceito contextual ativado no editor'),
    nodes: [node],
    relations: [link],
  };
}

export const pendingItems = (result: ImportResult): ImportItem[] =>
  result.items.filter((item) => item.outcome === 'pending');

// ID do ponto depois do lote; ausente se ele não chegou a existir.
export function savedNodeId(
  flow: ContextualFlow,
  baseline: Entity | undefined,
  result: ImportResult,
): string | null {
  if (flow === 'activate') return baseline?.id ?? null;
  return result.clientRefToId[NODE_REF] ?? null;
}
