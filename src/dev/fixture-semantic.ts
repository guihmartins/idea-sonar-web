// EXCLUSIVAMENTE DEV/TEST. Busca por significado da API fictícia (contrato
// 1.3.0): busca, pontos parecidos, sugestões de paralelo, dispensa de par e o
// campo `similar` do lote. Não há modelo aqui: a semelhança é o índice de
// Jaccard entre as palavras (sem acento nem caixa, com 3 letras ou mais) de
// "nome, tipo, outros nomes e descrição". Ordena de forma previsível, mas os
// números não imitam os do modelo real (0 a 1, comprimidos).
import { ApiError } from '../api/client';
import { kindSchema } from '../api/domain';
import type {
  ImportItem,
  Node,
  ParallelDismissal,
  ParallelSuggestions,
  Relation,
  SemanticResults,
} from '../api/domain';
import { fold, validationFailure } from './fixture-nodes';

export const FIXTURE_MODEL = 'fixture-jaccard';
// Limiar das fixtures no lugar dos 0,91 do modelo real: acima do que os textos
// de demonstração (quase iguais entre si) dão uns aos outros.
export const FIXTURE_MIN = 0.78;

const words = (text: string) =>
  new Set(
    fold(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3),
  );
const textOf = (node: Node) =>
  [
    node.label,
    node.kind,
    ...node.aliases.map((alias) => alias.alias),
    node.description,
  ].join(' ');

export function jaccard(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((word) => b.has(word)).length;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : Math.round((shared / union) * 1000) / 1000;
}
const scoreOf = (wanted: Set<string>, node: Node) =>
  jaccard(wanted, words(textOf(node)));

// Melhor primeiro; o empate cai no nome. Sem palavra em comum não há pista.
function top<T extends { score: number }>(
  scored: T[],
  limit: number,
  label: (item: T) => string,
  min = 0,
): T[] {
  return scored
    .filter((item) => item.score > 0 && item.score >= min)
    .sort((x, y) => y.score - x.score || label(x).localeCompare(label(y)))
    .slice(0, limit);
}

function limitOf(params: URLSearchParams): number {
  const raw = params.get('limit');
  const limit = raw === null ? 10 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw validationFailure([
      { path: 'limit', message: 'Informe um inteiro de 1 a 50' },
    ]);
  return limit;
}

export function semanticSearch(
  nodes: Node[],
  params: URLSearchParams,
): SemanticResults {
  const q = params.get('q') ?? '';
  const kind = params.get('kind');
  if (q.length < 1 || q.length > 500)
    throw validationFailure([
      { path: 'q', message: 'Informe de 1 a 500 caracteres' },
    ]);
  if (kind !== null && !kindSchema.safeParse(kind).success)
    throw validationFailure([{ path: 'kind', message: 'Tipo inválido' }]);
  const pending = params.get('includePending') === 'true';
  const wanted = words(q);
  const scored = nodes
    .filter(
      (node) =>
        (node.status === 'active' || (pending && node.status === 'pending')) &&
        (kind === null || node.kind === kind),
    )
    .map((node) => ({ node, score: scoreOf(wanted, node) }));
  return {
    model: FIXTURE_MODEL,
    items: top(scored, limitOf(params), (item) => item.node.label),
  };
}

// Sem o próprio ponto e só entre pontos ativos, como a API.
export function similarNodes(
  nodes: Node[],
  id: string,
  params: URLSearchParams,
): SemanticResults {
  const self = nodes.find((node) => node.id === id);
  if (!self) throw new ApiError(404, 'Registro não encontrado.');
  const wanted = words(textOf(self));
  const scored = nodes
    .filter((node) => node.id !== id && node.status === 'active')
    .map((node) => ({ node, score: scoreOf(wanted, node) }));
  return {
    model: FIXTURE_MODEL,
    items: top(scored, limitOf(params), (item) => item.node.label),
  };
}

// O par fica na ordem em que a API o guarda: ids em minúsculas, o menor primeiro.
export function orderedPair(x: string, y: string): [string, string] {
  const [a = '', b = ''] = [x.toLowerCase(), y.toLowerCase()].sort();
  return [a, b];
}
const pairKey = (x: string, y: string) => orderedPair(x, y).join('|');

function minScoreOf(params: URLSearchParams): number {
  const raw = params.get('minScore');
  const min = raw === null || raw === '' ? FIXTURE_MIN : Number(raw);
  if (!(min >= 0 && min <= 1))
    throw validationFailure([
      { path: 'minScore', message: 'Informe um número de 0 a 1' },
    ]);
  return min;
}

// Pares de pontos ativos sem relação entre si (nos dois sentidos, qualquer
// estado menos arquivada) e ainda não dispensados.
export function parallelSuggestions(
  nodes: Node[],
  relations: Relation[],
  dismissed: Map<string, ParallelDismissal>,
  params: URLSearchParams,
): ParallelSuggestions {
  const min = minScoreOf(params);
  const limit = limitOf(params);
  const related = new Set(
    relations
      .filter((relation) => relation.status !== 'archived')
      .map((relation) => pairKey(relation.sourceId, relation.targetId)),
  );
  const active = nodes
    .filter((node) => node.status === 'active')
    .sort((x, y) => x.id.toLowerCase().localeCompare(y.id.toLowerCase()));
  const pairs = active.flatMap((a, index) =>
    active.slice(index + 1).flatMap((b) => {
      const key = pairKey(a.id, b.id);
      const score = jaccard(words(textOf(a)), words(textOf(b)));
      return related.has(key) || dismissed.has(key) ? [] : [{ a, b, score }];
    }),
  );
  return {
    model: FIXTURE_MODEL,
    items: top(pairs, limit, (pair) => pair.a.label, min),
  };
}

// Dispensar é idempotente por par: repetir devolve o primeiro registro (e o
// primeiro motivo). `a` e `b` voltam na ordem guardada.
export function dismissParallel(
  nodes: Node[],
  dismissed: Map<string, ParallelDismissal>,
  body: { a: string; b: string; reason: string },
  now: string,
): ParallelDismissal {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 1 || reason.length > 2000)
    throw validationFailure([
      { path: 'reason', message: 'Informe de 1 a 2000 caracteres' },
    ]);
  const [a, b] = orderedPair(String(body.a), String(body.b));
  if (a === b)
    throw validationFailure([
      { path: 'b', message: 'Os pontos devem ser diferentes' },
    ]);
  for (const id of [a, b])
    if (!nodes.some((node) => node.id.toLowerCase() === id))
      throw new ApiError(404, 'Registro não encontrado.');
  const existing = dismissed.get(`${a}|${b}`);
  if (existing) return existing;
  const record = {
    id: crypto.randomUUID(),
    a,
    b,
    kind: 'parallel',
    reason,
    createdAt: now,
  };
  dismissed.set(`${a}|${b}`, record);
  return record;
}

// `similar` dos pontos criados pelo lote: até 3 pontos ativos acima do limiar,
// fora os do próprio lote. Item que não criou ponto fica como está (sem o campo).
export function withSimilar(items: ImportItem[], nodes: Node[]): ImportItem[] {
  const own = new Set(
    items.flatMap((item) =>
      item.entityType === 'nodes' && item.entityId ? [item.entityId] : [],
    ),
  );
  return items.map((item) => {
    const created =
      item.outcome === 'created' && item.entityType === 'nodes'
        ? nodes.find((node) => node.id === item.entityId)
        : undefined;
    if (!created) return item;
    const wanted = words(textOf(created));
    const scored = nodes
      .filter((node) => node.status === 'active' && !own.has(node.id))
      .map((node) => ({ node, score: scoreOf(wanted, node) }));
    return {
      ...item,
      similar: top(scored, 3, (entry) => entry.node.label, FIXTURE_MIN).map(
        ({ node, score }) => ({ id: node.id, label: node.label, score }),
      ),
    };
  });
}
