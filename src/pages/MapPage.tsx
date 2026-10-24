import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { Failure, SafeLink, editorialLabels } from '../components/Feedback';
const GraphCanvas = lazy(() =>
  import('../graph/GraphCanvas').then((module) => ({
    default: module.GraphCanvas,
  })),
);
import { emptyLedger, reduceLedger, visible } from '../graph/visibility/ledger';
import type { Ledger } from '../graph/visibility/ledger';
import { defaultFilters, viewSchema } from '../api/domain';
import type {
  Filters,
  Node,
  Relation,
  Catalog,
  Source,
  Context,
} from '../api/domain';
import type { Positions, Viewport } from '../graph/layout/positions';
import { formatPeriod } from '../components/period';
const initialViewport: Viewport = { zoom: 1, pan: { x: 0, y: 0 } };
export function MapPage() {
  const { api } = useServices();
  const [params] = useSearchParams();
  const viewId = params.get('view');
  const [ledger, dispatch] = useReducer(reduceLedger, emptyLedger);
  const latest = useRef(ledger);
  latest.current = ledger;
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [selection, setSelection] = useState<{ id: string; edge: boolean }>({
    id: '',
    edge: false,
  });
  const [list, setList] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusRevision, setFocusRevision] = useState(0);
  const [fitRevision, setFitRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const [positions, setPositions] = useState<Positions>({});
  const [viewport, setViewport] = useState<Viewport>(initialViewport);
  const positionsRef = useRef(positions);
  const viewportRef = useRef(viewport);
  function applyPositions(value: Positions) {
    positionsRef.current = value;
    setPositions(value);
  }
  function applyViewport(value: Viewport) {
    viewportRef.current = value;
    setViewport(value);
  }
  const [focusHistory, setFocusHistory] = useState<string[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [viewName, setViewName] = useState('');
  const [saveKey, setSaveKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => api.catalog(signal),
  });
  const contexts = useQuery({
    queryKey: ['map-contexts'],
    queryFn: async ({ signal }) => {
      const all: Context[] = [];
      let cursor: string | null = null;
      do {
        const page = await api.list('contexts', cursor, signal);
        all.push(...(page.items as Context[]));
        cursor = page.nextCursor;
      } while (cursor);
      return all;
    },
  });
  const results = useInfiniteQuery({
    queryKey: ['search', term, filters],
    initialPageParam: null as string | null,
    queryFn: ({ signal, pageParam }) =>
      api.search(term, filters, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: term.length > 0,
  });
  const data = useMemo(() => visible(ledger), [ledger]);
  const cancel = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setBusy([]);
  }, []);
  useEffect(
    () => () => {
      controllers.current.forEach((c) => c.abort());
    },
    [],
  );
  useEffect(() => {
    if (!viewId) return;
    const controller = new AbortController();
    cancel();
    controllers.current.set('restore-view', controller);
    dispatch({ type: 'reset' });
    setError(null);
    setSelection({ id: '', edge: false });
    setMessage('Restaurando view com dados atuais…');
    void (async () => {
      const view = viewSchema.parse(
        await api.detail('views', viewId, controller.signal),
      );
      setFilters(view.filters);
      const root = await api.node(view.root, controller.signal);
      if (root.status === 'archived')
        throw new Error(
          'A raiz desta view foi arquivada. Escolha outro ponto para iniciar um recorte.',
        );
      let restored: Ledger = {
        roots: [root],
        expansions: {},
        generation: latest.current.generation + 1,
      };
      const remaining = new Set(view.expandedNodes);
      const missing: string[] = [];
      let changed = true;
      while (changed && remaining.size) {
        changed = false;
        for (const id of [...remaining]) {
          if (!visible(restored).nodes.some((n) => n.id === id)) continue;
          remaining.delete(id);
          changed = true;
          try {
            let cursor: string | null = null;
            const seen = new Set<string>();
            do {
              const page = await api.neighbors(
                id,
                view.filters,
                cursor,
                controller.signal,
              );
              const candidate = reduceLedger(restored, {
                type: 'page',
                id,
                page,
                generation: restored.generation,
              });
              if (candidate === restored) {
                missing.push('limite de 500 pontos');
                break;
              }
              restored = candidate;
              cursor = page.nextCursor;
              if (cursor && seen.has(cursor))
                throw new Error('Cursor repetido.');
              if (cursor) seen.add(cursor);
            } while (cursor);
          } catch (e) {
            if (controller.signal.aborted) throw e;
            missing.push(id);
          }
        }
      }
      controller.signal.throwIfAborted();
      dispatch({ type: 'root', node: root });
      // Geração do reducer após root corresponde à geração capturada acima.
      for (const [id, page] of Object.entries(restored.expansions))
        dispatch({ type: 'page', id, page, generation: restored.generation });
      applyPositions(view.positions);
      applyViewport(view.viewport);
      setSelection({ id: root.id, edge: false });
      setFocusHistory([root.id]);
      setFocusIndex(0);
      setMessage(
        missing.length || remaining.size
          ? 'View restaurada parcialmente: há registros ausentes, arquivados ou acima do limite.'
          : 'View restaurada com dados atuais.',
      );
    })().catch((e: unknown) => {
      if (!controller.signal.aborted) setError(e);
    });
    return () => {
      controller.abort();
      if (controllers.current.get('restore-view') === controller)
        controllers.current.delete('restore-view');
    };
  }, [viewId, api, cancel]);
  function chooseRoot(node: Node) {
    cancel();
    setSaveKey(crypto.randomUUID());
    dispatch({ type: 'root', node });
    applyPositions({});
    applyViewport(initialViewport);
    setSelection({ id: node.id, edge: false });
    setFocusHistory([node.id]);
    setFocusIndex(0);
    setError(null);
    setMessage('');
  }
  function changeFilters(next: Filters) {
    cancel();
    setSaveKey(crypto.randomUUID());
    setFilters(next);
    if (ledger.roots[0]) {
      setSelection({ id: ledger.roots[0].id, edge: false });
      setFocusHistory([ledger.roots[0].id]);
      setFocusIndex(0);
    }
    const root = ledger.roots[0];
    if (root) dispatch({ type: 'root', node: root });
    else dispatch({ type: 'reset' });
    setMessage(
      'Filtros alterados. Expansões e cursores anteriores descartados.',
    );
  }
  async function expand(id: string) {
    if (controllers.current.has(id)) return;
    const controller = new AbortController();
    controllers.current.set(id, controller);
    const generation = ledger.generation;
    setBusy((values) => [...values, id]);
    setError(null);
    try {
      const page = await api.neighbors(
        id,
        filters,
        ledger.expansions[id]?.nextCursor ?? null,
        controller.signal,
      );
      if (generation !== latest.current.generation || controller.signal.aborted)
        return;
      const next = reduceLedger(latest.current, {
        type: 'page',
        id,
        page,
        generation,
      });
      if (next === latest.current)
        setMessage(
          'Limite de 500 pontos atingido. Recolha conexões ou refine os filtros.',
        );
      else {
        setSaveKey(crypto.randomUUID());
        dispatch({ type: 'page', id, page, generation });
        setMessage(
          page.truncated
            ? 'A API limitou esta expansão. Refine os filtros.'
            : 'Conexões carregadas.',
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e);
    } finally {
      if (controllers.current.get(id) === controller) {
        controllers.current.delete(id);
        setBusy((values) => values.filter((value) => value !== id));
      }
    }
  }
  function center(id: string) {
    cancel();
    setFocusRevision((value) => value + 1);
    setFocusHistory((h) => [...h.slice(0, focusIndex + 1), id]);
    setFocusIndex((i) => i + 1);
    setSelection({ id, edge: false });
  }
  function jumpFocus(index: number) {
    cancel();
    setFocusRevision((value) => value + 1);
    setFocusIndex(index);
    setSelection({ id: focusHistory[index] ?? '', edge: false });
  }
  function snapshot(p: Positions, v: Viewport) {
    positionsRef.current = p;
    viewportRef.current = v;
  }
  async function saveView() {
    const root = ledger.roots[0];
    if (!root || !viewName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.save(
        'views',
        {
          label: viewName.trim(),
          description: '',
          status: 'active',
          root: root.id,
          filters,
          expandedNodes: Object.keys(ledger.expansions),
          positions: positionsRef.current,
          viewport: viewportRef.current,
        },
        saveKey,
      );
      setMessage('View salva.');
      setSaveKey(crypto.randomUUID());
      setViewName('');
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="map-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Seu recorte de conhecimento</p>
          <h1>Explorar mapa</h1>
        </div>
        <Link className="button" to="/edit/nodes">
          Novo ponto
        </Link>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search.trim());
        }}
      >
        <label>
          Buscar ponto
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Autor, tradição, conceito ou obra"
          />
        </label>
        <button>Buscar</button>
      </form>
      <details className="filters">
        <summary>Filtros do mapa</summary>
        <div className="form-grid">
          <label>
            Tipo
            <select
              value={filters.kind}
              onChange={(e) =>
                changeFilters({ ...filters, kind: e.target.value })
              }
            >
              <option value="">Todos</option>
              {catalog.data?.kinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contexto
            <select
              value={filters.context}
              onChange={(e) =>
                changeFilters({ ...filters, context: e.target.value })
              }
            >
              <option value="">Todos</option>
              {contexts.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ano inicial (astronômico)
            <input
              type="number"
              value={filters.from ?? ''}
              onChange={(e) =>
                changeFilters({
                  ...filters,
                  from: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Ano final (astronômico)
            <input
              type="number"
              value={filters.to ?? ''}
              onChange={(e) =>
                changeFilters({
                  ...filters,
                  to: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.unknown}
              onChange={(e) =>
                changeFilters({ ...filters, unknown: e.target.checked })
              }
            />
            Incluir período desconhecido
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.pending}
              onChange={(e) =>
                changeFilters({ ...filters, pending: e.target.checked })
              }
            />
            Mostrar pendentes
          </label>
        </div>
        <p>Ano 0 = 1 a.C.; −1 = 2 a.C. Contexto não prova influência.</p>
      </details>
      {contexts.error && (
        <Failure error={contexts.error} retry={() => void contexts.refetch()} />
      )}
      {term && (
        <div className="search-results" aria-label="Resultados da busca">
          {results.isPending && <p role="status">Buscando…</p>}
          {results.error && (
            <Failure
              error={results.error}
              retry={() => void results.refetch()}
            />
          )}
          {results.data?.pages
            .flatMap((p) => p.items)
            .map((n) => (
              <button
                className="result"
                key={n.id}
                onClick={() => chooseRoot(n)}
              >
                <strong>{n.label}</strong>
                <small>
                  {catalog.data?.kinds.find((k) => k.id === n.kind)?.label ??
                    n.kind}{' '}
                  · {n.description}
                </small>
                <small>ID: {n.id}</small>
              </button>
            ))}
          {results.data?.pages[0]?.items.length === 0 && (
            <p>Nenhum ponto encontrado.</p>
          )}
          {results.hasNextPage && (
            <button
              disabled={results.isFetchingNextPage}
              onClick={() => void results.fetchNextPage()}
            >
              Mais resultados
            </button>
          )}
        </div>
      )}
      {error !== null && <Failure error={error} />}
      {message && (
        <p role="status" className="status">
          {message}
        </p>
      )}
      {catalog.isPending && <p role="status">Carregando catálogo…</p>}
      {catalog.error && (
        <Failure error={catalog.error} retry={() => void catalog.refetch()} />
      )}
      {catalog.data && (
        <>
          <div className="toolbar">
            <button
              onClick={() => {
                applyPositions(positionsRef.current);
                applyViewport(viewportRef.current);
                setList((v) => !v);
              }}
              aria-pressed={list}
            >
              {list ? 'Mostrar grafo' : 'Modo lista'}
            </button>
            <button
              disabled={focusIndex <= 0}
              onClick={() => jumpFocus(focusIndex - 1)}
            >
              Voltar foco
            </button>
            <button
              disabled={focusIndex >= focusHistory.length - 1}
              onClick={() => jumpFocus(focusIndex + 1)}
            >
              Avançar foco
            </button>
            <button
              disabled={list || !data.nodes.length}
              onClick={() => setFitRevision((value) => value + 1)}
            >
              Ajustar mapa à tela
            </button>
            <span>
              {data.nodes.length}/500 pontos · {data.relations.length} relações
            </span>
          </div>
          <div className="map-workspace">
            <div className="map-surface">
              {data.nodes.length === 0 ? (
                <div className="empty">
                  <h2>Uma ideia é o começo</h2>
                  <p>
                    Busque e selecione um ponto para explorar suas conexões.
                  </p>
                </div>
              ) : list ? (
                <div className="graph-list">
                  <h2>Pontos</h2>
                  {data.nodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setSelection({ id: n.id, edge: false });
                        setPanelOpen(true);
                      }}
                    >
                      {n.label}
                    </button>
                  ))}
                  <h2>Relações</h2>
                  {data.relations.length === 0 && (
                    <p>Expanda um ponto para encontrar relações.</p>
                  )}
                  {data.relations.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelection({ id: r.id, edge: true });
                        setPanelOpen(true);
                      }}
                    >
                      {data.nodes.find((n) => n.id === r.sourceId)?.label} —{' '}
                      {catalog.data.predicates.find((p) => p.id === r.type)
                        ?.label ?? r.type}{' '}
                      — {data.nodes.find((n) => n.id === r.targetId)?.label} (
                      {evidenceLabels[r.evidenceStatus]})
                      {r.contested ? ' · Contestada' : ''}
                    </button>
                  ))}
                </div>
              ) : (
                <Suspense fallback={<p role="status">Preparando mapa…</p>}>
                  <GraphCanvas
                    nodes={data.nodes}
                    relations={data.relations}
                    catalog={catalog.data}
                    selected={selection.id}
                    onSelect={(id, edge) => {
                      setSelection({ id, edge });
                      setPanelOpen(true);
                    }}
                    positions={positions}
                    viewport={viewport}
                    onSnapshot={snapshot}
                    focus={focusHistory[focusIndex] ?? ''}
                    focusRevision={focusRevision}
                    fitRevision={fitRevision}
                  />
                </Suspense>
              )}
            </div>
            <aside className="details-panel" aria-label="Detalhes e evidências">
              <button
                className="subtle"
                aria-expanded={panelOpen}
                aria-controls="panel-content"
                onClick={() => setPanelOpen((value) => !value)}
              >
                {panelOpen ? 'Recolher painel' : 'Abrir painel'}
              </button>
              <div id="panel-content" hidden={!panelOpen}>
                {!selection.id ? (
                  <p>Selecione um ponto ou fio para ler os detalhes.</p>
                ) : selection.edge ? (
                  <RelationPanel id={selection.id} catalog={catalog.data} />
                ) : (
                  <NodePanel
                    id={selection.id}
                    catalog={catalog.data}
                    contexts={contexts.data ?? []}
                  />
                )}
                {selection.id && !selection.edge && (
                  <div className="actions">
                    <button
                      disabled={
                        busy.includes(selection.id) ||
                        (!!ledger.expansions[selection.id] &&
                          ledger.expansions[selection.id]?.nextCursor === null)
                      }
                      onClick={() => void expand(selection.id)}
                    >
                      {busy.includes(selection.id)
                        ? 'Carregando…'
                        : ledger.expansions[selection.id]
                          ? 'Mais conexões'
                          : 'Expandir conexões'}
                    </button>
                    <button
                      disabled={!ledger.expansions[selection.id]}
                      onClick={() => {
                        cancel();
                        const next = reduceLedger(ledger, {
                          type: 'collapse',
                          id: selection.id,
                        });
                        dispatch({ type: 'collapse', id: selection.id });
                        const retained = new Set(
                          visible(next).nodes.map((node) => node.id),
                        );
                        const history = focusHistory.filter((id) =>
                          retained.has(id),
                        );
                        setFocusHistory(history);
                        setFocusIndex(history.length - 1);
                        setSaveKey(crypto.randomUUID());
                        setMessage(
                          'Expansão recolhida. Pontos compartilhados preservados.',
                        );
                      }}
                    >
                      Recolher expansão
                    </button>
                    <button onClick={() => center(selection.id)}>
                      Centralizar
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
          <details className="legend">
            <summary>Como ler o mapa</summary>
            <p>
              ○ Pessoa · ⬡ Tradição · ◇ Conceito · ▭ Obra. Tamanho limitado pelo
              total de conexões informado pela API.
            </p>
            <p>
              Linha contínua: documentada. Tracejada: interpretação atribuída.
              Pontilhada: inferência. Espessura: intensidade (1 pontual, 2
              relevante, 3 central; sem avaliação = neutra).
            </p>
            <p>
              Setas indicam direção; relações simétricas não têm seta. A
              disposição é visual, sem escala de distância histórica. Arraste
              para fixar posições. Rosa indica contestação, também identificada
              no painel.
            </p>
            <ul>
              {[...new Set(data.nodes.flatMap((n) => n.contexts))]
                .sort()
                .map((id, i) => (
                  <li key={id}>
                    <span
                      className={`context-dot context-${i % 4}`}
                      aria-hidden="true"
                    />
                    {contexts.data?.find((c) => c.id === id)?.label ?? id}
                  </li>
                ))}
              <li>
                Sem contexto: neutro. Vários contextos aparecem no painel; a cor
                usa o primeiro contexto.
              </li>
            </ul>
          </details>
          <form
            className="save-view"
            onSubmit={(e) => {
              e.preventDefault();
              void saveView();
            }}
          >
            <label>
              Nome da view
              <input
                value={viewName}
                onChange={(e) => {
                  setViewName(e.target.value);
                  setSaveKey(crypto.randomUUID());
                }}
                required
                maxLength={120}
              />
            </label>
            <button disabled={!ledger.roots.length || saving}>
              Salvar view
            </button>
          </form>
        </>
      )}
    </section>
  );
}
export const evidenceLabels = {
  documented: 'Documentada',
  attributed_interpretation: 'Interpretação atribuída',
  inference: 'Inferência / hipótese',
};
function NodePanel({
  id,
  catalog,
  contexts,
}: {
  id: string;
  catalog: Catalog;
  contexts: Context[];
}) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['node', id],
    queryFn: ({ signal }) => api.node(id, signal),
  });
  if (query.isPending) return <p role="status">Carregando ponto…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const n = query.data;
  return (
    <>
      <p className="eyebrow">
        {catalog.kinds.find((k) => k.id === n.kind)?.label ?? n.kind}
      </p>
      <h2>{n.label}</h2>
      <p>{n.description}</p>
      {n.aliases.length > 0 && <p>Também chamado: {n.aliases.join(', ')}</p>}
      {n.conceptScope && <p>Interpretação: {n.conceptScope}</p>}
      <p>
        Estado editorial: {editorialLabels[n.status]} · {n.degreeTotal} conexões
        no total
      </p>
      {n.contexts.map((id) => {
        const c = contexts.find((c) => c.id === id);
        return (
          <p className="badge-light" key={id}>
            {c?.label ?? id} {c && formatPeriod(c.period)}
          </p>
        );
      })}
      <div className="links">
        <Link to={`/edit/nodes/${n.id}`}>Editar ponto</Link>
        <Link to={`/history/nodes/${n.id}`}>Histórico</Link>
      </div>
    </>
  );
}
function RelationPanel({ id, catalog }: { id: string; catalog: Catalog }) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['relation', id],
    queryFn: ({ signal }) => api.relation(id, signal),
  });
  if (query.isPending) return <p role="status">Carregando evidências…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const r: Relation = query.data;
  const predicate = catalog.predicates.find((p) => p.id === r.type);
  return (
    <>
      <p className="eyebrow">Relação · {predicate?.label ?? r.type}</p>
      <h2>{r.claim}</h2>
      <p>{r.justification}</p>
      <p>{evidenceLabels[r.evidenceStatus]}</p>
      {r.contested && <strong className="contested">Contestada</strong>}
      <p>Estado editorial: {editorialLabels[r.status]}</p>
      <p>
        Intensidade: {r.intensity ?? 'Não avaliada'} · {r.intensityReason}
      </p>
      <p>Atribuição: {r.attribution || 'Não informada'}</p>
      <p>
        {predicate?.symmetric
          ? 'Relação simétrica'
          : `Direção: ${r.sourceId} → ${r.targetId}. ${predicate?.inverse ?? ''}`}
      </p>
      {r.context && <ContextEvidence id={r.context} />}
      <h3>Evidências</h3>
      {r.evidence.length === 0 && (
        <p>
          Nenhuma evidência cadastrada. A classificação é informada pela API.
        </p>
      )}
      {r.evidence.map((e, i) => (
        <div className="evidence" key={`${e.sourceId}-${i}`}>
          <p>
            {
              {
                supports: 'Sustenta',
                challenges: 'Contesta',
                contextualizes: 'Contextualiza',
              }[e.role]
            }{' '}
            · Fonte {e.sourceRole === 'primary' ? 'primária' : 'secundária'}{' '}
            para esta afirmação
          </p>
          <blockquote>{e.excerpt}</blockquote>
          <p>{e.locator}</p>
          <SourceEvidence id={e.sourceId} />
        </div>
      ))}
      <div className="links">
        <Link to={`/edit/relations/${r.id}`}>Editar relação</Link>
        <Link to={`/history/relations/${r.id}`}>Histórico</Link>
      </div>
    </>
  );
}
function SourceEvidence({ id }: { id: string }) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['sources', id],
    queryFn: ({ signal }) => api.detail('sources', id, signal),
  });
  if (query.isPending) return <p role="status">Carregando fonte…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const source = query.data as Source;
  return (
    <p>
      <SafeLink url={source.url}>{source.label}</SafeLink> · {source.author}
    </p>
  );
}
function ContextEvidence({ id }: { id: string }) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['contexts', id],
    queryFn: ({ signal }) => api.detail('contexts', id, signal),
  });
  if (query.isPending) return <p role="status">Carregando contexto…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const context = query.data as Context;
  return (
    <p>
      Contexto: {context.label} · {context.region} ·{' '}
      {formatPeriod(context.period)}
    </p>
  );
}
