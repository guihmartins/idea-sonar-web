import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useServices } from '../app/services';
import type { SemanticResults } from '../api/domain';
import { SemanticFailure } from '../components/SemanticNote';
import { leadText } from '../components/semantic';
import { RecordItem } from './RecordItem';
import type { SearchFilters } from './searchFilters';

// A busca por significado devolve um top-k, sem cursor: 20 de início e, com
// "Mostrar mais", 50 (o máximo da API).
export const firstLimit = 20;
export const maxLimit = 50;
export const meaningHintText =
  'Escreva uma ideia ou um trecho: a busca compara o sentido do texto com o dos pontos.';

export function countMeaning(count: number): string {
  return count === 1
    ? '1 ponto, em ordem de semelhança'
    : `${count} pontos, em ordem de semelhança`;
}

type Query = UseQueryResult<SemanticResults>;

function useMeaning(filters: SearchFilters, limit: number): Query {
  const { api } = useServices();
  const q = filters.q ?? '';
  return useQuery({
    queryKey: [
      'semantic',
      q,
      filters.kind ?? '',
      filters.includePending ?? false,
      limit,
    ],
    queryFn: ({ signal }) =>
      api.semanticSearch(
        q,
        { kind: filters.kind, includePending: filters.includePending, limit },
        signal,
      ),
    // Sem texto não há requisição, só a dica. Ao pedir 50, os 20 ficam na tela.
    enabled: q !== '',
    placeholderData: keepPreviousData,
  });
}

// Dica, espera, falha (503 vira nota) ou "nada parecido".
function MeaningState({
  q,
  query,
  empty,
}: {
  q: string;
  query: Query;
  empty: boolean;
}) {
  if (q === '') return <p className="semantic-hint">{meaningHintText}</p>;
  if (query.error)
    return (
      <SemanticFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (query.isPending) return <p role="status">Buscando…</p>;
  return empty ? (
    <p className="empty">Nenhum ponto de sentido parecido com “{q}”.</p>
  ) : null;
}

// Resultados da busca por significado em Pontos. O componente é remontado a
// cada busca (`key`), o que devolve o limite a 20.
export function MeaningResults({ filters }: { filters: SearchFilters }) {
  const [limit, setLimit] = useState(firstLimit);
  const query = useMeaning(filters, limit);
  const items = query.data?.items ?? [];
  return (
    <>
      <p className="record-count" aria-live="polite">
        {query.isSuccess ? countMeaning(items.length) : ''}
      </p>
      <MeaningState
        q={filters.q ?? ''}
        query={query}
        empty={query.isSuccess && items.length === 0}
      />
      <div className="record-list">
        {items.map(({ node, score }) => (
          <RecordItem key={node.id} type="nodes" item={node} score={score} />
        ))}
      </div>
      {items.length === firstLimit && limit === firstLimit && (
        <button disabled={query.isFetching} onClick={() => setLimit(maxLimit)}>
          Mostrar mais
        </button>
      )}
      {items.length > 0 && <p className="semantic-hint">{leadText}</p>}
    </>
  );
}
