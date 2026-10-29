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
import { defaultFilters } from '../api/domain';
import type { Entity, EntityType, Node, Context, Source } from '../api/domain';
import { Failure } from '../components/Feedback';
import {
  conceptScopeLabels,
  kindLabels,
  precisionLabels,
  sourceKindLabels,
  stanceLabels,
} from '../components/labels';
import {
  buildEditorBody,
  emptyEvidence,
  evidenceDraft,
  formatAliases,
} from './editor/payload';
import type { Editable, EvidenceDraft } from './editor/payload';
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
    contextId: '',
    sourceId: '',
    targetId: '',
    type: '',
    claim: '',
    justification: '',
    evidenceStatus: 'inference',
    intensity: '',
    intensityReason: '',
    attributionText: '',
    inferenceAuthor: '',
    contestationNote: '',
    title: '',
    authorText: '',
    canonicalUrl: '',
    publicationLabel: '',
    doi: '',
    notes: '',
    regionLabel: '',
    periodLabel: '',
    precision: 'unknown',
    start: '',
    end: '',
    startEra: 'ce',
    endEra: 'ce',
  };
  if (!entity) return data;
  for (const [key, value] of Object.entries(entity))
    if (typeof value === 'string' || typeof value === 'number')
      data[key] = String(value);
  if ('aliases' in entity) data.aliases = formatAliases(entity.aliases);
  if ('startYear' in entity) Object.assign(data, periodFields(entity));
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
        { fields, contexts, evidence, contested },
        catalog.data,
        api,
      );
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
            className="primary"
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
  entry: EvidenceDraft;
  sources: Source[];
  onChange: (entry: EvidenceDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="evidence">
      <label>
        Fonte
        <select
          value={entry.sourceId}
          onChange={(e) => onChange({ ...entry, sourceId: e.target.value })}
        >
          <option value="">Sem fonte cadastrada</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} · {s.authorText}
            </option>
          ))}
        </select>
      </label>
      <label>
        Papel da evidência
        <select
          value={entry.stance}
          onChange={(e) =>
            onChange({
              ...entry,
              stance: e.target.value as EvidenceDraft['stance'],
            })
          }
        >
          {Object.entries(stanceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tipo de fonte
        <select
          value={entry.sourceKind}
          onChange={(e) =>
            onChange({
              ...entry,
              sourceKind: e.target.value as EvidenceDraft['sourceKind'],
            })
          }
        >
          {Object.entries(sourceKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Localizador / página
        <input
          required
          value={entry.locator}
          onChange={(e) => onChange({ ...entry, locator: e.target.value })}
        />
      </label>
      <label>
        Trecho
        <textarea
          value={entry.excerpt}
          onChange={(e) => onChange({ ...entry, excerpt: e.target.value })}
        />
      </label>
      <label>
        Explicação da evidência
        <textarea
          required
          value={entry.explanation}
          onChange={(e) => onChange({ ...entry, explanation: e.target.value })}
        />
      </label>
      {entry.sourceKind === 'conversation' && (
        <label>
          Referência da conversa
          <input
            value={entry.conversationReference}
            onChange={(e) =>
              onChange({ ...entry, conversationReference: e.target.value })
            }
          />
        </label>
      )}
      <button type="button" onClick={onRemove}>
        Remover evidência
      </button>
    </div>
  );
}

function periodFields(period: Pick<Context, 'startYear' | 'endYear'>) {
  const data: Record<string, string> = {};
  for (const [key, year] of [
    ['start', period.startYear],
    ['end', period.endYear],
  ] as const) {
    data[key] = year === null ? '' : String(year <= 0 ? 1 - year : year);
    data[`${key}Era`] = year !== null && year <= 0 ? 'bce' : 'ce';
  }
  return data;
}

function Choice({
  model,
  field,
  label,
  options,
  disabled = false,
}: {
  model: EditorModel;
  field: string;
  label: string;
  options: Record<string, string>;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        value={model.fields[field]}
        disabled={disabled}
        onChange={(e) => model.update(field, e.target.value)}
      >
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function NodeFields({ model }: { model: EditorModel }) {
  // A API não permite mudar tipo nem escopo depois da criação.
  const fixed = !!model.baseline;
  return (
    <>
      {model.text('label', 'Nome', true)}
      {model.text('description', 'Descrição', true, true)}
      <Choice
        model={model}
        field="kind"
        label="Tipo"
        options={Object.fromEntries(
          (model.catalog.data?.nodeKinds ?? []).map((k) => [k, kindLabels[k]]),
        )}
        disabled={fixed}
      />
      {model.fields.kind === 'concept' && (
        <Choice
          model={model}
          field="conceptScope"
          label="Escopo do conceito"
          options={{ '': 'Selecione', ...conceptScopeLabels }}
          disabled={fixed}
        />
      )}
      {model.text(
        'aliases',
        'Outros nomes (separados por vírgula; idioma opcional, ex.: Jung (de))',
      )}
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
      {model.text('title', 'Título', true)}
      {model.text('authorText', 'Autor da fonte', true)}
      <p>Informe ao menos URL, DOI ou publicação.</p>
      {model.text('canonicalUrl', 'URL da fonte (HTTP/HTTPS)')}
      {model.text('publicationLabel', 'Publicação')}
      {model.text('doi', 'DOI')}
      {model.text('notes', 'Notas', false, true)}
    </>
  );
}

function ContextFields({ model }: { model: EditorModel }) {
  return (
    <>
      {model.text('label', 'Nome', true)}
      {model.text('regionLabel', 'Região')}
      {model.text('periodLabel', 'Rótulo do período')}
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
      <Choice
        model={model}
        field="precision"
        label="Precisão do período"
        options={precisionLabels}
      />
      {model.text('notes', 'Notas', false, true)}
    </>
  );
}

function RelationClassification({ model }: { model: EditorModel }) {
  const status = model.fields.evidenceStatus;
  return (
    <>
      <Choice
        model={model}
        field="evidenceStatus"
        label="Classificação da evidência"
        options={{
          documented: 'Documentada',
          attributed_interpretation: 'Interpretação atribuída',
          inference: 'Inferência / hipótese',
        }}
      />
      {status === 'attributed_interpretation' &&
        model.text('attributionText', 'Atribuição (quem interpreta)', true)}
      {status === 'inference' &&
        model.text('inferenceAuthor', 'Autoria da inferência', true)}
      <Choice
        model={model}
        field="intensity"
        label="Intensidade"
        options={{
          '': 'Não avaliada',
          '1': '1 — Pontual',
          '2': '2 — Relevante',
          '3': '3 — Central',
        }}
      />
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
      {model.contested &&
        model.text('contestationNote', 'Nota de contestação', true, true)}
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
          {model.catalog.data?.relationTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
              {t.symmetric ? ' (simétrica)' : ''}
            </option>
          ))}
        </select>
      </label>
      {model.text('claim', 'Afirmação', true, true)}
      {model.text('justification', 'Justificativa', true, true)}
      <label>
        Contexto
        <select
          value={model.fields.contextId}
          onChange={(e) => model.update('contextId', e.target.value)}
        >
          <option value="">Sem contexto</option>
          {model.options.data?.contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <RelationClassification model={model} />
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
            model.setEvidence((values) => [...values, { ...emptyEvidence }]);
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
          const metadata = editorMetadata(conflict);
          model.setContexts(metadata.contexts);
          model.setEvidence(metadata.evidence);
          model.setContested(metadata.contested);
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
          <button
            className="primary"
            disabled={model.busy}
            onClick={() => void model.doArchive()}
          >
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
  return {
    contexts: entity && 'contexts' in entity ? entity.contexts : [],
    evidence:
      entity && 'evidence' in entity ? entity.evidence.map(evidenceDraft) : [],
    contested: entity && 'contested' in entity ? entity.contested : false,
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
      latest: JSON.stringify(conflict.evidence.map(evidenceDraft), null, 2),
      multiline: true,
    });
  if ('contested' in conflict)
    changes.push({
      label: 'Contestação',
      draft: model.contested ? 'Sim' : 'Não',
      latest: conflict.contested ? 'Sim' : 'Não',
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
      api.search(
        q,
        { ...defaultFilters, includePending: true },
        pageParam,
        signal,
      ),
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
            {n.label} · {kindLabels[n.kind]} · {n.description} · ID {n.id}
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
