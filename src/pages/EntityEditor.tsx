import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useServices } from '../app/services';
import { isVersionConflict } from '../api/client';
import type {
  Context,
  Entity,
  EntityType,
  ImportResult,
  Node,
} from '../api/domain';
import { Failure } from '../components/Feedback';
import {
  conceptScopeLabels,
  kindLabels,
  precisionLabels,
} from '../components/labels';
import {
  buildEditorBody,
  evidenceDraft,
  formatAliases,
} from './editor/payload';
import type { EditorDraft, Editable } from './editor/payload';
import {
  BatchResultPanel,
  ContextualizationGroup,
} from './editor/Contextualization';
import {
  activateContextualBatch,
  contextualFlow,
  createContextualBatch,
  isContextualConcept,
  pendingContextualizations,
  savedNodeId,
} from './editor/contextual';
import type { BatchOutcome, ContextualFlow } from './editor/contextual';
import { CandidatePicker, NodePicker } from './editor/pickers';
import { Choice, EvidenceEditor, EvidenceStatusFields } from './editor/fields';
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
  const [actionKey, setActionKey] = useState<string>(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState<Entity | null>(null);
  const [archive, setArchive] = useState(false);
  const [batch, setBatch] = useState<BatchOutcome | null>(null);
  const [relationChoice, setRelationChoice] = useState('');
  const flow = contextualFlow(type, fields, baseline);
  const catalog = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => api.catalog(signal),
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
  async function savePlain() {
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
  }
  // Conceito contextual: ponto e contextualização vão em um lote só, porque o
  // REST não ativa um sem o outro. A relação a ativar é relida na hora, com a
  // versão atual, em vez de confiar no que a tela carregou.
  async function activationBatch(draft: EditorDraft) {
    const node = baseline as Node;
    const links = await cache.fetchQuery({
      queryKey: ['contextualizations', node.id],
      queryFn: ({ signal }) =>
        api.nodeRelations(node.id, 'contextualizes', signal),
      staleTime: 0,
    });
    const options = pendingContextualizations(links.items, node);
    const chosen = options.find((r) => r.id === relationChoice) ?? options[0];
    return activateContextualBatch(draft, node, chosen, actionKey);
  }
  async function reloadAfterBatch(kind: ContextualFlow, result: ImportResult) {
    const id = savedNodeId(kind, baseline, result);
    if (!id) return;
    const fresh = await api.detail('nodes', id);
    setBaseline(fresh);
    // Com pendências o rascunho da contextualização fica para a nova tentativa.
    if (result.pending > 0) return;
    setFields(initialFields(fresh));
    setEvidence([]);
  }
  async function saveContextual(kind: ContextualFlow) {
    const draft = { fields, contexts, evidence, contested };
    const body =
      kind === 'create'
        ? createContextualBatch(draft, actionKey)
        : await activationBatch(draft);
    const result = await api.importBatch(body, actionKey);
    setBatch({ flow: kind, result });
    setActionKey(crypto.randomUUID());
    await cache.invalidateQueries();
    await reloadAfterBatch(kind, result);
  }
  async function failSave(e: unknown) {
    setError(e);
    if (!isVersionConflict(e) || !baseline) return;
    try {
      setConflict(await api.detail(type, baseline.id));
    } catch {
      setMessage(
        'Não foi possível carregar a versão atual. Tente salvar novamente para recarregar o conflito.',
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    setMessage('');
    setBatch(null);
    try {
      if (flow) await saveContextual(flow);
      else await savePlain();
    } catch (e) {
      await failSave(e);
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
    flow,
    batch,
    relationChoice,
    setRelationChoice,
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
            disabled={model.catalog.isPending || !!model.catalog.error}
          >
            Salvar registro
          </button>
        </fieldset>
      </form>
      {model.error !== null && <Failure error={model.error} />}
      {model.message && <p role="status">{model.message}</p>}
      <BatchResultPanel outcome={model.batch} />
      <ConflictPanel model={model} />
      <EditorActions model={model} />
    </section>
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
      <CandidatePicker
        type="contexts"
        label="Contextos"
        multiple
        values={model.contexts}
        onChange={(ids) => {
          model.setContexts(ids);
          model.setActionKey(crypto.randomUUID());
        }}
      />
      {model.flow && <ContextualizationGroup model={model} />}
      {!model.flow &&
        isContextualConcept(model.fields) &&
        model.fields.status === 'pending' && (
          <p className="muted">
            Conceito contextual pendente não precisa de relação agora: ela é
            exigida quando ele for ativado.
          </p>
        )}
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
  return (
    <>
      <EvidenceStatusFields model={model} />
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
      <CandidatePicker
        type="contexts"
        label="Contexto"
        values={model.fields.contextId ? [model.fields.contextId] : []}
        onChange={(ids) => model.update('contextId', ids[0] ?? '')}
      />
      <RelationClassification model={model} />
      <EvidenceEditor model={model} />
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
      {model.catalog.isPending && <p role="status">Carregando catálogos…</p>}
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
// Campos do grupo de contextualização: só existem no rascunho do ponto.
const contextualizationKeys = new Set([
  'targetId',
  'claim',
  'justification',
  'evidenceStatus',
  'attributionText',
  'inferenceAuthor',
]);
function conflictChanges(model: EditorModel, conflict: Entity): FieldChange[] {
  const own = (label: string) =>
    !('kind' in conflict) || !contextualizationKeys.has(label);
  const changes: FieldChange[] = Object.entries(initialFields(conflict))
    .filter(([label]) => own(label))
    .map(([label, latest]) => ({
      label,
      latest,
      draft: model.fields[label] ?? '',
    }));
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
