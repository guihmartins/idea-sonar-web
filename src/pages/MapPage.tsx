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
import { defaultFilters, toStoredFilters } from '../api/domain';
import type {
  Filters,
  Node,
  Relation,
  Catalog,
  RelationType,
  Source,
  Context,
} from '../api/domain';
import {
  conceptScopeLabels,
  kindLabels,
  sourceKindLabels,
  stanceLabels,
} from '../components/labels';
import type { Positions, Viewport } from '../graph/layout/positions';
import { restoreView } from '../graph/restore';
import { formatPeriod } from '../components/period';
import { contextColors } from '../graph/styles/palette';
const initialViewport: Viewport = { zoom: 1, pan: { x: 0, y: 0 } };
function useMapController() {
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
      const {
        view,
        filters: restoredFilters,
        root,
        ledger: restored,
        partial,
      } = await restoreView(
        api,
        viewId,
        controller.signal,
        () => latest.current.generation,
      );
      setFilters(restoredFilters);
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
        partial
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
        expansionCursor(ledger, id),
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
          name: viewName.trim(),
          status: 'active',
          rootNodeId: root.id,
          filters: toStoredFilters(filters),
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

  return {
    catalog,
    contexts,
    results,
    term,
    setTerm,
    search,
    setSearch,
    filters,
    changeFilters,
    chooseRoot,
    error,
    message,
    list,
    setList,
    applyPositions,
    positionsRef,
    applyViewport,
    viewportRef,
    focusIndex,
    focusHistory,
    jumpFocus,
    data,
    fitRevision,
    setFitRevision,
    selection,
    setSelection,
    setPanelOpen,
    positions,
    viewport,
    snapshot,
    focusRevision,
    panelOpen,
    ledger,
    busy,
    expand,
    cancel,
    dispatch,
    setMessage,
    setFocusHistory,
    setFocusIndex,
    setSaveKey,
    center,
    viewName,
    setViewName,
    saveView,
    saving,
  };
}
type MapModel = ReturnType<typeof useMapController>;
export function MapPage() {
  const model = useMapController();
  return (
    <section className="map-page">
      <div className="page-heading">
        <h1>Explorar mapa</h1>
        <Link className="button primary" to="/edit/nodes">
          Novo ponto
        </Link>
      </div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          model.setTerm(model.search.trim());
        }}
      >
        <label>
          Buscar ponto
          <input
            value={model.search}
            onChange={(e) => model.setSearch(e.target.value)}
            placeholder="Autor, tradição, conceito ou obra"
          />
        </label>
        <button className="primary">Buscar</button>
      </form>
      <FilterControls model={model} />
      {model.contexts.error && (
        <Failure
          error={model.contexts.error}
          retry={() => void model.contexts.refetch()}
        />
      )}
      <SearchResults model={model} />
      {model.error !== null && <Failure error={model.error} />}
      {model.message && (
        <p role="status" className="status">
          {model.message}
        </p>
      )}
      {model.catalog.isPending && <p role="status">Carregando catálogo…</p>}
      {model.catalog.error && (
        <Failure
          error={model.catalog.error}
          retry={() => void model.catalog.refetch()}
        />
      )}
      <ReadyMap model={model} />
    </section>
  );
}

export const evidenceLabels = {
  documented: 'Documentada',
  attributed_interpretation: 'Interpretação atribuída',
  inference: 'Inferência / hipótese',
};
function NodePanel({ id, contexts }: { id: string; contexts: Context[] }) {
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
      <p className="eyebrow">{kindLabels[n.kind]}</p>
      <h2>{n.label}</h2>
      <p>{n.description}</p>
      {n.aliases.length > 0 && (
        <p>Também chamado: {n.aliases.map((a) => a.alias).join(', ')}</p>
      )}
      {n.conceptScope && <p>Escopo: {conceptScopeLabels[n.conceptScope]}</p>}
      <p>
        Estado editorial: {editorialLabels[n.status]} · {n.degreeTotal} conexões
        no total
      </p>
      {n.contexts.map((id) => {
        const c = contexts.find((c) => c.id === id);
        return (
          <p className="badge-light" key={id}>
            {c?.label ?? id} {c && formatPeriod(c)}
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
  const predicate = catalog.relationTypes.find((t) => t.code === r.type);
  return (
    <>
      <p className="eyebrow">Relação · {predicate?.label ?? r.type}</p>
      <h2>{r.claim}</h2>
      <p>{r.justification}</p>
      <p>{evidenceLabels[r.evidenceStatus]}</p>
      {r.contested && <strong className="contested">Contestada</strong>}
      <RelationMetadata r={r} predicate={predicate} />
      <h3>Evidências</h3>
      {r.evidence.length === 0 && (
        <p>
          Nenhuma evidência cadastrada. A classificação é informada pela API.
        </p>
      )}
      {r.evidence.map((e, i) => (
        <div className="evidence" key={`${e.sourceId ?? 'sem-fonte'}-${i}`}>
          <p>
            {stanceLabels[e.stance]} · {sourceKindLabels[e.sourceKind]}
          </p>
          {e.excerpt && <blockquote>{e.excerpt}</blockquote>}
          <p>{e.locator}</p>
          <p>{e.explanation}</p>
          {e.conversationReference && (
            <p>Conversa: {e.conversationReference}</p>
          )}
          {e.sourceId && <SourceEvidence id={e.sourceId} />}
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
  const reference = source.publicationLabel ?? source.doi;
  return (
    <p>
      {source.canonicalUrl ? (
        <SafeLink url={source.canonicalUrl}>{source.title}</SafeLink>
      ) : (
        source.title
      )}{' '}
      · {source.authorText}
      {reference ? ` · ${reference}` : ''}
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
      Contexto: {context.label}
      {context.regionLabel ? ` · ${context.regionLabel}` : ''} ·{' '}
      {formatPeriod(context)}
    </p>
  );
}

function FilterControls({ model }: { model: MapModel }) {
  return (
    <details className="filters">
      <summary>Filtros do mapa</summary>
      <div className="form-grid">
        <label>
          Tipo
          <select
            value={model.filters.kind}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                kind: e.target.value as Filters['kind'],
              })
            }
          >
            <option value="">Todos</option>
            {model.catalog.data?.nodeKinds.map((k) => (
              <option key={k} value={k}>
                {kindLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contexto
          <select
            value={model.filters.contextId}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                contextId: e.target.value,
              })
            }
          >
            <option value="">Todos</option>
            {model.contexts.data?.map((c) => (
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
            value={model.filters.startYear ?? ''}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                startYear:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Ano final (astronômico)
          <input
            type="number"
            value={model.filters.endYear ?? ''}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                endYear: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.filters.includeUnknownPeriod}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                includeUnknownPeriod: e.target.checked,
              })
            }
          />
          Incluir período desconhecido
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={model.filters.includePending}
            onChange={(e) =>
              model.changeFilters({
                ...model.filters,
                includePending: e.target.checked,
              })
            }
          />
          Mostrar pendentes
        </label>
      </div>
      <p>Ano 0 = 1 a.C.; −1 = 2 a.C. Contexto não prova influência.</p>
    </details>
  );
}

function SearchResults({ model }: { model: MapModel }) {
  if (!model.term) return null;
  return (
    <div className="search-results" aria-label="Resultados da busca">
      {model.results.isPending && <p role="status">Buscando…</p>}
      {model.results.error && (
        <Failure
          error={model.results.error}
          retry={() => void model.results.refetch()}
        />
      )}
      {model.results.data?.pages
        .flatMap((p) => p.items)
        .map((n) => (
          <button
            className="result"
            key={n.id}
            onClick={() => model.chooseRoot(n)}
          >
            <strong>{n.label}</strong>
            <small>
              {kindLabels[n.kind]} · {n.description}
            </small>
            <small>ID: {n.id}</small>
          </button>
        ))}
      {model.results.data?.pages[0]?.items.length === 0 && (
        <p>Nenhum ponto encontrado.</p>
      )}
      {model.results.hasNextPage && (
        <button
          disabled={model.results.isFetchingNextPage}
          onClick={() => void model.results.fetchNextPage()}
        >
          Mais resultados
        </button>
      )}
    </div>
  );
}

function MapToolbar({ model }: { model: MapModel }) {
  return (
    <div className="toolbar">
      <button
        onClick={() => {
          model.applyPositions(model.positionsRef.current);
          model.applyViewport(model.viewportRef.current);
          model.setList((v) => !v);
        }}
        aria-pressed={model.list}
      >
        {model.list ? 'Mostrar grafo' : 'Modo lista'}
      </button>
      <button
        disabled={model.focusIndex <= 0}
        onClick={() => model.jumpFocus(model.focusIndex - 1)}
      >
        Voltar foco
      </button>
      <button
        disabled={model.focusIndex >= model.focusHistory.length - 1}
        onClick={() => model.jumpFocus(model.focusIndex + 1)}
      >
        Avançar foco
      </button>
      <button
        disabled={model.list || !model.data.nodes.length}
        onClick={() => model.setFitRevision((value) => value + 1)}
      >
        Ajustar mapa à tela
      </button>
    </div>
  );
}

function MapDisplay({ model, catalog }: { model: MapModel; catalog: Catalog }) {
  return (
    <div className="map-surface">
      {model.data.nodes.length === 0 ? (
        <div className="empty">
          <h2>Uma ideia é o começo</h2>
          <p>Busque e selecione um ponto para explorar suas conexões.</p>
        </div>
      ) : model.list ? (
        <div className="graph-list">
          <h2>Pontos</h2>
          {model.data.nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                model.setSelection({ id: n.id, edge: false });
                model.setPanelOpen(true);
              }}
            >
              {n.label}
            </button>
          ))}
          <h2>Relações</h2>
          {model.data.relations.length === 0 && (
            <p>Expanda um ponto para encontrar relações.</p>
          )}
          {model.data.relations.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                model.setSelection({ id: r.id, edge: true });
                model.setPanelOpen(true);
              }}
            >
              {model.data.nodes.find((n) => n.id === r.sourceId)?.label} —{' '}
              {catalog.relationTypes.find((t) => t.code === r.type)?.label ??
                r.type}{' '}
              — {model.data.nodes.find((n) => n.id === r.targetId)?.label} (
              {evidenceLabels[r.evidenceStatus]})
              {r.contested ? ' · Contestada' : ''}
            </button>
          ))}
        </div>
      ) : (
        <Suspense fallback={<p role="status">Preparando mapa…</p>}>
          <GraphCanvas
            nodes={model.data.nodes}
            relations={model.data.relations}
            catalog={catalog}
            selected={model.selection.id}
            onSelect={(id, edge) => {
              model.setSelection({ id, edge });
              model.setPanelOpen(true);
            }}
            positions={model.positions}
            viewport={model.viewport}
            onSnapshot={model.snapshot}
            focus={model.focusHistory[model.focusIndex] ?? ''}
            focusRevision={model.focusRevision}
            fitRevision={model.fitRevision}
          />
        </Suspense>
      )}
    </div>
  );
}

function MapDetails({ model, catalog }: { model: MapModel; catalog: Catalog }) {
  return (
    <aside className="details-panel" aria-label="Detalhes e evidências">
      <button
        className="subtle"
        aria-expanded={model.panelOpen}
        aria-controls="panel-content"
        onClick={() => model.setPanelOpen((value) => !value)}
      >
        {model.panelOpen ? 'Recolher painel' : 'Abrir painel'}
      </button>
      <div id="panel-content" hidden={!model.panelOpen}>
        {!model.selection.id ? (
          <p>Selecione um ponto ou fio para ler os detalhes.</p>
        ) : model.selection.edge ? (
          <RelationPanel id={model.selection.id} catalog={catalog} />
        ) : (
          <NodePanel
            id={model.selection.id}
            contexts={model.contexts.data ?? []}
          />
        )}
        {model.selection.id && !model.selection.edge && (
          <NodeActions model={model} />
        )}
      </div>
    </aside>
  );
}

function MapLegend({ model }: { model: MapModel }) {
  return (
    <div className="legend">
      <ul className="legend-dots">
        {[...new Set(model.data.nodes.flatMap((n) => n.contexts))]
          .sort()
          .map((id, i) => (
            <li key={id}>
              <span
                className="context-dot"
                style={{
                  background: contextColors[i % contextColors.length],
                }}
                aria-hidden="true"
              />
              {model.contexts.data?.find((c) => c.id === id)?.label ?? id}
            </li>
          ))}
      </ul>
      <details>
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
          Setas indicam direção; relações simétricas não têm seta. A disposição
          é visual, sem escala de distância histórica. Arraste para fixar
          posições. Rosa indica contestação, também identificada no painel.
        </p>
        <p>
          Sem contexto: neutro. Vários contextos aparecem no painel; a cor usa o
          primeiro contexto.
        </p>
      </details>
    </div>
  );
}

function SaveView({ model }: { model: MapModel }) {
  return (
    <form
      className="save-view"
      onSubmit={(e) => {
        e.preventDefault();
        void model.saveView();
      }}
    >
      <label>
        Nome da view
        <input
          value={model.viewName}
          onChange={(e) => {
            model.setViewName(e.target.value);
            model.setSaveKey(crypto.randomUUID());
          }}
          required
          maxLength={120}
        />
      </label>
      <button
        className="primary"
        disabled={!model.ledger.roots.length || model.saving}
      >
        Salvar view
      </button>
    </form>
  );
}

function InstrumentBar({ model }: { model: MapModel }) {
  const rootId = model.ledger.roots[0]?.id;
  const root = model.data.nodes.find((n) => n.id === rootId);
  return (
    <div className="instrument-bar">
      <span className="instrument-title">{root?.label ?? 'Sem raiz'}</span>
      <span className="instrument-count">
        {model.data.nodes.length}/500 pontos · {model.data.relations.length}{' '}
        relações
      </span>
    </div>
  );
}

function ReadyMap({ model }: { model: MapModel }) {
  const catalog = model.catalog.data;
  if (!catalog) return null;
  return (
    <>
      <div className="instrument">
        <InstrumentBar model={model} />
        <MapToolbar model={model} />
        <div className="map-workspace">
          <MapDisplay model={model} catalog={catalog} />
          <MapDetails model={model} catalog={catalog} />
        </div>
        <MapLegend model={model} />
      </div>
      <SaveView model={model} />
    </>
  );
}

function NodeActions({ model }: { model: MapModel }) {
  return (
    <div className="actions">
      <button
        disabled={
          model.busy.includes(model.selection.id) ||
          (!!model.ledger.expansions[model.selection.id] &&
            model.ledger.expansions[model.selection.id]?.nextCursor === null)
        }
        onClick={() => void model.expand(model.selection.id)}
      >
        {model.busy.includes(model.selection.id)
          ? 'Carregando…'
          : model.ledger.expansions[model.selection.id]
            ? 'Mais conexões'
            : 'Expandir conexões'}
      </button>
      <button
        disabled={!model.ledger.expansions[model.selection.id]}
        onClick={() => {
          model.cancel();
          const next = reduceLedger(model.ledger, {
            type: 'collapse',
            id: model.selection.id,
          });
          model.dispatch({ type: 'collapse', id: model.selection.id });
          const retained = new Set(visible(next).nodes.map((node) => node.id));
          const history = model.focusHistory.filter((id) => retained.has(id));
          model.setFocusHistory(history);
          model.setFocusIndex(history.length - 1);
          model.setSaveKey(crypto.randomUUID());
          model.setMessage(
            'Expansão recolhida. Pontos compartilhados preservados.',
          );
        }}
      >
        Recolher expansão
      </button>
      <button onClick={() => model.center(model.selection.id)}>
        Centralizar
      </button>
    </div>
  );
}
function expansionCursor(ledger: Ledger, id: string) {
  return ledger.expansions[id]?.nextCursor ?? null;
}

function RelationMetadata({
  r,
  predicate,
}: {
  r: Relation;
  predicate: RelationType | undefined;
}) {
  return (
    <>
      {' '}
      <p>Estado editorial: {editorialLabels[r.status]}</p>
      <p>
        Intensidade: {r.intensity ?? 'Não avaliada'}
        {r.intensityReason ? ` · ${r.intensityReason}` : ''}
      </p>
      <p>Atribuição: {relationAttribution(r)}</p>
      {r.contested && r.contestationNote && (
        <p>Contestação: {r.contestationNote}</p>
      )}
      <p>{relationDirection(r, predicate)}</p>
      {r.contextId && <ContextEvidence id={r.contextId} />}
    </>
  );
}
function relationAttribution(r: Relation) {
  return r.attributionText ?? r.inferenceAuthor ?? 'Não informada';
}
function relationDirection(r: Relation, predicate: RelationType | undefined) {
  if (predicate?.symmetric) return 'Relação simétrica';
  return `Direção: ${r.sourceId} → ${r.targetId}. ${predicate?.inverseLabel ?? ''}`;
}
