// EXCLUSIVAMENTE DEV/TEST. Regras de ponto do modelo de dados v2 da API
// fictícia (idea-sonar-api, contrato 1.2.0): identificadores normalizados e
// únicos, período e candidatos de duplicidade. Compartilhado pelo REST e pelo lote.
import { ApiError } from '../api/client';
import type { Node } from '../api/domain';

type Identifier = Node['identifiers'][number];
type Scheme = Identifier['scheme'];
export interface Issue {
  path: string;
  message: string;
}

const noSpaces = (value: string) => value.replace(/\s+/g, '');
const registry = (host: string) =>
  new RegExp(String.raw`^https?://(?:www\.)?` + host, 'i');
const normalizers: Record<Scheme, (value: string) => string> = {
  wikidata: (value) =>
    value
      .replace(registry(String.raw`wikidata\.org/(?:wiki|entity)/`), '')
      .toUpperCase(),
  viaf: (value) =>
    value
      .replace(registry(String.raw`viaf\.org/viaf/`), '')
      .replace(/\/+$/, ''),
  isni: (value) => noSpaces(value).toUpperCase(),
  isbn: (value) => value.replace(/[-\s]/g, '').toUpperCase(),
  doi: (value) =>
    value
      .toLowerCase()
      .replace(/^(?:https?:\/\/(?:www\.)?(?:dx\.)?doi\.org\/|doi:)/, ''),
  openlibrary: (value) =>
    (
      value.match(
        registry(
          String.raw`openlibrary\.org/(?:works|authors|books)/([^/?#]+)(?:/[^?#]*)?$`,
        ),
      )?.[1] ?? value
    ).toUpperCase(),
};
const forms: Record<Scheme, RegExp> = {
  wikidata: /^Q[1-9]\d*$/,
  viaf: /^\d+$/,
  isni: /^\d{15}[\dX]$/,
  isbn: /^(?:\d{9}[\dX]|97[89]\d{10})$/,
  doi: /^10\.\d{4,9}\/\S+$/,
  openlibrary: /^OL\d+[AMW]$/,
};
export const normalizeIdentifier = (scheme: Scheme, value: string) =>
  normalizers[scheme](value.trim());
const key = ({ scheme, value }: Identifier) => `${scheme}|${value}`;

// Guardado normalizado e devolvido ordenado por esquema e valor, como a API.
export function normalizedIdentifiers(list: Identifier[]): Identifier[] {
  return list
    .map(({ scheme, value }) => ({
      scheme,
      value: normalizeIdentifier(scheme, value),
    }))
    .sort((a, b) => key(a).localeCompare(key(b)));
}

export function validationFailure(issues: Issue[]) {
  return new ApiError(400, 'Dados inválidos', {
    code: 'VALIDATION_ERROR',
    message: 'Dados inválidos',
    details: issues,
    requestId: 'fixture',
  });
}

// Mesmas regras de validação do ponto, com o caminho a partir de `prefix`
// (`nodes.2.` dentro de um lote, vazio no REST).
export function nodeIssues(
  node: Pick<Node, 'startYear' | 'endYear' | 'identifiers'>,
  prefix = '',
): Issue[] {
  const issues: Issue[] = [];
  const { startYear, endYear } = node;
  if (startYear !== null && endYear !== null && startYear > endYear)
    issues.push({
      path: `${prefix}startYear`,
      message: 'startYear deve ser <= endYear',
    });
  const keys: string[] = [];
  node.identifiers.forEach(({ scheme, value }, index) => {
    const normalized = normalizeIdentifier(scheme, value);
    if (forms[scheme].test(normalized)) keys.push(`${scheme}|${normalized}`);
    else
      issues.push({
        path: `${prefix}identifiers.${index}.value`,
        message: `Identificador inválido para ${scheme}`,
      });
  });
  if (new Set(keys).size !== keys.length)
    issues.push({
      path: `${prefix}identifiers`,
      message: 'Identificadores duplicados',
    });
  return issues;
}

// Pontos de qualquer estado que já têm o identificador (arquivado continua dono).
export function owners(
  nodes: Node[],
  identifiers: Identifier[],
  exceptId = '',
): { identifier: Identifier; node: Node }[] {
  return normalizedIdentifiers(identifiers).flatMap((identifier) => {
    const node = nodes.find(
      (n) =>
        n.id !== exceptId &&
        n.identifiers.some((i) => key(i) === key(identifier)),
    );
    return node ? [{ identifier, node }] : [];
  });
}

export function duplicateFailure() {
  // Como a API: mensagem genérica no envelope e a específica no campo.
  return new ApiError(409, 'Registro duplicado', {
    code: 'DUPLICATE',
    message: 'Registro duplicado',
    details: [
      {
        path: 'identifiers',
        message: 'Identificador já cadastrado em outro ponto',
      },
    ],
    requestId: 'fixture',
  });
}

export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
export const names = (node: Pick<Node, 'label' | 'aliases'>) => [
  fold(node.label),
  ...node.aliases.map((a) => fold(a.alias)),
];

// Pontos não arquivados do mesmo tipo com o mesmo nome ou alias.
export function homonyms(
  nodes: Node[],
  node: Pick<Node, 'kind' | 'label' | 'aliases'>,
): Node[] {
  const wanted = new Set(names(node));
  return nodes.filter(
    (n) =>
      n.status !== 'archived' &&
      n.kind === node.kind &&
      names(n).some((name) => wanted.has(name)),
  );
}

// Busca de ponto por `q`: contém (nome ou alias) ou, em `exact`, nome/alias
// inteiro; um `q` que seja identificador válido encontra o dono dele.
export function nodeMatches(
  node: Node,
  q: string,
  match: string | null,
): boolean {
  if (!q) return true;
  const wanted = fold(q);
  const textHit = names(node).some((name) =>
    match === 'exact' ? name === wanted : name.includes(wanted),
  );
  const idHit = node.identifiers.some(
    ({ scheme, value }) =>
      normalizeIdentifier(scheme, q) === value && forms[scheme].test(value),
  );
  return textHit || idHit;
}
