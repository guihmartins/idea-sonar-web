import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { kindLabels } from '../components/labels';
import { YearField } from '../components/YearField';
import {
  draftFromFilters,
  exactLabel,
  filtersFromDraft,
  maxMeaningLength,
  maxQueryLength,
  meaningHint,
  meaningMode,
  paramsFromFilters,
  searchHints,
  searchLabels,
} from './searchFilters';
import type {
  SearchableType,
  SearchDraft,
  SearchFilters,
} from './searchFilters';

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
  filters: SearchFilters;
  onSearch: (filters: SearchFilters) => void;
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
  function apply(next: SearchFilters) {
    setPending(paramsFromFilters(next).toString());
    setError('');
    setDraft(draftFromFilters(next));
    onSearch(next);
  }
  function applyDraft(next: SearchDraft) {
    try {
      apply(filtersFromDraft(type, next));
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    applyDraft(draft);
  }
  // Só pontos têm modo: nas outras listas o rascunho nunca nasce em Significado.
  const meaning = draft.meaning;
  return (
    <form
      className="record-search"
      role="search"
      aria-label={searchLabels[type]}
      noValidate
      onSubmit={submit}
    >
      {type === 'nodes' && (
        <ModeSwitch
          meaning={draft.meaning}
          onChange={(next) => applyDraft({ ...draft, meaning: next })}
        />
      )}
      <div className="record-search-main">
        <label className="record-search-term">
          Buscar
          <input
            type="search"
            value={draft.q}
            maxLength={meaning ? maxMeaningLength : maxQueryLength}
            placeholder={meaning ? meaningHint : searchHints[type]}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => change('q', e.target.value)}
          />
        </label>
        <div className="actions">
          <button type="submit">Buscar</button>
          <button
            type="button"
            onClick={() => apply(meaning ? { mode: meaningMode } : {})}
          >
            Limpar
          </button>
        </div>
      </div>
      <SearchOptions draft={draft} change={change} meaning={meaning} />
      {type === 'nodes' && !meaning && (
        <NodeFilters draft={draft} change={change} error={error} />
      )}
    </form>
  );
}

// "Nome" é a busca de sempre; "Significado" compara o sentido do texto. Troca
// na hora e mantém o texto; as setas movem entre os dois, como em todo grupo
// de rádios.
function ModeSwitch({
  meaning,
  onChange,
}: {
  meaning: boolean;
  onChange: (meaning: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div className="mode-switch" role="radiogroup" aria-labelledby={labelId}>
      <span id={labelId} className="mode-switch-label">
        Buscar por
      </span>
      <div className="mode-switch-options">
        {(
          [
            [false, 'Nome'],
            [true, 'Significado'],
          ] as const
        ).map(([value, label]) => (
          <label key={label}>
            <input
              type="radio"
              name="search-mode"
              checked={meaning === value}
              onChange={() => onChange(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Marcas e, por significado, o tipo (que fica fora do grupo de período, que
// não existe nesse modo). "Exato" só vale para a busca por nome.
function SearchOptions({
  draft,
  change,
  meaning,
}: {
  draft: SearchDraft;
  change: Change;
  meaning: boolean;
}) {
  return (
    <div className="record-search-options">
      {!meaning && (
        <label className="check">
          <input
            type="checkbox"
            checked={draft.exact}
            onChange={(e) => change('exact', e.target.checked)}
          />
          {exactLabel}
        </label>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={draft.pending}
          onChange={(e) => change('pending', e.target.checked)}
        />
        Incluir pendentes
      </label>
      {meaning && (
        <label className="record-search-kind">
          Tipo
          <KindSelect value={draft.kind} onChange={(v) => change('kind', v)} />
        </label>
      )}
    </div>
  );
}

function KindSelect({
  value,
  onChange,
}: {
  value: SearchDraft['kind'];
  onChange: (value: SearchDraft['kind']) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SearchDraft['kind'])}
    >
      <option value="">Todos</option>
      {Object.entries(kindLabels).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
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
          <KindSelect value={draft.kind} onChange={(v) => change('kind', v)} />
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
