import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/services';
import { kindLabels } from '../../components/labels';
import { Score } from '../../components/SemanticNote';
import { useDebounced } from './pickers';

export const hintDelay = 600;
export const hintLimit = 3;
export const hintTitle = 'Confira antes de criar: pontos com sentido parecido';
export const hintLeadText =
  'Pistas pelo sentido do texto; semelhança não é identidade. Salvar continua como está.';
// O `q` da API vai até 500 caracteres.
const maxQuery = 500;

// O texto que a API compara: nome e descrição, só quando os dois existem.
export function hintQuery(label: string, description: string): string {
  const name = label.trim();
  const text = description.trim();
  return name && text ? `${name} · ${text}`.slice(0, maxQuery) : '';
}

// Dica no cadastro de um ponto novo: pontos que já existem e leem parecido com o
// que está sendo escrito. Não bloqueia nem muda o salvar; se a busca estiver
// indisponível (503) ou falhar, o bloco simplesmente não aparece.
export function SimilarHint({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const { api } = useServices();
  const text = hintQuery(label, description);
  const q = useDebounced(text, hintDelay);
  const query = useQuery({
    queryKey: ['similar-hint', q],
    queryFn: ({ signal }) =>
      api.semanticSearch(q, { includePending: true, limit: hintLimit }, signal),
    enabled: q !== '',
  });
  const items = query.data?.items ?? [];
  const visible = text !== '' && !query.error && items.length > 0;
  // O contêiner fica sempre na página: o leitor de tela só anuncia o que muda
  // dentro de uma região viva que já existia.
  return (
    <div className="similar-hint" aria-live="polite">
      {visible && (
        <>
          <h2>{hintTitle}</h2>
          <ul>
            {items.map(({ node, score }) => (
              <li key={node.id}>
                <Link to={`/edit/nodes/${node.id}`}>{node.label}</Link>{' '}
                <span className="similar-kind">{kindLabels[node.kind]}</span>{' '}
                <Score value={score} />
              </li>
            ))}
          </ul>
          <p className="semantic-hint">{hintLeadText}</p>
        </>
      )}
    </div>
  );
}
