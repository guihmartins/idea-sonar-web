import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/services';
import type { Kind } from '../../api/domain';
import { kindLabels } from '../../components/labels';
import { Score } from '../../components/SemanticNote';
import { parseAliases } from './payload';
import { useDebounced } from './pickers';

export const hintDelay = 600;
export const hintLimit = 3;
export const hintTitle = 'Parecido com pontos já cadastrados';
export const hintLeadText =
  'Aviso, não bloqueio: confira se não é o mesmo ponto antes de salvar.';
// O `q` da API vai até 500 caracteres.
const maxQuery = 500;
// O tipo no texto do ponto, como a API o escreve (minúsculas, em português).
const kindWords: Record<Kind, string> = {
  person: 'pessoa',
  tradition: 'tradição',
  concept: 'conceito',
  work: 'obra',
  figure: 'figura',
};

// O texto que o ponto novo teria, no formato do texto de um ponto na API
// (`nome · tipo · outros nomes · descrição`, partes vazias fora), para a busca
// `mode=duplicates`. Só vale com nome e descrição; sem os dois não há consulta.
export function hintQuery(point: {
  label: string;
  kind: string;
  aliases: string;
  description: string;
}): string {
  const label = point.label.trim();
  const description = point.description.trim();
  if (!label || !description) return '';
  const aliases = parseAliases(point.aliases)
    .map((entry) => entry.alias)
    .join(', ');
  const kind = kindWords[point.kind as Kind] ?? '';
  return [label, kind, aliases, description]
    .filter(Boolean)
    .join(' · ')
    .slice(0, maxQuery);
}

// Aviso no cadastro de um ponto novo: pontos que já existem e passam do limiar de
// duplicata da API (o mesmo do aviso do lote). Não bloqueia nem muda o salvar; se
// nada passa do limiar, a busca está indisponível (503) ou falha, não aparece.
// Os links abrem em outra aba para o rascunho não se perder.
export function SimilarHint({
  label,
  kind,
  aliases,
  description,
}: {
  label: string;
  kind: string;
  aliases: string;
  description: string;
}) {
  const { api } = useServices();
  const text = hintQuery({ label, kind, aliases, description });
  const q = useDebounced(text, hintDelay);
  const query = useQuery({
    queryKey: ['similar-hint', q],
    queryFn: ({ signal }) =>
      api.semanticSearch(
        q,
        { mode: 'duplicates', includePending: true, limit: hintLimit },
        signal,
      ),
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
                <Link
                  to={`/edit/nodes/${node.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${node.label} (abre em nova aba)`}
                >
                  {node.label} <span aria-hidden="true">↗</span>
                </Link>{' '}
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
