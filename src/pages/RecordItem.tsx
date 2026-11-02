import { Link } from 'react-router-dom';
import type { Entity, EntityType, Node } from '../api/domain';
import { editorialLabels } from '../components/Feedback';
import { entitySummary, entityTitle } from '../components/labels';
import { NodeIdentifiers } from '../components/NodeIdentifiers';
import { Score } from '../components/SemanticNote';

// Linha de registro das listas. `score` só vem da busca por significado e entra
// na última linha, a de metadado, depois do estado.
export function RecordItem({
  type,
  item,
  score,
}: {
  type: EntityType;
  item: Entity;
  score?: number;
}) {
  return (
    <article>
      <h2>{entityTitle(type, item)}</h2>
      <p>{entitySummary(type, item)}</p>
      {type === 'nodes' && (
        <NodeIdentifiers identifiers={(item as Node).identifiers} />
      )}
      <p>
        Estado: {editorialLabels[item.status]}
        {score !== undefined && (
          <>
            {' · '}
            <Score value={score} />
          </>
        )}
      </p>
      {type === 'views' ? (
        <Link to={`/map?view=${item.id}`}>Restaurar view</Link>
      ) : (
        <Link to={`/edit/${type}/${item.id}`}>Ver e editar</Link>
      )}
    </article>
  );
}
