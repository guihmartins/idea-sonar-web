import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { ListFilters } from '../api/adapter';
import { kindLabels } from '../components/labels';
import { YearField } from '../components/YearField';
import {
  draftFromFilters,
  exactLabel,
  filtersFromDraft,
  maxQueryLength,
  paramsFromFilters,
  searchHints,
  searchLabels,
} from './searchFilters';
import type { SearchableType, SearchDraft } from './searchFilters';

type Change = <K extends keyof SearchDraft>(
  key: K,
  value: SearchDraft[K],
) => void;

// Busca das listas. Os filtros aplicados vêm da URL (a fonte da verdade); o
// formulário edita um rascunho e só "Buscar" ou Enter o aplicam, para a URL e a
// requisição mudarem uma vez por busca.
export function RecordSearch({
  type,
  filters,
  onSearch,
}: {
  type: SearchableType;
  filters: ListFilters;
  onSearch: (filters: ListFilters) => void;
}) {
  const applied = paramsFromFilters(filters).toString();
  const [seen, setSeen] = useState(applied);
  // A URL que a própria busca acabou de pedir, até a tela renderizar com ela.
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => draftFromFilters(filters));
  const [error, setError] = useState('');
  // Voltar/avançar muda a URL por fora: o rascunho acompanha, sem remontar o
  // formulário (remontar tiraria o foco do campo). A URL da própria busca não
  // conta: o que o usuário digitar até ela renderizar não pode ser apagado.
  if (seen !== applied) {
    setSeen(applied);
    setPending(null);
    if (pending !== applied) {
      setDraft(draftFromFilters(filters));
      setError('');
    }
  }
  const change: Change = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  function apply(next: ListFilters) {
    setPending(paramsFromFilters(next).toString());
    setError('');
    setDraft(draftFromFilters(next));
    onSearch(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      apply(filtersFromDraft(type, draft));
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  return (
    <form
      className="record-search"
      role="search"
      aria-label={searchLabels[type]}
      noValidate
      onSubmit={submit}
    >
      <div className="record-search-main">
        <label className="record-search-term">
          Buscar
          <input
            type="search"
            value={draft.q}
            maxLength={maxQueryLength}
            placeholder={searchHints[type]}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => change('q', e.target.value)}
          />
        </label>
        <div className="actions">
          <button type="submit">Buscar</button>
          <button type="button" onClick={() => apply({})}>
            Limpar
          </button>
        </div>
      </div>
      <div className="record-search-options">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.exact}
            onChange={(e) => change('exact', e.target.checked)}
          />
          {exactLabel}
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.pending}
            onChange={(e) => change('pending', e.target.checked)}
          />
          Incluir pendentes
        </label>
      </div>
      {type === 'nodes' && (
        <NodeFilters draft={draft} change={change} error={error} />
      )}
    </form>
  );
}

// Tipo e período valem só para pontos (a API os ignora nas outras listas).
function NodeFilters({
  draft,
  change,
  error,
}: {
  draft: SearchDraft;
  change: Change;
  error: string;
}) {
  const errorId = useId();
  const describedBy = error ? errorId : undefined;
  return (
    <fieldset>
      <legend>Tipo e período</legend>
      <div className="record-search-period">
        <label>
          Tipo
          <select
            value={draft.kind}
            onChange={(e) =>
              change('kind', e.target.value as SearchDraft['kind'])
            }
          >
            <option value="">Todos</option>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <YearField
            label="Ano inicial"
            eraLabel="Era do início"
            year={draft.start}
            era={draft.startEra}
            onYear={(value) => change('start', value)}
            onEra={(value) => change('startEra', value)}
            invalid={!!error}
            describedBy={describedBy}
          />
        </div>
        <div className="form-grid">
          <YearField
            label="Ano final"
            eraLabel="Era do fim"
            year={draft.end}
            era={draft.endEra}
            onYear={(value) => change('end', value)}
            onEra={(value) => change('endEra', value)}
            invalid={!!error}
            describedBy={describedBy}
          />
        </div>
      </div>
      <div className="record-search-options">
        <label className="check">
          <input
            type="checkbox"
            checked={draft.unknownPeriod}
            onChange={(e) => change('unknownPeriod', e.target.checked)}
          />
          Incluir período desconhecido
        </label>
      </div>
      <p className="muted">
        Os anos filtram pelo período do próprio ponto: de 100001 a.C. a 3000
        d.C. Deixe vazio para não filtrar.
      </p>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
