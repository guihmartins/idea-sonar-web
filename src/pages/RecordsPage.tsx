import { useState } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { Failure, editorialLabels } from '../components/Feedback';
import type { EntityType } from '../api/domain';
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
              <h2>{item.label}</h2>
              <p>{item.description}</p>
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
                <Link to={`/imports/${i.id}`}>{i.label}</Link>
              </h2>
              <p>
                {new Date(i.at).toLocaleString('pt-BR')} · {i.created.length}{' '}
                criados · {i.updated.length} atualizados · {i.reused.length}{' '}
                reutilizados · {i.pending.length} pendentes
              </p>
              {i.undone && <p>Desfeito</p>}
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
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState('');
  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.undo(id, key);
      setResult(`${result.message} ${result.conflicts.join('; ')}`);
      setConfirm(false);
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <Link to="/imports">Voltar às importações</Link>
      <h1>Detalhes da importação</h1>
      {query.isPending && <p role="status">Carregando…</p>}
      {query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data && (
        <>
          <h2>{query.data.label}</h2>
          <p>{query.data.description}</p>
          {(
            ['created', 'updated', 'reused', 'pending', 'conflicts'] as const
          ).map((field, index) => (
            <div key={field}>
              <h3>
                {
                  [
                    'Criados',
                    'Atualizados',
                    'Reutilizados',
                    'Pendentes',
                    'Conflitos',
                  ][index]
                }
              </h3>
              {query.data[field].length ? (
                <ul>
                  {query.data[field].map((value, i) => (
                    <li key={`${value}-${i}`}>{value}</li>
                  ))}
                </ul>
              ) : (
                <p>Nenhum item.</p>
              )}
            </div>
          ))}
          {!query.data.undone && (
            <button onClick={() => setConfirm(true)}>
              Desfazer importação
            </button>
          )}
          {query.data.undone && <p>Esta importação foi desfeita.</p>}
        </>
      )}
      {confirm && (
        <div
          className="confirmation"
          role="group"
          aria-label="Confirmar desfazer"
        >
          <p>
            A API avaliará quais alterações deste lote podem ser revertidas.
            Registros editados depois podem gerar conflitos; consulte o
            resultado antes de continuar.
          </p>
          <button disabled={busy} onClick={() => void undo()}>
            Confirmar desfazer lote
          </button>
          <button disabled={busy} onClick={() => setConfirm(false)}>
            Cancelar
          </button>
        </div>
      )}
      {error !== null && <Failure error={error} />}
      {result && <p role="status">{result}</p>}
    </section>
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
  async function resolve(id: string) {
    const key = keys.get(id) ?? crypto.randomUUID();
    keys.set(id, key);
    setBusy(id);
    setError(null);
    try {
      await api.resolve(id, reason[id] ?? '', selected[id] ?? '', key);
      keys.delete(id);
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
        Revise os motivos e candidatos antes de resolver. Nenhuma mesclagem é
        automática.
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
              void resolve(p.id);
            }}
          >
            <h2>{p.label}</h2>
            <p>{p.reason}</p>
            {p.candidates.length > 0 && (
              <label htmlFor={`candidate-${p.id}`}>
                Candidato
                <select
                  id={`candidate-${p.id}`}
                  required
                  value={selected[p.id] ?? ''}
                  onChange={(e) => {
                    setSelected({ ...selected, [p.id]: e.target.value });
                    keys.delete(p.id);
                  }}
                >
                  <option value="">Selecione explicitamente</option>
                  {p.candidates.map((id) => (
                    <CandidateOption key={id} id={id} />
                  ))}
                </select>
              </label>
            )}
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
              <time dateTime={h.at}>
                {new Date(h.at).toLocaleString('pt-BR')}
              </time>
              <h2>
                {(
                  {
                    created: 'Criação',
                    updated: 'Edição',
                    archived: 'Arquivamento',
                    restored: 'Restauração',
                  } as Record<string, string>
                )[h.action] ?? h.action}
              </h2>
              <p>{h.description}</p>
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

function CandidateOption({ id }: { id: string }) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['node', id],
    queryFn: ({ signal }) => api.node(id, signal),
  });
  return (
    <option value={id}>
      {query.data
        ? `${query.data.label} · ${query.data.kind} · ${query.data.description} · ${id}`
        : `${id}${query.error ? ' (detalhes indisponíveis)' : ' (carregando)'}`}
    </option>
  );
}

function isHistoryType(type: string | undefined) {
  return type === 'nodes' || type === 'relations';
}
