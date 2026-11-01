import type { Node } from '../api/domain';

type Identifier = Node['identifiers'][number];

// O identificador chega normalizado da API (QID em maiúsculas, DOI em minúsculas,
// ISBN sem hífen). Open Library: o sufixo A/W/M do id diz se é autor, obra ou edição.
const openLibraryKinds = { A: 'authors', W: 'works', M: 'books' } as const;

const encodePath = (value: string) =>
  value.split('/').map(encodeURIComponent).join('/');

// Endereço do registro de cada esquema; ISBN não tem página única e fica em texto.
export function identifierUrl({ scheme, value }: Identifier): string | null {
  switch (scheme) {
    case 'wikidata':
      return `https://www.wikidata.org/wiki/${encodeURIComponent(value)}`;
    case 'viaf':
      return `https://viaf.org/viaf/${encodeURIComponent(value)}`;
    case 'isni':
      return `https://isni.org/isni/${encodeURIComponent(value)}`;
    case 'doi':
      return `https://doi.org/${encodePath(value)}`;
    case 'openlibrary': {
      const kind = openLibraryKinds[
        value.slice(-1) as keyof typeof openLibraryKinds
      ] as string | undefined;
      return kind
        ? `https://openlibrary.org/${kind}/${encodeURIComponent(value)}`
        : null;
    }
    default:
      return null;
  }
}
