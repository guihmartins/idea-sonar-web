// EXCLUSIVAMENTE DEV/TEST. Lote de importação da API fictícia: reproduz, em
// memória, as regras de POST /imports que o editor usa para conceitos
// contextuais (idea-sonar-api, contrato 1.1.0):
// - update é parcial; campo omitido é preservado e lista enviada substitui;
// - o escopo contextual só é conferido no fim do lote (ponto e relação nascem
//   na mesma transação); sem contexto ou sem `contextualizes` ativa para um
//   conceito amplo ativo, o ponto volta a `pending` com as relações ativas;
// - relação ativa exige pontos ativos; nome repetido vira pendência.
import { ApiError } from '../api/client';
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
  aliases?: Node['aliases'];
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

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

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
  });
}

function pend(ctx: Ctx, op: Op, entityType: string, reason: string) {
  delete ctx.ids[op.clientRef];
  ctx.items.set(op.clientRef, {
    clientRef: op.clientRef,
    entityType,
    entityId: null,
    outcome: 'pending',
    reason,
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
    aliases: op.aliases ?? [],
    contexts: (op.contexts ?? []).flatMap((value) => ref(ctx, value) ?? []),
    degreeTotal: 0,
    archivedAt: null,
  };
}

function runNode(ctx: Ctx, op: Op) {
  if (op.op === 'reference') return settle(ctx, op, 'nodes', 'reused', op.id);
  if (op.op === 'update') {
    const node = mustFind(ctx.db.nodes, op, 'nodes');
    const { status, label, description, aliases } = op;
    Object.assign(node, {
      ...(status ? { status } : {}),
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(aliases ? { aliases } : {}),
      ...(op.contexts
        ? { contexts: op.contexts.flatMap((value) => ref(ctx, value) ?? []) }
        : {}),
      version: node.version + 1,
      updatedAt: ctx.now,
    });
    return settle(ctx, op, 'nodes', 'updated', node.id);
  }
  const clash = ctx.db.nodes.some(
    (n) =>
      n.status !== 'archived' &&
      n.kind === op.kind &&
      normalize(n.label) === normalize(op.label),
  );
  if (clash)
    return pend(
      ctx,
      op,
      'nodes',
      'Nome já existente; selecionar ID explicitamente',
    );
  const node = newNode(ctx, op);
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
  for (const op of (batch.nodes ?? []) as unknown as Op[]) runNode(ctx, op);
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
