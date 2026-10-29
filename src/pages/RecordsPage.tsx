import { useState } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { Failure, editorialLabels } from '../components/Feedback';
import type { CandidateType } from '../api/adapter';
import type {
  EntityType,
  HistoryEntry,
  ImportDetail,
  PendingItem,
} from '../api/domain';
import {
  entitySummary,
  entityTitle,
  historyLabels,
  importStatusLabels,
  originLabels,
  pendingProposal,
  pendingTitle,
} from '../components/labels';
export const typeLabels: Record<EntityType, string> = {
  nodes: 'Pontos',
  relations: 'Relações',
  sources: 'Fontes',
  contexts: 'Contextos',
  views: 'Views salvas',
};
export function RecordsPage({ type }: { type: EntityType }) {
  const { api } = useServices();
  const query = useInfiniteQuery({
    queryKey: ['list', type],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.list(type, pageParam, signal),
    getNextPageParam: (p) => p.nextCursor,
  });
  return (
    <section>
      <div className="page-heading">
        <h1>{typeLabels[type]}</h1>
        {type !== 'views' && (
          <Link className="button" to={`/edit/${type}`}>
            Cadastrar
          </Link>
        )}
      </div>
      {query.isPending && <p role="status">Carregando…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages[0]?.items.length === 0 && (
        <p className="empty">
          Nenhum registro encontrado.
          {type === 'views' && ' Salve um recorte na tela Explorar mapa.'}
        </p>
      )}
      <div className="record-list">
        {query.data?.pages
          .flatMap((p) => p.items)
          .map((item) => (
            <article key={item.id}>
              <h2>{entityTitle(type, item)}</h2>
              <p>{entitySummary(type, item)}</p>
              <p>Estado: {editorialLabels[item.status]}</p>
              {type === 'views' ? (
                <Link to={`/map?view=${item.id}`}>Restaurar view</Link>
              ) : (
                <Link to={`/edit/${type}/${item.id}`}>Ver e editar</Link>
              )}
            </article>
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
    </section>
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
const outcomeLabels = {
  created: 'Criados',
  updated: 'Atualizados',
  reused: 'Reutilizados',
  pending: 'Pendentes',
} as const;
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
          <button disabled={busy}>Confirmar desfazer lote</button>
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
  items: { clientRef: string; entityType: string; reason: string | null }[];
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
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum item.</p>
      )}
    </div>
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
  async function resolve(item: PendingItem) {
    const key = keys.get(item.id) ?? crypto.randomUUID();
    keys.set(item.id, key);
    setBusy(item.id);
    setError(null);
    try {
      await api.resolve(
        item,
        selected[item.id] ?? '',
        (reason[item.id] ?? '').trim(),
        key,
      );
      keys.delete(item.id);
      setMessage('Pendência resolvida pela API.');
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  }
  return (
    <section>
      <h1>Pendências</h1>
      <p>
        Revise os motivos e escolha explicitamente o registro existente que
        resolve cada pendência. Nenhuma mesclagem é automática.
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
                keys.delete(p.id);
              }}
            />
            <label>
              Justificativa da resolução
              <textarea
                required
                value={reason[p.id] ?? ''}
                onChange={(e) => {
                  setReason({ ...reason, [p.id]: e.target.value });
                  keys.delete(p.id);
                }}
              />
            </label>
            <button disabled={!!busy}>Resolver pendência</button>
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
      <button disabled={busy} onClick={() => void download()}>
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
