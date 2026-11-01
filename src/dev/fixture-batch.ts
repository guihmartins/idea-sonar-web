// EXCLUSIVAMENTE DEV/TEST. Lote de importação da API fictícia: reproduz, em
// memória, as regras de POST /imports que o editor usa para conceitos
// contextuais (idea-sonar-api, contrato 1.1.0):
// - update é parcial; campo omitido é preservado e lista enviada substitui;
// - o escopo contextual só é conferido no fim do lote (ponto e relação nascem
//   na mesma transação); sem contexto ou sem `contextualizes` ativa para um
//   conceito amplo ativo, o ponto volta a `pending` com as relações ativas;
// - relação ativa exige pontos ativos; nome repetido vira pendência.
import { ApiError } from '../api/client';
import {
  duplicateFailure,
  homonyms,
  nodeIssues,
  normalizedIdentifiers,
  owners,
  validationFailure,
} from './fixture-nodes';
import type {
  Evidence,
  ImportBatch,
  ImportItem,
  ImportResult,
  Node,
  Relation,
} from '../api/domain';

export interface BatchDb {
  nodes: Node[];
  relations: Relation[];
}
type Ref = { id: string } | { clientRef: string } | null | undefined;
interface EvidenceOp {
  sourceKind: Evidence['sourceKind'];
  stance: Evidence['stance'];
  locator: string;
  explanation: string;
  sourceId?: Ref;
  excerpt?: string | null;
  conversationReference?: string | null;
}
// Visão frouxa de uma operação do lote: create traz tudo, update só o que muda
// (os campos de create ficam ausentes em tempo de execução).
interface Op {
  op: string;
  clientRef: string;
  id: string;
  expectedVersion: number;
  status?: Node['status'];
  kind: Node['kind'];
  label: string;
  description: string;
  conceptScope?: Node['conceptScope'];
  startYear?: number | null;
  endYear?: number | null;
  precision?: Node['precision'];
  periodLabel?: string | null;
  aliases?: Node['aliases'];
  identifiers?: Node['identifiers'];
  contexts?: Ref[];
  type: string;
  source?: Ref;
  target?: Ref;
  contextId?: Ref;
  attributionNodeId?: Ref;
  claim: string;
  justification: string;
  evidenceStatus: Relation['evidenceStatus'];
  intensity?: number | null;
  intensityReason?: string | null;
  attributionText?: string | null;
  inferenceAuthor?: string | null;
  contested?: boolean;
  contestationNote?: string | null;
  evidence?: EvidenceOp[];
}
interface Ctx {
  db: BatchDb;
  now: string;
  ids: Record<string, string>;
  items: Map<string, ImportItem>;
}

const CONTEXT_REQUIRED =
  'Conceito contextual ativo exige contexto e relação com conceito amplo';

export function apiFailure(status: number, code: string, message: string) {
  return new ApiError(status, message, {
    code,
    message,
    details: [],
    requestId: 'fixture',
  });
}

function ref(ctx: Ctx, value: Ref): string | null {
  if (!value) return null;
  return 'id' in value ? value.id : (ctx.ids[value.clientRef] ?? null);
}

function settle(
  ctx: Ctx,
  op: Op,
  entityType: string,
  outcome: ImportItem['outcome'],
  entityId: string,
) {
  ctx.ids[op.clientRef] = entityId;
  ctx.items.set(op.clientRef, {
    clientRef: op.clientRef,
    entityType,
    entityId,
    outcome,
    reason: null,
    candidates: [],
  });
}

function pend(
  ctx: Ctx,
  op: Op,
  entityType: string,
  reason: string,
  candidates: string[] = [],
) {
  delete ctx.ids[op.clientRef];
  ctx.items.set(op.clientRef, {
    clientRef: op.clientRef,
    entityType,
    entityId: null,
    outcome: 'pending',
    reason,
    candidates,
  });
}

function mustFind<T extends { id: string; version: number }>(
  list: T[],
  op: Op,
  label: string,
): T {
  const found = list.find((item) => item.id === op.id);
  if (!found)
    throw apiFailure(
      400,
      'INVALID_REFERENCE',
      `Referência ${label}/${op.id} inexistente`,
    );
  if (found.version !== op.expectedVersion)
    throw apiFailure(409, 'VERSION_CONFLICT', 'Versão foi alterada');
  return found;
}

function newNode(ctx: Ctx, op: Op): Node {
  return {
    id: crypto.randomUUID(),
    version: 1,
    status: op.status ?? 'active',
    createdAt: ctx.now,
    updatedAt: ctx.now,
    kind: op.kind,
    label: op.label,
    description: op.description,
    conceptScope: op.conceptScope ?? null,
    startYear: op.startYear ?? null,
    endYear: op.endYear ?? null,
    precision: op.precision ?? 'unknown',
    periodLabel: op.periodLabel ?? null,
    aliases: op.aliases ?? [],
    identifiers: normalizedIdentifiers(op.identifiers ?? []),
    contexts: (op.contexts ?? []).flatMap((value) => ref(ctx, value) ?? []),
    degreeTotal: 0,
    archivedAt: null,
  };
}

const ids = (nodes: { id: string }[]) => [...new Set(nodes.map((n) => n.id))];

// Campos que o update trouxe (`null` limpa; ausente preserva).
function provided(op: Op, keys: string[]) {
  const values = op as unknown as Record<string, unknown>;
  return Object.fromEntries(
    keys
      .filter((key) => values[key] !== undefined)
      .map((key) => [key, values[key]]),
  );
}

// Update parcial: o que não veio fica como estava; lista enviada substitui.
function updateNode(ctx: Ctx, op: Op, index: number) {
  const node = mustFind(ctx.db.nodes, op, 'nodes');
  const merged = {
    startYear: op.startYear === undefined ? node.startYear : op.startYear,
    endYear: op.endYear === undefined ? node.endYear : op.endYear,
    identifiers: op.identifiers ?? node.identifiers,
  };
  const issues = nodeIssues(merged, `nodes.${index}.`);
  if (issues.length) throw validationFailure(issues);
  if (owners(ctx.db.nodes, merged.identifiers, node.id).length)
    throw duplicateFailure();
  Object.assign(
    node,
    provided(op, [
      'status',
      'label',
      'description',
      'aliases',
      'precision',
      'periodLabel',
      'startYear',
      'endYear',
    ]),
    { identifiers: normalizedIdentifiers(merged.identifiers) },
    op.contexts
      ? { contexts: op.contexts.flatMap((value) => ref(ctx, value) ?? []) }
      : {},
    { version: node.version + 1, updatedAt: ctx.now },
  );
  return settle(ctx, op, 'nodes', 'updated', node.id);
}

// Create que repete algo existente fica pendente com os candidatos; identificador
// vale antes do nome, como na API.
function duplicateOf(ctx: Ctx, node: Node) {
  const found = owners(ctx.db.nodes, node.identifiers);
  const [first] = found;
  if (first)
    return {
      reason: `Identificador já cadastrado (${first.identifier.scheme}:${first.identifier.value} → ponto ${first.node.id}); use {op:"reference", id}`,
      candidates: ids(found.map((o) => o.node)),
    };
  const same = homonyms(ctx.db.nodes, node);
  return same.length
    ? {
        reason: `Nome já existente (candidatos: ${ids(same).join(', ')}); selecione o ID explicitamente`,
        candidates: ids(same),
      }
    : null;
}

function runNode(ctx: Ctx, op: Op, index: number) {
  if (op.op === 'reference') return settle(ctx, op, 'nodes', 'reused', op.id);
  if (op.op === 'update') return updateNode(ctx, op, index);
  const node = newNode(ctx, op);
  const issues = nodeIssues(node, `nodes.${index}.`);
  if (issues.length) throw validationFailure(issues);
  const duplicate = duplicateOf(ctx, node);
  if (duplicate)
    return pend(ctx, op, 'nodes', duplicate.reason, duplicate.candidates);
  ctx.db.nodes.push(node);
  return settle(ctx, op, 'nodes', 'created', node.id);
}

// Mesma ordem de verificação da API: pontos ativos, depois a contextualização.
export function relationProblem(db: BatchDb, r: Relation): string | null {
  const source = db.nodes.find((n) => n.id === r.sourceId);
  const target = db.nodes.find((n) => n.id === r.targetId);
  if (!source || !target) return 'Referência de ponto inexistente';
  if (
    r.status === 'active' &&
    (source.status !== 'active' || target.status !== 'active')
  )
    return 'Relação ativa exige pontos ativos';
  if (
    r.type === 'contextualizes' &&
    (source.conceptScope !== 'contextual' || target.conceptScope !== 'broad')
  )
    return 'Origem contextual e destino amplo obrigatórios';
  return null;
}

export function hasActiveContextualization(db: BatchDb, node: Node): boolean {
  return db.relations.some((r) => {
    const target = db.nodes.find((n) => n.id === r.targetId);
    return (
      r.type === 'contextualizes' &&
      r.sourceId === node.id &&
      r.status === 'active' &&
      target?.conceptScope === 'broad' &&
      target.status === 'active'
    );
  });
}

function optionalFields(op: Op) {
  return {
    intensity: op.intensity ?? null,
    intensityReason: op.intensityReason ?? null,
    attributionText: op.attributionText ?? null,
    inferenceAuthor: op.inferenceAuthor ?? null,
    contested: op.contested ?? false,
    contestationNote: op.contestationNote ?? null,
  };
}

function evidenceOf(ctx: Ctx, op: Op): Evidence[] {
  return (op.evidence ?? []).map((e) => ({
    sourceKind: e.sourceKind,
    stance: e.stance,
    locator: e.locator,
    explanation: e.explanation,
    sourceId: ref(ctx, e.sourceId),
    excerpt: e.excerpt ?? null,
    conversationReference: e.conversationReference ?? null,
  }));
}

function newRelation(ctx: Ctx, op: Op): Relation {
  return {
    id: crypto.randomUUID(),
    version: 1,
    status: op.status ?? 'active',
    createdAt: ctx.now,
    updatedAt: ctx.now,
    sourceId: ref(ctx, op.source) ?? '',
    targetId: ref(ctx, op.target) ?? '',
    type: op.type,
    contextId: ref(ctx, op.contextId),
    claim: op.claim,
    justification: op.justification,
    evidenceStatus: op.evidenceStatus,
    attributionNodeId: ref(ctx, op.attributionNodeId),
    ...optionalFields(op),
    evidence: evidenceOf(ctx, op),
    archivedAt: null,
  };
}

function dependsOnPending(ctx: Ctx, op: Op) {
  return [op.source, op.target, op.contextId, op.attributionNodeId].some(
    (value) =>
      !!value &&
      'clientRef' in value &&
      ctx.items.get(value.clientRef)?.outcome === 'pending',
  );
}

function runRelation(ctx: Ctx, op: Op) {
  if (op.op === 'reference')
    return settle(ctx, op, 'relations', 'reused', op.id);
  if (dependsOnPending(ctx, op))
    return pend(ctx, op, 'relations', 'Dependência pendente');
  if (op.op === 'create') {
    const created = newRelation(ctx, op);
    const problem = relationProblem(ctx.db, created);
    if (problem) return pend(ctx, op, 'relations', problem);
    ctx.db.relations.push(created);
    return settle(ctx, op, 'relations', 'created', created.id);
  }
  const current = mustFind(ctx.db.relations, op, 'relations');
  const next: Relation = {
    ...current,
    ...(op.status ? { status: op.status } : {}),
    ...(op.claim ? { claim: op.claim } : {}),
    ...(op.justification ? { justification: op.justification } : {}),
  };
  const problem = relationProblem(ctx.db, next);
  if (problem) return pend(ctx, op, 'relations', problem);
  Object.assign(current, next, {
    version: current.version + 1,
    updatedAt: ctx.now,
  });
  return settle(ctx, op, 'relations', 'updated', current.id);
}

function pendNode(ctx: Ctx, item: ImportItem, node: Node) {
  node.status = 'pending';
  node.version += 1;
  item.outcome = 'pending';
  item.reason = CONTEXT_REQUIRED;
  for (const r of ctx.db.relations) {
    if (r.status !== 'active') continue;
    if (r.sourceId !== node.id && r.targetId !== node.id) continue;
    r.status = 'pending';
    r.version += 1;
    for (const other of ctx.items.values())
      if (other.entityId === r.id) {
        other.outcome = 'pending';
        other.reason = 'Conceito contextual pendente';
      }
  }
}

// Contexto e contextualização ativa: o que um conceito contextual ativo exige.
const complete = (db: BatchDb, node: Node) =>
  node.contexts.length > 0 && hasActiveContextualization(db, node);

const isActiveContextual = (node: Node | undefined): node is Node =>
  node?.kind === 'concept' &&
  node.conceptScope === 'contextual' &&
  node.status === 'active';

// Fim do lote: conceito contextual ativo sem contexto ou sem contextualização
// ativa volta a pendente, junto com as relações ativas dele.
function finalize(ctx: Ctx) {
  for (const item of ctx.items.values()) {
    const touched = item.outcome === 'created' || item.outcome === 'updated';
    if (item.entityType !== 'nodes' || !touched) continue;
    const node = ctx.db.nodes.find((n) => n.id === item.entityId);
    if (isActiveContextual(node) && !complete(ctx.db, node))
      pendNode(ctx, item, node);
  }
}

// Aplica o lote sobre `db` (o chamador passa uma cópia e só a mantém se não for
// simulação) e devolve o ImportResult.
export function applyBatch(db: BatchDb, batch: ImportBatch, now: string) {
  const ctx: Ctx = { db, now, ids: {}, items: new Map() };
  ((batch.nodes ?? []) as unknown as Op[]).forEach((op, index) =>
    runNode(ctx, op, index),
  );
  for (const op of (batch.relations ?? []) as unknown as Op[])
    runRelation(ctx, op);
  finalize(ctx);
  const items = [...ctx.items.values()];
  const count = (outcome: ImportItem['outcome']) =>
    items.filter((item) => item.outcome === outcome).length;
  const batchId = crypto.randomUUID();
  const result: ImportResult = {
    batchId,
    status: count('pending') ? 'committed_with_pending' : 'committed',
    created: count('created'),
    updated: count('updated'),
    reused: count('reused'),
    pending: count('pending'),
    discarded: count('discarded'),
    clientRefToId: ctx.ids,
    items,
    viewUrl: `http://localhost:5173/imports/${batchId}`,
    dryRun: batch.dryRun,
  };
  return result;
}

// Escritas pelo REST (POST/PATCH de ponto ou relação): a API recusa o que só o
// lote consegue gravar, e é isso que o editor contorna para conceitos contextuais.
export function restProblem(
  db: BatchDb,
  type: string,
  entity: Node | Relation,
): ApiError | null {
  if (type === 'nodes') {
    const node = entity as Node;
    return isActiveContextual(node) && !complete(db, node)
      ? apiFailure(422, 'CONTEXT_REQUIRED', CONTEXT_REQUIRED)
      : null;
  }
  if (type !== 'relations') return null;
  const message = relationProblem(db, entity as Relation);
  return message ? apiFailure(422, 'INACTIVE_ENDPOINT', message) : null;
}
