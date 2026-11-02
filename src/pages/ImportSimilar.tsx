import { Link } from 'react-router-dom';
import type { ImportItem } from '../api/domain';
import { Score } from '../components/SemanticNote';
import { warningText } from '../components/semantic';

// Aviso de ponto parecido num item criado pelo lote: pontos que já existiam e
// leem parecido (até 3). É um aviso, não um desfecho: o ponto foi criado do
// mesmo jeito. Sem `similar` (busca desligada) ou com a lista vazia, nada aparece.
export function ImportSimilar({ item }: { item: ImportItem }) {
  if (!item.similar || item.similar.length === 0) return null;
  return (
    <div className="similar-warning">
      <p>Parecido com:</p>
      <ul
        className="candidate-links"
        aria-label={`Parecidos com ${item.clientRef}`}
      >
        {item.similar.map((point) => (
          <li key={point.id}>
            <Link to={`/edit/nodes/${point.id}`}>{point.label}</Link>{' '}
            <Score value={point.score} />
          </li>
        ))}
      </ul>
      <p className="semantic-hint">{warningText}</p>
    </div>
  );
}
