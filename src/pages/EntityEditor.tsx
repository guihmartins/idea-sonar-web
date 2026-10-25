import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { ApiError } from '../api/client';
import { defaultFilters, schemas } from '../api/domain';
import type {
  Entity,
  EntityType,
  Node,
  Relation,
  Context,
  Source,
} from '../api/domain';
import { Failure } from '../components/Feedback';
import { buildEditorBody } from './editor/payload';
import type { Editable } from './editor/payload';
import { typeLabels } from './RecordsPage';
const editable = ['nodes', 'relations', 'sources', 'contexts'] as const;
const isEditable = (type: string | undefined): type is Editable =>
  editable.some((value) => value === type);
export function EntityEditor() {
  const { type, id } = useParams();
  const { api } = useServices();
  const query = useQuery({
    queryKey: ['edit', type, id],
    queryFn: ({ signal }) => api.detail(type as EntityType, id ?? '', signal),
    enabled: !!id && isEditable(type),
  });
  if (!isEditable(type)) return <h1>Tipo de cadastro inválido</h1>;
  if (id && query.isPending) return <p role="status">Carregando registro…</p>;
  if (id && query.error)
    return <Failure error={query.error} retry={() => void query.refetch()} />;
  return (
    <EditorForm
      key={`${type}-${id ?? 'new'}`}
      type={type}
      initial={query.data}
    />
  );
}
function initialFields(entity?: Entity): Record<string, string> {
  const data: Record<string, string> = {
    label: '',
    description: '',
    kind: 'person',
    aliases: '',
    conceptScope: '',
    status: 'active',
    context: '',
    sourceId: '',
    targetId: '',
    type: '',
    claim: '',
    justification: '',
    evidenceStatus: 'inference',
    intensity: '',
    intensityReason: '',
    attribution: '',
    author: '',
    url: '',
    region: '',
    start: '',
    end: '',
    startEra: 'ce',
    endEra: 'ce',
  };
  if (!entity) return data;
  for (const [key, value] of Object.entries(entity))
    if (typeof value === 'string' || typeof value === 'number')
      data[key] = String(value);
  if ('aliases' in entity) data.aliases = entity.aliases.join(', ');
  if ('period' in entity) Object.assign(data, periodFields(entity.period));
  return data;
}
function useEditorForm(type: Editable, initial: Entity | undefined) {
  const { api } = useServices();
  const cache = useQueryClient();
  const [baseline, setBaseline] = useState(initial);
  const [fields, setFields] = useState(() => initialFields(initial));
  const metadata = editorMetadata(initial);
  const [contexts, setContexts] = useState(metadata.contexts);
  const [evidence, setEvidence] = useState(metadata.evidence);
  const [approximate, setApproximate] = useState(metadata.approximate);
  const [contested, setContested] = useState(metadata.contested);
  const [actionKey, setActionKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState<Entity | null>(null);
  const [archive, setArchive] = useState(false);
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => api.catalog(signal),
  });
  const options = useQuery({
    queryKey: ['editor-options'],
    queryFn: async ({ signal }) => {
      async function all(type: 'sources' | 'contexts') {
        const items: Entity[] = [];
        let cursor: string | null = null;
        do {
          const p = await api.list(type, cursor, signal);
          items.push(...p.items);
          cursor = p.nextCursor;
        } while (cursor);
        return items;
      }
      return {
        sources: (await all('sources')) as Source[],
        contexts: (await all('contexts')) as Context[],
      };
    },
  });
  function update(key: string, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setActionKey(crypto.randomUUID());
  }
  function text(
    key: string,
    label: string,
    required = false,
    multiline = false,
  ) {
    const id = `field-${type}-${key}`;
    return (
      <div className="form-field">
        <label htmlFor={id}>{label}</label>
        {multiline ? (
          <textarea
            id={id}
            required={required}
            value={fields[key] ?? ''}
            onChange={(e) => update(key, e.target.value)}
          />
        ) : (
          <input
            id={id}
            required={required}
            value={fields[key] ?? ''}
            onChange={(e) => update(key, e.target.value)}
            maxLength={key === 'label' ? 200 : 2000}
          />
        )}
      </div>
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    setMessage('');
    try {
      const body = await buildEditorBody(
        type,
        { fields, baseline, contexts, evidence, approximate, contested },
        catalog.data,
        api,
      );
      // Valida o modelo provisório sem enviar campos gerados pelo servidor.
      schemas[type].parse({
        ...body,
        id: baseline?.id ?? 'new',
        version: baseline?.version ?? 'new',
      });
      const saved = await api.save(type, body, actionKey, baseline);
      setBaseline(saved);
      setMessage('Registro salvo.');
      setActionKey(crypto.randomUUID());
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && [409, 412].includes(e.status) && baseline) {
        try {
          setConflict(await api.detail(type, baseline.id));
        } catch {
          setMessage(
            'Não foi possível carregar a versão atual. Tente salvar novamente para recarregar o conflito.',
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }
  async function doArchive() {
    if (!baseline) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.save(
        type,
        { status: 'archived' },
        actionKey,
        baseline,
      );
      setBaseline(saved);
      update('status', 'archived');
      setArchive(false);
      setMessage('Registro arquivado pela API.');
      await cache.invalidateQueries();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return {
    type,
    baseline,
    fields,
    contexts,
    evidence,
    approximate,
    contested,
    busy,
    error,
    message,
    conflict,
    archive,
    catalog,
    options,
    update,
    text,
    submit,
    doArchive,
    setContexts,
    setEvidence,
    setApproximate,
    setContested,
    setActionKey,
    setConflict,
    setError,
    setFields,
    setBaseline,
    setArchive,
  };
}
type EditorModel = ReturnType<typeof useEditorForm>;
function EditorForm({
  type,
  initial,
}: {
  type: Editable;
  initial: Entity | undefined;
}) {
  const model = useEditorForm(type, initial);
  return (
    <section>
      <Link to={`/${model.type}`}>
        Voltar a {typeLabels[model.type].toLocaleLowerCase('pt-BR')}
      </Link>
      <h1>
        {model.baseline ? 'Editar' : 'Cadastrar'}{' '}
        {
          {
            nodes: 'ponto',
            relations: 'relação',
            sources: 'fonte',
            contexts: 'contexto',
          }[model.type]
        }
      </h1>
      <EditorOptionsFeedback model={model} />
      <form onSubmit={(e) => void model.submit(e)} className="editor">
        <fieldset disabled={model.busy || !!model.conflict}>
          <legend>Dados do registro</legend>
          {model.text('label', 'Nome', true)}
          {model.text('description', 'Descrição', false, true)}
          <label>
            Estado editorial
            <select
              value={model.fields.status}
              onChange={(e) => model.update('status', e.target.value)}
            >
              <option value="active">Ativo</option>
              <option value="pending">Pendente</option>
              {model.fields.status === 'archived' && (
                <option value="archived">Arquivado</option>
              )}
            </select>
          </label>
          <TypeFields model={model} />

          <button
            disabled={
              model.catalog.isPending ||
              !!model.catalog.error ||
              !!model.options.error
            }
          >
            Salvar registro
          </button>
        </fieldset>
      </form>
      {model.error !== null && <Failure error={model.error} />}
      {model.message && <p role="status">{model.message}</p>}
      <ConflictPanel model={model} />
      <EditorActions model={model} />
    </section>
  );
}

function NodePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { api } = useServices();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const selected = useQuery({
    queryKey: ['node', value],
    queryFn: ({ signal }) => api.node(value, signal),
    enabled: !!value,
  });
  return (
    <fieldset>
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
      />
    </fieldset>
  );
}
function EvidenceFields({
  entry,
  sources,
  onChange,
  onRemove,
}: {
  entry: Relation['evidence'][number];
  sources: Source[];
  onChange: (entry: Relation['evidence'][number]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="evidence">
      <label>
        Fonte
        <select
          required
          value={entry.sourceId}
          onChange={(e) => onChange({ ...entry, sourceId: e.target.value })}
        >
          <option value="">Selecione uma fonte</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} · {s.author}
            </option>
          ))}
        </select>
      </label>
      <label>
        Papel da evidência
        <select
          value={entry.role}
          onChange={(e) =>
            onChange({ ...entry, role: e.target.value as typeof entry.role })
          }
        >
          <option value="supports">Sustenta</option>
          <option value="challenges">Contesta</option>
          <option value="contextualizes">Contextualiza</option>
        </select>
      </label>
      <label>
        Fonte relativa à afirmação
        <select
          value={entry.sourceRole}
          onChange={(e) =>
            onChange({
              ...entry,
              sourceRole: e.target.value as typeof entry.sourceRole,
            })
          }
        >
          <option value="primary">Primária</option>
          <option value="secondary">Secundária</option>
        </select>
      </label>
      <label>
        Trecho
        <textarea
          value={entry.excerpt}
          onChange={(e) => onChange({ ...entry, excerpt: e.target.value })}
        />
      </label>
      <label>
        Localizador / página
        <input
          value={entry.locator}
          onChange={(e) => onChange({ ...entry, locator: e.target.value })}
        />
      </label>
      <button type="button" onClick={onRemove}>
        Remover evidência
      </button>
    </div>
  );
}

function periodFields(period: Context['period']) {
  const data: Record<string, string> = {};
  for (const key of ['start', 'end'] as const) {
    const year = period[key];
    data[key] = year === null ? '' : String(year <= 0 ? 1 - year : year);
    data[`${key}Era`] = year !== null && year <= 0 ? 'bce' : 'ce';
  }

  return data;
}

function NodeFields({ model }: { model: EditorModel }) {
  return (
    <>
      <label>
        Tipo
        <select
          value={model.fields.kind}
          onChange={(e) => model.update('kind', e.target.value)}
        >
          {model.catalog.data?.kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {model.text('aliases', 'Outros nomes (separados por vírgula)')}
      {model.fields.kind === 'concept' &&
        model.text('conceptScope', 'Interpretação contextualizada')}
      <fieldset>
        <legend>Contextos</legend>
        {model.options.data?.contexts.map((c) => (
          <label className="check" key={c.id}>
            <input
              type="checkbox"
              checked={model.contexts.includes(c.id)}
              onChange={(e) => {
                model.setContexts(
                  e.target.checked
                    ? [...model.contexts, c.id]
                    : model.contexts.filter((id) => id !== c.id),
                );
                model.setActionKey(crypto.randomUUID());
              }}
            />
            {c.label}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function SourceFields({ model }: { model: EditorModel }) {
  return (
    <>
      {model.text('author', 'Autor da fonte')}
      {model.text('url', 'URL da fonte (HTTP/HTTPS)')}
    </>
  );
}

function ContextFields({ model }: { model: EditorModel }) {
  return (
    <>
      {model.text('region', 'Região')}
      <p>Deixe os anos vazios para período desconhecido.</p>
      {(['start', 'end'] as const).map((key) => (
        <div className="form-grid" key={key}>
          <label>
            {key === 'start' ? 'Ano inicial' : 'Ano final'}
            <input
              type="number"
              min="1"
              step="1"
              value={model.fields[key]}
              onChange={(e) => model.update(key, e.target.value)}
            />
          </label>
          <label>
            Era do {key === 'start' ? 'início' : 'fim'}
            <select
              value={model.fields[`${key}Era`]}
              onChange={(e) => model.update(`${key}Era`, e.target.value)}
            >
              <option value="ce">d.C.</option>
              <option value="bce">a.C.</option>
            </select>
          </label>
        </div>
      ))}
      <label className="check">
        <input
          type="checkbox"
          checked={model.approximate}
          onChange={(e) => {
            model.setApproximate(e.target.checked);
            model.setActionKey(crypto.randomUUID());
          }}
        />
        Período aproximado
      </label>
    </>
  );
}

function RelationFields({ model }: { model: EditorModel }) {
  return (
    <>
      <NodePicker
        label="Ponto de origem"
        value={model.fields.sourceId ?? ''}
        onChange={(id) => model.update('sourceId', id)}
      />
      <NodePicker
        label="Ponto de destino"
        value={model.fields.targetId ?? ''}
        onChange={(id) => model.update('targetId', id)}
      />
      <label>
        Predicado
        <select
          required
          value={model.fields.type}
          onChange={(e) => model.update('type', e.target.value)}
        >
          <option value="">Selecione</option>
          {model.catalog.data?.predicates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.symmetric ? ' (simétrica)' : ''}
            </option>
          ))}
        </select>
      </label>
      {model.text('claim', 'Afirmação', true, true)}
      {model.text('justification', 'Justificativa', false, true)}
      <label>
        Contexto
        <select
          value={model.fields.context}
          onChange={(e) => model.update('context', e.target.value)}
        >
          <option value="">Sem contexto</option>
          {model.options.data?.contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Classificação da evidência
        <select
          value={model.fields.evidenceStatus}
          onChange={(e) => model.update('evidenceStatus', e.target.value)}
        >
          <option value="documented">Documentada</option>
          <option value="attributed_interpretation">
            Interpretação atribuída
          </option>
          <option value="inference">Inferência / hipótese</option>
        </select>
      </label>
      {model.text('attribution', 'Autoria / atribuição')}
      <label>
        Intensidade
        <select
          value={model.fields.intensity}
          onChange={(e) => model.update('intensity', e.target.value)}
        >
          <option value="">Não avaliada</option>
          <option value="1">1 — Pontual</option>
          <option value="2">2 — Relevante</option>
          <option value="3">3 — Central</option>
        </select>
      </label>
      {model.text('intensityReason', 'Justificativa da intensidade')}
      <label className="check">
        <input
          type="checkbox"
          checked={model.contested}
          onChange={(e) => {
            model.setContested(e.target.checked);
            model.setActionKey(crypto.randomUUID());
          }}
        />
        Relação contestada
      </label>
      <fieldset>
        <legend>Evidências</legend>
        <p>Adicionar uma URL não promove a classificação automaticamente.</p>
        {model.evidence.map((entry, i) => (
          <EvidenceFields
            key={i}
            entry={entry}
            sources={model.options.data?.sources ?? []}
            onChange={(next) => {
              model.setEvidence((values) =>
                values.map((v, index) => (index === i ? next : v)),
              );
              model.setActionKey(crypto.randomUUID());
            }}
            onRemove={() => {
              model.setEvidence((values) =>
                values.filter((_, index) => index !== i),
              );
              model.setActionKey(crypto.randomUUID());
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            model.setEvidence((values) => [
              ...values,
              {
                sourceId: '',
                role: 'supports',
                sourceRole: 'secondary',
                excerpt: '',
                locator: '',
              },
            ]);
            model.setActionKey(crypto.randomUUID());
          }}
        >
          Adicionar evidência
        </button>
      </fieldset>
    </>
  );
}

function EditorOptionsFeedback({ model }: { model: EditorModel }) {
  return (
    <>
      {' '}
      {model.catalog.error && (
        <Failure
          error={model.catalog.error}
          retry={() => void model.catalog.refetch()}
        />
      )}
      {model.options.error && (
        <Failure
          error={model.options.error}
          retry={() => void model.options.refetch()}
        />
      )}
      {(model.catalog.isPending || model.options.isPending) && (
        <p role="status">Carregando catálogos…</p>
      )}
    </>
  );
}

function ConflictPanel({ model }: { model: EditorModel }) {
  const conflict = model.conflict;
  if (!conflict) return null;
  return (
    <div className="confirmation" role="group" aria-label="Conflito de edição">
      <h2>Compare antes de continuar</h2>
      <p>Seu rascunho foi preservado. A versão atual não foi sobrescrita.</p>
      <dl>
        {conflictChanges(model, conflict).map((change) => (
          <Difference key={change.label} {...change} />
        ))}
      </dl>
      <button
        onClick={() => {
          model.setBaseline(conflict);
          model.setConflict(null);
          model.setError(null);
        }}
      >
        Continuar editando sobre a versão atual
      </button>
      <button
        onClick={() => {
          model.setFields(initialFields(conflict));
          if ('contexts' in conflict) model.setContexts(conflict.contexts);
          if ('evidence' in conflict) model.setEvidence(conflict.evidence);
          if ('contested' in conflict) model.setContested(conflict.contested);
          if ('period' in conflict)
            model.setApproximate(conflict.period.approximate);
          model.setBaseline(conflict);
          model.setConflict(null);
          model.setError(null);
        }}
      >
        Usar dados atuais e descartar rascunho
      </button>
    </div>
  );
}

function EditorActions({ model }: { model: EditorModel }) {
  return (
    <>
      {model.baseline && (
        <div className="actions">
          {(model.type === 'nodes' || model.type === 'relations') && (
            <Link to={`/history/${model.type}/${model.baseline.id}`}>
              Ver histórico
            </Link>
          )}
          <button
            disabled={model.busy || model.baseline.status === 'archived'}
            onClick={() => {
              model.setActionKey(crypto.randomUUID());
              model.setArchive(true);
            }}
          >
            Arquivar registro
          </button>
        </div>
      )}
      {model.archive && (
        <div
          role="group"
          aria-label="Confirmar arquivamento"
          className="confirmation"
        >
          <p>
            Arquivar altera o registro na API. Dependências podem impedir a
            operação. Recolher o mapa é uma ação visual separada.
          </p>
          <button disabled={model.busy} onClick={() => void model.doArchive()}>
            Confirmar arquivamento
          </button>
          <button disabled={model.busy} onClick={() => model.setArchive(false)}>
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}

function editorMetadata(entity: Entity | undefined) {
  if (!entity)
    return {
      contexts: [] as string[],
      evidence: [] as Relation['evidence'],
      approximate: false,
      contested: false,
    };
  return {
    contexts: 'contexts' in entity ? entity.contexts : [],
    evidence: 'evidence' in entity ? entity.evidence : [],
    approximate: 'period' in entity ? entity.period.approximate : false,
    contested: 'contested' in entity ? entity.contested : false,
  };
}
function TypeFields({ model }: { model: EditorModel }) {
  const fields = {
    nodes: NodeFields,
    sources: SourceFields,
    contexts: ContextFields,
    relations: RelationFields,
  };
  const Fields = fields[model.type];
  return <Fields model={model} />;
}
interface FieldChange {
  label: string;
  draft: string;
  latest: string;
  multiline?: boolean;
}
function conflictChanges(model: EditorModel, conflict: Entity): FieldChange[] {
  const changes: FieldChange[] = Object.entries(initialFields(conflict)).map(
    ([label, latest]) => ({ label, latest, draft: model.fields[label] ?? '' }),
  );
  if ('contexts' in conflict)
    changes.push({
      label: 'Contextos',
      draft: model.contexts.join(', '),
      latest: conflict.contexts.join(', '),
    });
  if ('evidence' in conflict)
    changes.push({
      label: 'Evidências',
      draft: JSON.stringify(model.evidence, null, 2),
      latest: JSON.stringify(conflict.evidence, null, 2),
      multiline: true,
    });
  if ('contested' in conflict)
    changes.push({
      label: 'Contestação',
      draft: model.contested ? 'Sim' : 'Não',
      latest: conflict.contested ? 'Sim' : 'Não',
    });
  if ('period' in conflict)
    changes.push({
      label: 'Período aproximado',
      draft: model.approximate ? 'Sim' : 'Não',
      latest: conflict.period.approximate ? 'Sim' : 'Não',
    });
  return changes;
}
function Difference({ label, draft, latest, multiline }: FieldChange) {
  if (draft === latest) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {multiline ? (
          <pre className="error-details">Seu rascunho: {draft}</pre>
        ) : (
          <>Seu rascunho: {draft || '(vazio)'}</>
        )}
      </dd>
      <dd>
        {multiline ? (
          <pre className="error-details">Versão atual: {latest}</pre>
        ) : (
          <>Versão atual: {latest || '(vazio)'}</>
        )}
      </dd>
    </div>
  );
}

function NodeSearchResults({
  q,
  value,
  label,
  onChange,
}: {
  q: string;
  value: string;
  label: string;
  onChange: (id: string) => void;
}) {
  const { api } = useServices();
  const search = useInfiniteQuery({
    queryKey: ['picker', q],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.search(q, { ...defaultFilters, pending: true }, pageParam, signal),
    getNextPageParam: (p) => p.nextCursor,
    enabled: !!q,
  });

  return (
    <>
      {' '}
      {search.isFetching && <p role="status">Buscando candidatos…</p>}
      {search.error && (
        <Failure error={search.error} retry={() => void search.refetch()} />
      )}
      {search.data?.pages
        .flatMap((p) => p.items)
        .map((n: Node) => (
          <label className="check" key={n.id}>
            <input
              type="radio"
              name={label}
              checked={value === n.id}
              onChange={() => onChange(n.id)}
            />
            {n.label} ·{' '}
            {
              {
                person: 'Pessoa',
                tradition: 'Tradição',
                concept: 'Conceito',
                work: 'Obra',
              }[n.kind]
            }{' '}
            · {n.description} · ID {n.id}
          </label>
        ))}
      {q && search.data?.pages[0]?.items.length === 0 && (
        <p>Nenhum candidato.</p>
      )}
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
