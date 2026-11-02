import { useQuery } from '@tanstack/react-query';
import { useServices } from '../app/services';
import type { Node } from '../api/domain';
import { Failure } from '../components/Feedback';
import { kindLabels } from '../components/labels';
import { SemanticNote, Score } from '../components/SemanticNote';
import { isSemanticUnavailable, panelLeadText } from '../components/semantic';

export const similarLimit = 5;

// Seção do painel do ponto: outros pontos de sentido parecido, como pista. Cada
// linha traz o ponto para o mapa do mesmo jeito que o resultado da busca do
// mapa (`onPick`); nada é escrito por semelhança.
export function SimilarPoints({
  id,
  onPick,
}: {
  id: string;
  onPick: (node: Node) => void;
}) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['similar', id, similarLimit],
    queryFn: ({ signal }) => api.similarNodes(id, similarLimit, signal),
  });
  return (
    <>
      <h3>Pontos parecidos</h3>
      {query.isPending && <p role="status">Procurando pontos parecidos…</p>}
      {isSemanticUnavailable(query.error) && <SemanticNote />}
      {query.error && !isSemanticUnavailable(query.error) && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data && query.data.items.length === 0 && (
        <p>Nenhum ponto parecido.</p>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul
            className="relation-list similar-list"
            aria-label="Pontos parecidos com este"
          >
            {query.data.items.map(({ node, score }) => (
              <li key={node.id}>
                <button type="button" onClick={() => onPick(node)}>
                  <strong>{node.label}</strong>{' '}
                  <span className="similar-kind">{kindLabels[node.kind]}</span>{' '}
                  <Score value={score} />
                </button>
              </li>
            ))}
          </ul>
          <p className="semantic-hint">{panelLeadText}</p>
        </>
      )}
    </>
  );
}
