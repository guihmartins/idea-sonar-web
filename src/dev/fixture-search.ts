// EXCLUSIVAMENTE DEV/TEST. Busca das listas da API fictícia (contrato 1.2.0):
// texto sem acento nem caixa, DOI/URL exatos em fontes, e o cursor preso aos
// filtros da busca que o emitiu. Compartilhado por pontos, fontes e contextos.
import type { Context, Entity, Node, Source } from '../api/domain';
import {
  fold,
  nodeMatches,
  normalizeIdentifier,
  validationFailure,
} from './fixture-nodes';

// `exact`: o texto inteiro; senão, um trecho. Ambos sem acento nem caixa.
function textMatch(text: string, q: string, match: string | null): boolean {
  const name = fold(text);
  const wanted = fold(q);
  return match === 'exact' ? name === wanted : name.includes(wanted);
}

// Fonte: título e, para o endereço ou o DOI inteiros, o dono deles (em qualquer
// modo, como o identificador de um ponto).
export function sourceMatches(
  source: Source,
  q: string,
  match: string | null,
): boolean {
  if (!q) return true;
  const doi = source.doi && normalizeIdentifier('doi', source.doi);
  return (
    textMatch(source.title, q, match) ||
    (!!doi && doi === normalizeIdentifier('doi', q)) ||
    (!!source.canonicalUrl && source.canonicalUrl === q.trim())
  );
}

export function contextMatches(
  context: Context,
  q: string,
  match: string | null,
): boolean {
  return !q || textMatch(context.label, q, match);
}

// Só pontos, fontes e contextos têm `q`; relações e views ignoram o filtro.
export function textMatches(
  type: string,
  entity: Entity,
  params: URLSearchParams,
): boolean {
  const q = params.get('q') ?? '';
  const match = params.get('match');
  if (type === 'nodes') return nodeMatches(entity as Node, q, match);
  if (type === 'sources') return sourceMatches(entity as Source, q, match);
  if (type === 'contexts') return contextMatches(entity as Context, q, match);
  return true;
}

// Filtros que definem a busca: tudo menos o cursor e o limite, em ordem fixa.
export function listScope(params: URLSearchParams): string {
  const scope = new URLSearchParams(params);
  scope.delete('cursor');
  scope.delete('limit');
  scope.sort();
  return scope.toString();
}

// `deslocamento:escopo`; sem filtros o cursor é só o deslocamento.
export const cursorAt = (offset: number, scope: string) =>
  scope ? `${offset}:${scope}` : String(offset);

// Como a API: um cursor de outra busca é recusado, não reaproveitado.
export function cursorStart(cursor: string | null, scope: string): number {
  if (cursor === null) return 0;
  const cut = cursor.indexOf(':');
  const bound = cut < 0 ? '' : cursor.slice(cut + 1);
  if (bound !== scope)
    throw validationFailure([
      { path: 'cursor', message: 'Cursor de outra busca: recomece a lista' },
    ]);
  return Number(cut < 0 ? cursor : cursor.slice(0, cut));
}
