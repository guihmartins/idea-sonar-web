// Seletores por busca: o editor e o filtro do mapa escolhem pontos, fontes e
// contextos pesquisando por nome (api.search / api.candidates, ambos com
// pendentes quando o cadastro precisa), em vez de carregar todos os registros.
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useServices } from '../../app/services';
import { defaultFilters } from '../../api/domain';
import type { Context, Filters, Node, Source } from '../../api/domain';
import { Failure } from '../../components/Feedback';
import { kindLabels } from '../../components/labels';

export type PickedType = 'contexts' | 'sources';

function useDebounced(text: string) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  return q;
}

export function itemTitle(type: PickedType, item: Context | Source): string {
  return type === 'sources'
    ? `${(item as Source).title} · ${(item as Source).authorText}`
    : (item as Context).label;
}

function useItem(type: PickedType, id: string) {
  const { api } = useServices();
  return useQuery({
    queryKey: [type, id],
    queryFn: ({ signal }) => api.detail(type, id, signal),
    enabled: !!id,
  });
}

// Item já escolhido, mostrado pelo ID até o nome chegar (ou se não existir mais).
function SelectedItem({
  type,
  id,
  multiple,
  onRemove,
}: {
  type: PickedType;
  id: string;
  multiple: boolean;
  onRemove: () => void;
}) {
  const item = useItem(type, id);
  const title = item.data ? itemTitle(type, item.data as Context | Source) : id;
  return (
    <>
      <p className="picker-selected">
        {multiple ? title : `Selecionado: ${title}`}
        {multiple && (
          <button
            type="button"
            className="subtle"
            aria-label={`Remover ${title}`}
            onClick={onRemove}
          >
            Remover
          </button>
        )}
      </p>
      {item.error && (
        <Failure error={item.error} retry={() => void item.refetch()} />
      )}
    </>
  );
}

// Os resultados não saem do lugar ao escolher: o controle marcado continua na
// lista, então o foco do teclado não se perde.
function CandidateResults({
  type,
  q,
  values,
  multiple,
  name,
  onToggle,
}: {
  type: PickedType;
  q: string;
  values: string[];
  multiple: boolean;
  name: string;
  onToggle: (id: string) => void;
}) {
  const { api } = useServices();
  const search = useQuery({
    queryKey: ['candidates', type, q],
    queryFn: ({ signal }) => api.candidates(type, q, signal),
    enabled: !!q,
  });
  const found = (search.data?.items ?? []) as (Context | Source)[];
  return (
    <div className="picker-results">
      {search.isFetching && <p role="status">Buscando candidatos…</p>}
      {search.error && (
        <Failure error={search.error} retry={() => void search.refetch()} />
      )}
      {found.map((item) => (
        <label className="check" key={item.id}>
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={name}
            checked={values.includes(item.id)}
            onChange={() => onToggle(item.id)}
          />
          {itemTitle(type, item)}
        </label>
      ))}
      {q && search.data && found.length === 0 && <p>Nenhum candidato.</p>}
      {search.data?.nextCursor && (
        <p className="muted">Há mais resultados. Refine a busca.</p>
      )}
    </div>
  );
}

function toggled(values: string[], id: string, multiple: boolean): string[] {
  if (!multiple) return [id];
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

/**
 * Escolhe contextos ou fontes por busca. `values` são os IDs escolhidos, que
 * aparecem pelo nome mesmo fora da busca atual; `multiple` permite vários.
 */
export function CandidatePicker({
  type,
  label,
  values,
  multiple = false,
  onChange,
}: {
  type: PickedType;
  label: string;
  values: string[];
  multiple?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [text, setText] = useState('');
  const q = useDebounced(text);
  return (
    <fieldset className="picker">
      <legend>{label}</legend>
      <label>
        Buscar candidato
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {values.map((id) => (
        <SelectedItem
          key={id}
          type={type}
          id={id}
          multiple={multiple}
          onRemove={() => onChange(values.filter((value) => value !== id))}
        />
      ))}
      {!multiple && values.length > 0 && (
        <button type="button" onClick={() => onChange([])}>
          Limpar seleção
        </button>
      )}
      <CandidateResults
        type={type}
        q={q}
        values={values}
        multiple={multiple}
        name={label}
        onToggle={(id) => onChange(toggled(values, id, multiple))}
      />
    </fieldset>
  );
}

interface NodeSearchOptions {
  // Filtros enviados à API além de `includePending` (ex.: só conceitos ativos).
  filters?: Partial<Filters> | undefined;
  // Descarta no cliente o que a API não filtra (ex.: só conceitos amplos).
  accept?: ((node: Node) => boolean) | undefined;
}

// Busca concluída, sem página seguinte e sem nenhum ponto aceito.
function noMoreNodes(
  search: { data: unknown; hasNextPage: boolean },
  nodes: Node[],
) {
  return !!search.data && !search.hasNextPage && nodes.length === 0;
}

function NodeSearchResults({
  q,
  value,
  label,
  onChange,
  filters,
  accept,
}: {
  q: string;
  value: string;
  label: string;
  onChange: (id: string) => void;
} & NodeSearchOptions) {
  const { api } = useServices();
  const search = useInfiniteQuery({
    queryKey: ['picker', q, filters ?? null],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.search(
        q,
        { ...defaultFilters, includePending: true, ...filters },
        pageParam,
        signal,
      ),
    getNextPageParam: (p) => p.nextCursor,
    enabled: !!q,
  });
  const nodes = (search.data?.pages.flatMap((p) => p.items) ?? []).filter(
    (node) => accept?.(node) ?? true,
  );
  return (
    <>
      {' '}
      {search.isFetching && <p role="status">Buscando candidatos…</p>}
      {search.error && (
        <Failure error={search.error} retry={() => void search.refetch()} />
      )}
      {nodes.map((n) => (
        <label className="check" key={n.id}>
          <input
            type="radio"
            name={label}
            checked={value === n.id}
            onChange={() => onChange(n.id)}
          />
          {n.label} · {kindLabels[n.kind]} · {n.description} · ID {n.id}
        </label>
      ))}
      {q && noMoreNodes(search, nodes) && <p>Nenhum candidato.</p>}
      {search.hasNextPage && (
        <button
          type="button"
          disabled={search.isFetchingNextPage}
          onClick={() => void search.fetchNextPage()}
        >
          Mais candidatos
        </button>
      )}
    </>
  );
}

export function NodePicker({
  label,
  value,
  onChange,
  filters,
  accept,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
} & NodeSearchOptions) {
  const { api } = useServices();
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const selected = useQuery({
    queryKey: ['node', value],
    queryFn: ({ signal }) => api.node(value, signal),
    enabled: !!value,
  });
  return (
    <fieldset className="picker">
      <legend>{label}</legend>
      <label>
        Buscar candidato
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {value && <p>Selecionado: {selected.data?.label ?? value}</p>}
      {selected.error && (
        <Failure error={selected.error} retry={() => void selected.refetch()} />
      )}
      <NodeSearchResults
        q={q}
        value={value}
        label={label}
        onChange={onChange}
        filters={filters}
        accept={accept}
      />
    </fieldset>
  );
}
