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
import { Link, NavLink, useSearchParams } from 'react-router-dom';
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
import { contextColors, neutralColor } from '../graph/styles/palette';
const initialViewport: Viewport = { zoom: 1, pan: { x: 0, y: 0 } };
function prefersReducedMotion() {
  // jsdom (Vitest) não implementa matchMedia; trate como "sem preferência".
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
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
  const [flowEnabled, setFlowEnabled] = useState(() => !prefersReducedMotion());
  const [focusRevision, setFocusRevision] = useState(0);
  const [fitRevision, setFitRevision] = useState(0);
  const [zoomCommand, setZoomCommand] = useState({ revision: 0, factor: 1 });
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
    zoomCommand,
    setZoomCommand,
    selection,
    setSelection,
    setPanelOpen,
    positions,
    viewport,
    snapshot,
    focusRevision,
    panelOpen,
    flowEnabled,
    setFlowEnabled,
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
const railSections: {
  to: string;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    to: '/map',
    label: 'Explorar mapa',
    icon: (
      <>
        <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </>
    ),
  },
  {
    to: '/nodes',
    label: 'Pontos',
    icon: (
      <>
        <circle cx="7" cy="7" r="2.2" />
        <circle cx="17" cy="7" r="2.2" />
        <circle cx="12" cy="17" r="2.2" />
      </>
    ),
  },
  {
    to: '/relations',
    label: 'Relações',
    icon: (
      <>
        <circle cx="5" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" />
        <path d="M7 12h10" />
        <path d="M14 9l3 3-3 3" />
      </>
    ),
  },
  {
    to: '/sources',
    label: 'Fontes',
    icon: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v15H7.5A3.5 3.5 0 0 0 4 20.5z" />
        <path d="M8 7h8M8 11h6" />
      </>
    ),
  },
  {
    to: '/contexts',
    label: 'Contextos',
    icon: <path d="M3 7h18M3 12h12M3 17h8" />,
  },
  {
    to: '/imports',
    label: 'Importações',
    icon: (
      <>
        <path d="M12 3v11" />
        <path d="M8 10l4 4 4-4" />
        <path d="M4 17h16v4H4z" />
      </>
    ),
  },
  {
    to: '/pending',
    label: 'Pendências',
    icon: <path d="M6 3v18M6 4h11l-3 4 3 4H6" />,
  },
  {
    to: '/views',
    label: 'Views salvas',
    icon: <path d="M6 3h12v18l-6-4-6 4z" />,
  },
  {
    to: '/export',
    label: 'Exportar dados',
    icon: (
      <>
        <path d="M12 16V5" />
        <path d="M8 9l4-4 4 4" />
        <path d="M4 17h16v4H4z" />
      </>
    ),
  },
];
function AtlasRail() {
  return (
    <nav className="map-rail" aria-label="Seções">
      {railSections.map((item) => (
        <NavLink key={item.to} to={item.to} end aria-label={item.label}>
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {item.icon}
          </svg>
          <span className="rail-tip" aria-hidden="true">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
export function MapPage() {
  const model = useMapController();
  return (
    <section className="map-page">
      <div className="map-top">
        <Link className="map-brand" to="/map">
          <span className="map-brand-mark" aria-hidden="true" />
          <span className="map-brand-name">Idea Sonar</span>
        </Link>
        <h1 aria-label="Explorar mapa">atlas de influência</h1>
        <div className="map-search">
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
          <SearchResults model={model} />
        </div>
        <FilterControls model={model} />
        <Link className="button" to="/edit/nodes">
          Novo ponto
        </Link>
      </div>
      {model.contexts.error && (
        <Failure
          error={model.contexts.error}
          retry={() => void model.contexts.refetch()}
        />
      )}
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
const evidenceBadges = {
  documented: 'DOC',
  attributed_interpretation: 'ATR',
  inference: 'INF',
};
function relationRowLabel(
  nodeId: string,
  r: Relation,
  predicate: RelationType | undefined,
): string {
  const outgoing = r.sourceId === nodeId;
  if (!outgoing && !predicate?.symmetric && predicate?.inverseLabel)
    return predicate.inverseLabel;
  return predicate?.label ?? r.type;
}
function RelationRow({
  nodeId,
  r,
  catalog,
  nodes,
  active,
  onPick,
}: {
  nodeId: string;
  r: Relation;
  catalog: Catalog;
  nodes: Node[];
  active: boolean;
  onPick: (id: string) => void;
}) {
  const predicate = catalog.relationTypes.find((t) => t.code === r.type);
  const otherId = r.sourceId === nodeId ? r.targetId : r.sourceId;
  return (
    <li>
      <button
        type="button"
        className={active ? 'active' : ''}
        aria-pressed={active}
        onClick={() => onPick(r.id)}
      >
        <span className="relation-predicate">
          {relationRowLabel(nodeId, r, predicate)} →
        </span>{' '}
        <strong>
          <NodeName id={otherId} nodes={nodes} />
        </strong>
        <span className="relation-badge">
          {evidenceBadges[r.evidenceStatus]}
        </span>
        {r.contested && (
          <span className="contested relation-contested"> Contestada</span>
        )}
      </button>
    </li>
  );
}
function NodeRelationsList({
  nodeId,
  relations,
  catalog,
  nodes,
  activeId,
  onPick,
}: {
  nodeId: string;
  relations: Relation[];
  catalog: Catalog;
  nodes: Node[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  const connected = relations.filter(
    (r) => r.sourceId === nodeId || r.targetId === nodeId,
  );
  if (connected.length === 0)
    return <p>Nenhuma relação carregada para este ponto ainda.</p>;
  return (
    <ul className="relation-list">
      {connected.map((r) => (
        <RelationRow
          key={r.id}
          nodeId={nodeId}
          r={r}
          catalog={catalog}
          nodes={nodes}
          active={r.id === activeId}
          onPick={onPick}
        />
      ))}
    </ul>
  );
}
function RelationSources({ id, heading }: { id: string; heading?: string }) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['relation', id],
    queryFn: ({ signal }) => api.relation(id, signal),
  });
  if (query.isPending) return <p role="status">Carregando fontes…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const relation: Relation = query.data;
  return (
    <>
      <h3>Fontes{heading ? ` · ${heading}` : ''}</h3>
      {relation.evidence.length === 0 && (
        <p>
          Nenhuma evidência cadastrada. A classificação é informada pela API.
        </p>
      )}
      {relation.evidence.map((evidence, index) => (
        <SourceEvidence
          key={`${evidence.sourceId ?? 'sem-fonte'}-${index}`}
          evidence={evidence}
          index={index}
        />
      ))}
    </>
  );
}
function NodePanel({
  id,
  contexts,
  relations,
  catalog,
  nodes,
}: {
  id: string;
  contexts: Context[];
  relations: Relation[];
  catalog: Catalog;
  nodes: Node[];
}) {
  const { api } = useServices();
  const [activeRelationId, setActiveRelationId] = useState('');
  const query = useQuery({
    queryKey: ['node', id],
    queryFn: ({ signal }) => api.node(id, signal),
  });
  if (query.isPending) return <p role="status">Carregando ponto…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  const n = query.data;
  const connected = relations.filter(
    (r) => r.sourceId === n.id || r.targetId === n.id,
  );
  const activeId = connected.some(
    (relation) => relation.id === activeRelationId,
  )
    ? activeRelationId
    : (connected[0]?.id ?? '');
  return (
    <>
      <p className="panel-meta">
        {kindLabels[n.kind]} · {editorialLabels[n.status]} · {n.degreeTotal}{' '}
        conexões no total
      </p>
      <h2>{n.label}</h2>
      {n.contexts.length > 0 && (
        <p className="node-context">
          {n.contexts
            .map((contextId) => {
              const context = contexts.find((item) => item.id === contextId);
              return context
                ? `${context.label}${context.periodLabel ? ` · ${context.periodLabel}` : ''}`
                : contextId;
            })
            .join(' / ')}
        </p>
      )}
      <p>{n.description}</p>
      {n.aliases.length > 0 && (
        <p>
          Também chamado: {n.aliases.map((alias) => alias.alias).join(', ')}
        </p>
      )}
      {n.conceptScope && <p>Escopo: {conceptScopeLabels[n.conceptScope]}</p>}
      <h3>Relações</h3>
      <NodeRelationsList
        nodeId={n.id}
        relations={relations}
        catalog={catalog}
        nodes={nodes}
        activeId={activeId}
        onPick={setActiveRelationId}
      />
      {activeId && (
        <RelationSources
          id={activeId}
          heading={(() => {
            const relation = connected.find((item) => item.id === activeId);
            if (!relation) return '';
            const target = nodes.find(
              (item) =>
                item.id ===
                (relation.sourceId === n.id
                  ? relation.targetId
                  : relation.sourceId),
            );
            return `${catalog.relationTypes.find((item) => item.code === relation.type)?.label ?? relation.type} ${target?.label ?? ''}`;
          })()}
        />
      )}
      <div className="links">
        <Link to={`/edit/nodes/${n.id}`}>Editar ponto</Link>
        <Link to={`/history/nodes/${n.id}`}>Histórico</Link>
      </div>
    </>
  );
}
function RelationPanel({
  id,
  catalog,
  nodes,
}: {
  id: string;
  catalog: Catalog;
  nodes: Node[];
}) {
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
      <h2>{r.claim}</h2>
      <p className="panel-meta">
        Relação · {predicate?.label ?? r.type} ·{' '}
        {evidenceLabels[r.evidenceStatus]}
        {r.contested && (
          <>
            {' · '}
            <strong className="contested">Contestada</strong>
          </>
        )}
      </p>
      <p>{r.justification}</p>
      <RelationMetadata r={r} predicate={predicate} nodes={nodes} />
      <RelationSources id={r.id} />
      <div className="links">
        <Link to={`/edit/relations/${r.id}`}>Editar relação</Link>
        <Link to={`/history/relations/${r.id}`}>Histórico</Link>
      </div>
    </>
  );
}
function SourceEvidence({
  evidence,
  index,
}: {
  evidence: Relation['evidence'][number];
  index: number;
}) {
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['sources', evidence.sourceId],
    queryFn: ({ signal }) => api.detail('sources', evidence.sourceId!, signal),
    enabled: !!evidence.sourceId,
  });
  if (evidence.sourceId && query.isPending)
    return <p role="status">Carregando fonte…</p>;
  if (query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <SourceEvidenceBody
      evidence={evidence}
      index={index}
      source={query.data as Source | undefined}
    />
  );
}
function SourceEvidenceBody({
  evidence,
  index,
  source,
}: {
  evidence: Relation['evidence'][number];
  index: number;
  source: Source | undefined;
}) {
  const reference = source?.publicationLabel ?? source?.doi;
  return (
    <div className="evidence">
      <span className="evidence-index">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div>
        <p className="evidence-title">
          <EvidenceTitle source={source} />
        </p>
        {evidence.excerpt && <blockquote>{evidence.excerpt}</blockquote>}
        {source && (
          <p className="evidence-author">
            {source.authorText}
            {reference ? ` · ${reference}` : ''}
          </p>
        )}
        <p className="evidence-meta">
          {stanceLabels[evidence.stance]} ·{' '}
          {sourceKindLabels[evidence.sourceKind]}
          {evidence.locator ? ` · ${evidence.locator}` : ''}
        </p>
        {evidence.explanation && <p>{evidence.explanation}</p>}
        {evidence.conversationReference && (
          <p>Conversa: {evidence.conversationReference}</p>
        )}
      </div>
    </div>
  );
}
function EvidenceTitle({ source }: { source: Source | undefined }) {
  if (!source) return <>Evidência sem fonte vinculada</>;
  return source.canonicalUrl ? (
    <SafeLink url={source.canonicalUrl}>{source.title}</SafeLink>
  ) : (
    <>{source.title}</>
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
      <div className="filters-panel">
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
                  endYear:
                    e.target.value === '' ? null : Number(e.target.value),
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
      </div>
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
            onClick={() => {
              model.chooseRoot(n);
              model.setTerm('');
              model.setSearch('');
            }}
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

/**
 * Controles secundários discretos no rodapé do mapa — referência não tem
 * barra de ferramentas separada empurrando o canvas para baixo.
 */
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
      {!model.list && (
        <button
          type="button"
          className="flow-toggle"
          aria-pressed={model.flowEnabled}
          onClick={() => model.setFlowEnabled((value) => !value)}
        >
          Fluxo
        </button>
      )}
    </div>
  );
}
/** Canto inferior direito do canvas, como na referência — não entra no
 * fluxo normal da página (posicionado sobre o mapa, não empurra nada). */
function MapCornerControls({ model }: { model: MapModel }) {
  if (model.list) return null;
  return (
    <div className="map-corner-controls">
      {[
        { factor: 1.2, label: 'Aumentar zoom', glyph: '+' },
        { factor: 1 / 1.2, label: 'Diminuir zoom', glyph: '−' },
      ].map(({ factor, label, glyph }) => (
        <button
          key={label}
          className="subtle"
          aria-label={label}
          title={label}
          disabled={!model.data.nodes.length}
          onClick={() =>
            model.setZoomCommand((previous) => ({
              revision: previous.revision + 1,
              factor,
            }))
          }
        >
          {glyph}
        </button>
      ))}
      <button
        className="subtle"
        disabled={!model.data.nodes.length}
        onClick={() => model.setFitRevision((value) => value + 1)}
        aria-label="Ajustar mapa à tela"
        title="Ajustar mapa à tela"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
        </svg>
        <span className="map-corner-label">Ajustar mapa à tela</span>
      </button>
    </div>
  );
}

/**
 * Âncora de cada título de contexto: centro horizontal e topo do cluster de
 * nós carregados que pertencem a ele (primeiro contexto de cada ponto, mesma
 * convenção de `elements.ts`). Não há coordenada de contexto na API — isso é
 * só uma anotação visual sobre posições reais já carregadas; contextos sem
 * nenhum nó visível, ou nós ainda sem posição aplicada, simplesmente não
 * geram título (fallback seguro, nunca quebra).
 */
function contextGroups(nodes: Node[], contexts: Context[]) {
  return contexts.flatMap((context) => {
    const nodeIds = nodes
      .filter((node) => node.contexts[0] === context.id)
      .map((node) => node.id);
    return nodeIds.length
      ? [
          {
            id: context.id,
            label: context.label,
            period: context.periodLabel ?? formatPeriod(context),
            nodeIds,
          },
        ]
      : [];
  });
}
function MapDisplay({ model, catalog }: { model: MapModel; catalog: Catalog }) {
  const groups = useMemo(
    () => contextGroups(model.data.nodes, model.contexts.data ?? []),
    [model.data.nodes, model.contexts.data],
  );
  return (
    <div className="map-surface">
      <MapCornerControls model={model} />
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
            zoomCommand={model.zoomCommand}
            flowEnabled={model.flowEnabled}
            groups={groups}
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
          <RelationPanel
            key={model.selection.id}
            id={model.selection.id}
            catalog={catalog}
            nodes={model.data.nodes}
          />
        ) : (
          <NodePanel
            key={model.selection.id}
            id={model.selection.id}
            contexts={model.contexts.data ?? []}
            relations={model.data.relations}
            catalog={catalog}
            nodes={model.data.nodes}
          />
        )}
        {model.selection.id && !model.selection.edge && (
          <NodeActions model={model} />
        )}
        <SaveView model={model} />
      </div>
    </aside>
  );
}

const kindGlyphs = {
  person: <circle cx="7" cy="7" r="3" />,
  tradition: (
    <>
      <path d="M2 4h10" />
      <path d="M2 7h10" />
      <path d="M2 10h10" />
    </>
  ),
  concept: <polygon points="7,1.25 12.75,7 7,12.75 1.25,7" />,
  work: <rect x="1.5" y="2.75" width="11" height="8.5" />,
} as const;
function KindKey() {
  return (
    <ul className="kind-key">
      {(['person', 'tradition', 'concept', 'work'] as const).map((kind) => (
        <li key={kind}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            aria-hidden="true"
            fill={`${neutralColor}26`}
            stroke={neutralColor}
            strokeWidth="1.25"
          >
            {kindGlyphs[kind]}
          </svg>
          {kindLabels[kind]}
        </li>
      ))}
    </ul>
  );
}
function MapLegend({ model }: { model: MapModel }) {
  return (
    <div className="legend">
      <details>
        <summary>Como ler o mapa</summary>
        <ul className="legend-dots">
          {[...new Set(model.data.nodes.flatMap((n) => n.contexts))]
            .sort()
            .map((id, i) => {
              const color = contextColors[i % contextColors.length] ?? '';
              return (
                <li key={id}>
                  <span
                    className="context-dot"
                    style={{ color, background: `${color}26` }}
                    aria-hidden="true"
                  />
                  {model.contexts.data?.find((c) => c.id === id)?.label ?? id}
                </li>
              );
            })}
        </ul>
        <KindKey />
        <p>
          Cada ponto é uma etiqueta: o símbolo à esquerda do rótulo diz o tipo.
        </p>
        <p>
          Linha contínua: documentada. Tracejada: interpretação atribuída.
          Pontilhada: inferência. Espessura: intensidade (1 pontual, 2
          relevante, 3 central; sem avaliação = neutra).
        </p>
        <p>
          Setas indicam direção; relações simétricas não têm seta. Com o fluxo
          ativo, uma pequena marca percorre as relações direcionais da seleção,
          de origem para destino. A disposição é visual, sem escala de distância
          histórica. Arraste para fixar posições. Contestação é sinalizada no
          painel de detalhes, não na cor do traço.
        </p>
        <p>
          Ao selecionar, o restante do desenho recua para destacar a vizinhança.
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
      <button disabled={!model.ledger.roots.length || model.saving}>
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

function StageFooter({ model }: { model: MapModel }) {
  return (
    <div className="stage-footer">
      {/* Modo lista/foco precisam ficar visíveis mesmo em modo lista — é
          como se volta para o grafo — diferente da régua/legenda abaixo,
          que só fazem sentido lendo o desenho. */}
      <MapToolbar model={model} />
      {!model.list && (
        <>
          <InstrumentBar model={model} />
          <MapLegend model={model} />
        </>
      )}
    </div>
  );
}

function ReadyMap({ model }: { model: MapModel }) {
  const catalog = model.catalog.data;
  if (!catalog) return null;
  return (
    <div className="map-body">
      <AtlasRail />
      <div className="map-stage">
        <MapDisplay model={model} catalog={catalog} />
        <StageFooter model={model} />
      </div>
      <MapDetails model={model} catalog={catalog} />
    </div>
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
  nodes,
}: {
  r: Relation;
  predicate: RelationType | undefined;
  nodes: Node[];
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
      <RelationDirection r={r} predicate={predicate} nodes={nodes} />
      {r.contextId && <ContextEvidence id={r.contextId} />}
    </>
  );
}
function relationAttribution(r: Relation) {
  return r.attributionText ?? r.inferenceAuthor ?? 'Não informada';
}
function NodeName({ id, nodes }: { id: string; nodes: Node[] }) {
  const { api } = useServices();
  const known = nodes.find((n) => n.id === id);
  const query = useQuery({
    queryKey: ['node', id],
    queryFn: ({ signal }) => api.node(id, signal),
    enabled: !known,
  });
  if (known) return <>{known.label}</>;
  if (query.data) return <>{query.data.label}</>;
  return <>{query.isPending ? 'carregando ponto…' : 'ponto não disponível'}</>;
}
function RelationDirection({
  r,
  predicate,
  nodes,
}: {
  r: Relation;
  predicate: RelationType | undefined;
  nodes: Node[];
}) {
  if (predicate?.symmetric)
    return (
      <p>
        Relação simétrica entre <NodeName id={r.sourceId} nodes={nodes} /> e{' '}
        <NodeName id={r.targetId} nodes={nodes} />.
      </p>
    );
  return (
    <p>
      Direção: <NodeName id={r.sourceId} nodes={nodes} />{' '}
      {predicate ? `${predicate.label} ` : ''}→{' '}
      <NodeName id={r.targetId} nodes={nodes} />.
      {predicate?.inverseLabel && (
        <>
          {' '}
          Leitura inversa: <NodeName id={r.targetId} nodes={nodes} />{' '}
          {predicate.inverseLabel} <NodeName id={r.sourceId} nodes={nodes} />.
        </>
      )}
    </p>
  );
}
