import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useServices } from '../app/services';
import type { Node, ParallelSuggestions } from '../api/domain';
import { kindLabels } from '../components/labels';
import { formatPeriod, hasPeriod } from '../components/period';
import { SemanticFailure, Score } from '../components/SemanticNote';
import { parallelEditorPath } from './editor/prefill';

export const firstLimit = 20;
export const maxLimit = 50;
export const emptyText =
  'Nenhuma sugestão agora. Elas aparecem quando há pontos com textos parecidos e sem relação entre si.';

export const countPairs = (count: number) =>
  count === 1 ? '1 par sugerido' : `${count} pares sugeridos`;

interface Pair {
  a: Node;
  b: Node;
  score: number;
}
const pairKey = (pair: Pair) => `${pair.a.id}|${pair.b.id}`;

// Sugestões de paralelo: pares de pontos ativos que se leem parecido e não têm
// relação. Semelhança é pista; nada é escrito sozinho. "Registrar paralelo" abre
// o editor de relação já preenchido; "Dispensar" guarda o motivo e o par some.
export function SuggestionsPage() {
  const { api } = useServices();
  const cache = useQueryClient();
  const [limit, setLimit] = useState(firstLimit);
  const [dismissing, setDismissing] = useState('');
  const [message, setMessage] = useState('');
  const query = useQuery({
    queryKey: ['suggestions', 'parallels', limit],
    queryFn: ({ signal }) => api.parallels({ limit }, signal),
    placeholderData: keepPreviousData,
  });
  const pairs = query.data?.items ?? [];
  async function dismissed(pair: Pair) {
    setDismissing('');
    setMessage(
      `Par dispensado: “${pair.a.label}” e “${pair.b.label}” não serão sugeridos de novo.`,
    );
    await cache.invalidateQueries({ queryKey: ['suggestions'] });
  }
  return (
    <section>
      <div className="page-heading">
        <h1>Sugestões</h1>
      </div>
      <p>
        Pares de pontos cujos textos se parecem e que ainda não têm relação
        entre si. Semelhança não prova influência: um paralelo só vira relação
        se você o registrar, como inferência, com autoria e justificativa.
      </p>
      <p className="record-count" aria-live="polite">
        {query.isSuccess ? countPairs(pairs.length) : ''}
      </p>
      {message && (
        <p role="status" className="status">
          {message}
        </p>
      )}
      <SuggestionsState query={query} />
      <div className="record-list suggestion-list">
        {pairs.map((pair) => (
          <PairRow
            key={pairKey(pair)}
            pair={pair}
            dismissing={dismissing === pairKey(pair)}
            onDismiss={() => setDismissing(pairKey(pair))}
            onCancel={() => setDismissing('')}
            onDone={() => void dismissed(pair)}
          />
        ))}
      </div>
      {pairs.length === firstLimit && limit === firstLimit && (
        <button disabled={query.isFetching} onClick={() => setLimit(maxLimit)}>
          Mostrar mais
        </button>
      )}
    </section>
  );
}

// Espera, falha (503 vira nota, sem "tentar novamente") ou lista vazia.
function SuggestionsState({
  query,
}: {
  query: UseQueryResult<ParallelSuggestions>;
}) {
  if (query.error)
    return (
      <SemanticFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (query.isPending) return <p role="status">Carregando sugestões…</p>;
  if (query.data?.items.length === 0)
    return <p className="empty">{emptyText}</p>;
  return null;
}

function PairPoint({ node }: { node: Node }) {
  const meta = [
    kindLabels[node.kind],
    hasPeriod(node) ? formatPeriod(node) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="pair-point">
      <h2>
        <Link to={`/edit/nodes/${node.id}`}>{node.label}</Link>
      </h2>
      <p className="pair-meta">{meta}</p>
      <p className="pair-description">{node.description}</p>
    </div>
  );
}

function PairRow({
  pair,
  dismissing,
  onDismiss,
  onCancel,
  onDone,
}: {
  pair: Pair;
  dismissing: boolean;
  onDismiss: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <article>
      <div className="pair-points">
        <PairPoint node={pair.a} />
        <PairPoint node={pair.b} />
      </div>
      <p className="pair-score">
        <Score value={pair.score} />
      </p>
      <div className="actions">
        <Link className="button" to={parallelEditorPath(pair.a.id, pair.b.id)}>
          Registrar paralelo
        </Link>
        <button type="button" aria-expanded={dismissing} onClick={onDismiss}>
          Dispensar
        </button>
      </div>
      {dismissing && (
        <DismissForm pair={pair} onCancel={onCancel} onDone={onDone} />
      )}
    </article>
  );
}

// Mesmo desenho do motivo para desfazer uma importação: o motivo é obrigatório
// porque a API o exige e o guarda com a dispensa.
function DismissForm({
  pair,
  onCancel,
  onDone,
}: {
  pair: Pair;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { api } = useServices();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError(new Error('Informe o motivo para dispensar o par.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.dismissParallel(pair.a.id, pair.b.id, reason.trim());
      onDone();
    } catch (failure) {
      setError(failure);
      setBusy(false);
    }
  }
  return (
    <form
      className="confirmation"
      role="group"
      aria-label={`Dispensar ${pair.a.label} e ${pair.b.label}`}
      onSubmit={(event) => void submit(event)}
    >
      <p>O par deixa de ser sugerido. O motivo fica guardado com a dispensa.</p>
      <label>
        Motivo para dispensar
        <textarea
          required
          autoFocus
          value={reason}
          maxLength={2000}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error !== null && <SemanticFailure error={error} />}
      <button disabled={busy}>Dispensar par</button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}
