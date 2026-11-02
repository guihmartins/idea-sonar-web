import { useState } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { ApiError } from '../api/client';
import { Failure } from '../components/Feedback';
import type { CandidateType } from '../api/adapter';
import type {
  EntityType,
  HistoryEntry,
  ImportDetail,
  ImportItem,
  PendingItem,
} from '../api/domain';
import {
  entitySummary,
  entityTitle,
  historyLabels,
  importStatusLabels,
  originLabels,
  outcomeLabels,
  pendingProposal,
  pendingTitle,
} from '../components/labels';
import { ImportSimilar } from './ImportSimilar';
import { MeaningResults } from './MeaningResults';
import { RecordItem } from './RecordItem';
import { RecordSearch } from './RecordSearch';
import {
  countText,
  emptyText,
  filtersFromParams,
  isSearchable,
  meaningMode,
  paramsFromFilters,
} from './searchFilters';
import type { SearchFilters } from './searchFilters';
export const typeLabels: Record<EntityType, string> = {
  nodes: 'Pontos',
  relations: 'Relações',
  sources: 'Fontes',
  contexts: 'Contextos',
  views: 'Views salvas',
};
export function RecordsPage({ type }: { type: EntityType }) {
  const [params, setParams] = useSearchParams();
  // Só pontos, fontes e contextos têm busca; nas outras listas a URL não conta.
  const searchable = isSearchable(type);
  const filters: SearchFilters = searchable
    ? filtersFromParams(type, params)
    : {};
  return (
    <section>
      <PageHeading type={type} />
      {searchable && (
        <RecordSearch
          key={type}
          type={type}
          filters={filters}
          onSearch={(next) => setParams(paramsFromFilters(next))}
        />
      )}
      {filters.mode === meaningMode ? (
        <MeaningResults
          key={paramsFromFilters(filters).toString()}
          filters={filters}
        />
      ) : (
        <NameResults type={type} filters={filters} />
      )}
    </section>
  );
}
// Lista por nome (a de sempre): paginada por cursor, com a linha de estado.
function NameResults({
  type,
  filters,
}: {
  type: EntityType;
  filters: SearchFilters;
}) {
  const { api } = useServices();
  // Os filtros fazem parte da chave: a API recusa o cursor de outra busca, então
  // mudar um filtro recomeça a lista em vez de continuar a paginação antiga.
  const query = useInfiniteQuery({
    queryKey: ['list', type, filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.list(type, pageParam, signal, filters),
    getNextPageParam: (p) => p.nextCursor,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      {isSearchable(type) && (
        // Região viva: o leitor de tela anuncia a contagem.
        <p className="record-count" aria-live="polite">
          {query.isSuccess ? countText(items.length, query.hasNextPage) : ''}
        </p>
      )}
      {query.isPending && <p role="status">Carregando…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.isSuccess && items.length === 0 && (
        <EmptyList type={type} filters={filters} />
      )}
      <div className="record-list">
        {items.map((item) => (
          <RecordItem key={item.id} type={type} item={item} />
        ))}
      </div>
      {query.hasNextPage && (
        <button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Carregar mais
        </button>
      )}
    </>
  );
}
function PageHeading({ type }: { type: EntityType }) {
  return (
    <div className="page-heading">
      <h1>{typeLabels[type]}</h1>
      {type !== 'views' && (
        <Link className="button primary" to={`/edit/${type}`}>
          Cadastrar
        </Link>
      )}
    </div>
  );
}
// Lista vazia: na busca, o texto nomeia o que foi buscado.
function EmptyList({
  type,
  filters,
}: {
  type: EntityType;
  filters: SearchFilters;
}) {
  return (
    <p className="empty">
      {isSearchable(type)
        ? emptyText(type, filters)
        : 'Nenhum registro encontrado.'}
      {type === 'views' && ' Salve um recorte na tela Explorar mapa.'}
    </p>
  );
}
export function ImportsPage() {
  const { api } = useServices();
  const query = useInfiniteQuery({
    queryKey: ['imports'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.imports(pageParam, signal),
    getNextPageParam: (p) => p.nextCursor,
  });
  return (
    <section>
      <h1>Importações</h1>
      <p>Consulte os lotes enviados pelo chat ou por integrações externas.</p>
      {query.isPending && <p role="status">Carregando importações…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages[0]?.items.length === 0 && (
        <p>Nenhuma importação encontrada.</p>
      )}
      <div className="record-list">
        {query.data?.pages
          .flatMap((p) => p.items)
          .map((i) => (
            <article key={i.id}>
              <h2>
                <Link to={`/imports/${i.id}`}>{i.inputSummary}</Link>
              </h2>
              <p>
                {new Date(i.createdAt).toLocaleString('pt-BR')} ·{' '}
                {originLabels[i.origin]} · {importStatusLabels[i.status]}
              </p>
            </article>
          ))}
      </div>
      {query.hasNextPage && (
        <button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Mais importações
        </button>
      )}
    </section>
  );
}
export function ImportPage() {
  const { id = '' } = useParams();
  const { api } = useServices();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['import', id],
    queryFn: ({ signal }) => api.import(id, signal),
  });
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState('');
  async function undo(version: number) {
    setBusy(true);
    setError(null);
    try {
      await api.undo(id, version, reason.trim(), key);
      setResult('Importação desfeita pela API.');
      setConfirm(false);
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const batch = query.data;
  return (
    <section>
      <Link to="/imports">Voltar às importações</Link>
      <h1>Detalhes da importação</h1>
      {query.isPending && <p role="status">Carregando…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {batch && (
        <ImportBatchDetails batch={batch} onUndo={() => setConfirm(true)} />
      )}
      {confirm && batch && (
        <form
          className="confirmation"
          role="group"
          aria-label="Confirmar desfazer"
          onSubmit={(e) => {
            e.preventDefault();
            void undo(batch.version);
          }}
        >
          <p>
            A API reverte o lote inteiro ou nada. Registros editados depois ou
            pendências já resolvidas impedem a reversão.
          </p>
          <label>
            Motivo para desfazer
            <textarea
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setKey(crypto.randomUUID());
              }}
            />
          </label>
          <button className="primary" disabled={busy}>
            Confirmar desfazer lote
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Cancelar
          </button>
        </form>
      )}
      {error !== null && <Failure error={error} />}
      {result && <p role="status">{result}</p>}
    </section>
  );
}
function ImportBatchDetails({
  batch,
  onUndo,
}: {
  batch: ImportDetail;
  onUndo: () => void;
}) {
  return (
    <>
      <h2>{batch.inputSummary}</h2>
      <p>
        {new Date(batch.createdAt).toLocaleString('pt-BR')} ·{' '}
        {originLabels[batch.origin]} · {importStatusLabels[batch.status]}
      </p>
      {(Object.keys(outcomeLabels) as (keyof typeof outcomeLabels)[]).map(
        (outcome) => (
          <ImportOutcome
            key={outcome}
            title={outcomeLabels[outcome]}
            items={batch.result.items.filter((i) => i.outcome === outcome)}
          />
        ),
      )}
      {batch.status === 'undone' ? (
        <p>Esta importação foi desfeita.</p>
      ) : (
        <button onClick={onUndo}>Desfazer importação</button>
      )}
    </>
  );
}
function ImportOutcome({
  title,
  items,
}: {
  title: string;
  items: ImportItem[];
}) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.clientRef}>
              {item.clientRef} ({item.entityType})
              {item.reason ? ` — ${item.reason}` : ''}
              <CandidateLinks item={item} />
              <ImportSimilar item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum item.</p>
      )}
    </div>
  );
}
// Registros existentes que o item repetiria, cada um com link para o editor.
function CandidateLinks({ item }: { item: ImportItem }) {
  if (item.candidates.length === 0) return null;
  return (
    <ul
      className="candidate-links"
      aria-label={`Candidatos de ${item.clientRef}`}
    >
      {item.candidates.map((id) => (
        <CandidateLink key={id} type={item.entityType} id={id} />
      ))}
    </ul>
  );
}
function CandidateLink({ type, id }: { type: string; id: string }) {
  const { api } = useServices();
  const kind = type as EntityType;
  const query = useQuery({
    queryKey: [kind, id],
    queryFn: ({ signal }) => api.detail(kind, id, signal),
  });
  return (
    <li>
      <Link to={`/edit/${type}/${id}`}>
        {query.data ? entityTitle(kind, query.data) : id}
      </Link>
    </li>
  );
}
export function PendingPage() {
  const { api } = useServices();
  const cache = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['pending'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.pending(pageParam, signal),
    getNextPageParam: (p) => p.nextCursor,
  });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [keys] = useState(() => new Map<string, string>());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  // Resolver e descartar usam chaves próprias por pendência: a mesma ação
  // repetida reaproveita a chave, e outra ação não herda a anterior.
  async function act(
    item: PendingItem,
    action: string,
    done: string,
    run: (key: string) => Promise<unknown>,
  ) {
    const id = `${item.id}:${action}`;
    const key = keys.get(id) ?? crypto.randomUUID();
    keys.set(id, key);
    setBusy(item.id);
    setError(null);
    try {
      await run(key);
      keys.delete(id);
      setMessage(done);
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
      // Lote desfeito depois de a lista carregar: a API já não lista a pendência.
      if (e instanceof ApiError && e.code === 'BATCH_UNDONE')
        await cache.invalidateQueries();
    } finally {
      setBusy('');
    }
  }
  // Qualquer edição do formulário da pendência invalida as chaves dela.
  function forget(id: string) {
    keys.delete(`${id}:resolve`);
    keys.delete(`${id}:discard`);
  }
  const resolve = (item: PendingItem) =>
    act(item, 'resolve', 'Pendência resolvida pela API.', (key) =>
      api.resolve(
        item,
        selected[item.id] ?? '',
        (reason[item.id] ?? '').trim(),
        key,
      ),
    );
  // Descartar não escolhe registro: só exige a justificativa.
  function discard(item: PendingItem) {
    const why = (reason[item.id] ?? '').trim();
    if (!why) {
      setError(
        new Error('Informe a justificativa da resolução para descartar.'),
      );
      return Promise.resolve();
    }
    return act(item, 'discard', 'Pendência descartada.', (key) =>
      api.discard(item, why, key),
    );
  }
  return (
    <section>
      <h1>Pendências</h1>
      <p>
        Revise os motivos e escolha explicitamente o registro existente que
        resolve cada pendência. Nenhuma mesclagem é automática. Descartar tira a
        pendência da fila sem criar nem alterar registro.
      </p>
      {query.isPending && <p role="status">Carregando…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {error !== null && <Failure error={error} />}
      {message && <p role="status">{message}</p>}
      {query.data?.pages[0]?.items.length === 0 && (
        <p>Nenhuma pendência encontrada.</p>
      )}
      {query.data?.pages
        .flatMap((p) => p.items)
        .map((p) => (
          <form
            key={p.id}
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              void resolve(p);
            }}
          >
            <h2>{pendingTitle(p)}</h2>
            <p>{p.reason ?? 'Sem motivo informado.'}</p>
            <p>
              <Link to={`/imports/${p.batchId}`}>Ver importação de origem</Link>
            </p>
            <CandidateSelect
              item={p}
              value={selected[p.id] ?? ''}
              onChange={(value) => {
                setSelected({ ...selected, [p.id]: value });
                forget(p.id);
              }}
            />
            <label>
              Justificativa da resolução
              <textarea
                required
                value={reason[p.id] ?? ''}
                onChange={(e) => {
                  setReason({ ...reason, [p.id]: e.target.value });
                  forget(p.id);
                }}
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={!!busy}>
                Resolver pendência
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void discard(p)}
              >
                Descartar pendência
              </button>
            </div>
          </form>
        ))}
      {query.hasNextPage && (
        <button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Mais pendências
        </button>
      )}
    </section>
  );
}
export function HistoryPage() {
  const { type, id = '' } = useParams();
  const { api } = useServices();
  const valid = isHistoryType(type);
  const query = useInfiniteQuery({
    queryKey: ['history', type, id],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.history(
        type === 'relations' ? 'relations' : 'nodes',
        id,
        pageParam,
        signal,
      ),
    getNextPageParam: (p) => p.nextCursor,
    enabled: valid,
  });
  if (!valid) return <h1>Tipo de histórico inválido</h1>;
  return (
    <section>
      <h1>Histórico do registro</h1>
      <Link to={`/edit/${type}/${id}`}>Voltar ao registro</Link>
      {query.isPending && <p role="status">Carregando histórico…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages[0]?.items.length === 0 && (
        <p>Sem alterações registradas.</p>
      )}
      <ol>
        {query.data?.pages
          .flatMap((p) => p.items)
          .map((h) => (
            <li className="card" key={h.id}>
              <time dateTime={h.createdAt}>
                {new Date(h.createdAt).toLocaleString('pt-BR')}
              </time>
              <h2>{historyLabels[h.operation] ?? h.operation}</h2>
              <p>{historyDescription(h)}</p>
            </li>
          ))}
      </ol>
      {query.hasNextPage && (
        <button
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Mais histórico
        </button>
      )}
    </section>
  );
}
export function ExportPage() {
  const { api } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.export();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'idea-sonar-export.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>Exportar dados</h1>
      <p>
        A exportação contém dados privados da sua conta. Guarde o arquivo em
        local seguro.
      </p>
      <button
        className="primary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? 'Preparando…' : 'Baixar exportação'}
      </button>
      {error !== null && (
        <Failure error={error} retry={() => void download()} />
      )}
      {done && <p role="status">Exportação preparada para download.</p>}
    </section>
  );
}

// Busca candidatos do mesmo tipo pelo nome proposto; relações exigem o ID.
function CandidateSelect({
  item,
  value,
  onChange,
}: {
  item: PendingItem;
  value: string;
  onChange: (value: string) => void;
}) {
  const { api } = useServices();
  const searchable = item.entityType !== 'relations';
  const term = pendingTitle(item);
  const query = useQuery({
    queryKey: ['candidates', item.entityType, term],
    queryFn: ({ signal }) =>
      api.candidates(item.entityType as CandidateType, term, signal),
    enabled: searchable,
  });
  if (!searchable)
    return (
      <label>
        ID da relação existente
        <input
          required
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </label>
    );
  return (
    <>
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      <label htmlFor={`candidate-${item.id}`}>
        Candidato
        <select
          id={`candidate-${item.id}`}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecione explicitamente</option>
          {query.data?.items.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entityTitle(item.entityType, entity)} ·{' '}
              {entitySummary(item.entityType, entity)} · {entity.id}
            </option>
          ))}
        </select>
      </label>
      {query.data?.items.length === 0 && (
        <p>
          Nenhum candidato com nome semelhante. Proposta: {proposalText(item)}
        </p>
      )}
    </>
  );
}
function proposalText(item: PendingItem) {
  return JSON.stringify(pendingProposal(item));
}
// Campos alterados entre os snapshots de auditoria, sem metadados do servidor.
function historyDescription(entry: HistoryEntry) {
  const ignored = new Set(['version', 'updatedAt', 'createdAt']);
  const before = entry.beforeData ?? {};
  const after = entry.afterData ?? {};
  const changed = Object.keys({ ...before, ...after }).filter(
    (key) =>
      !ignored.has(key) &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  return `Versão ${entry.versionAfter}${changed.length ? ` · campos: ${changed.join(', ')}` : ''}`;
}

function isHistoryType(type: string | undefined) {
  return type === 'nodes' || type === 'relations';
}
