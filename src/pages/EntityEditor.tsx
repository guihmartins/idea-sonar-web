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
import { astronomicalYear } from '../components/period';
import { typeLabels } from './RecordsPage';
const editable = ['nodes', 'relations', 'sources', 'contexts'] as const;
type Editable = (typeof editable)[number];
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
  if ('period' in entity)
    for (const key of ['start', 'end'] as const) {
      const year = entity.period[key];
      data[key] = year === null ? '' : String(year <= 0 ? 1 - year : year);
      data[`${key}Era`] = year !== null && year <= 0 ? 'bce' : 'ce';
    }
  return data;
}
function EditorForm({
  type,
  initial,
}: {
  type: Editable;
  initial: Entity | undefined;
}) {
  const { api } = useServices();
  const cache = useQueryClient();
  const [baseline, setBaseline] = useState(initial);
  const [fields, setFields] = useState(() => initialFields(initial));
  const [contexts, setContexts] = useState<string[]>(
    initial && 'contexts' in initial ? initial.contexts : [],
  );
  const [evidence, setEvidence] = useState<Relation['evidence']>(
    initial && 'evidence' in initial ? initial.evidence : [],
  );
  const [approximate, setApproximate] = useState(
    initial && 'period' in initial ? initial.period.approximate : false,
  );
  const [contested, setContested] = useState(
    initial && 'contested' in initial ? initial.contested : false,
  );
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
      let body: Record<string, unknown> = {
        label: fields.label?.trim(),
        description: fields.description,
        status: fields.status,
      };
      if (type === 'nodes')
        body = {
          ...body,
          kind: fields.kind,
          aliases: (fields.aliases ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          conceptScope: fields.conceptScope,
          contexts,
          degreeTotal:
            baseline && 'degreeTotal' in baseline ? baseline.degreeTotal : 0,
        };
      if (type === 'sources') {
        if (
          fields.url &&
          !['https:', 'http:'].includes(new URL(fields.url).protocol)
        )
          throw new Error('Use uma URL HTTP(S) para a fonte.');
        body = { ...body, author: fields.author, url: fields.url };
      }
      if (type === 'contexts') {
        const start = astronomicalYear(
          fields.start ?? '',
          fields.startEra ?? 'ce',
        );
        const end = astronomicalYear(fields.end ?? '', fields.endEra ?? 'ce');
        if (start !== null && end !== null && end < start)
          throw new Error('O fim do período deve ser posterior ao início.');
        body = {
          ...body,
          region: fields.region,
          period: { start, end, approximate },
        };
      }
      if (type === 'relations') {
        if (
          !fields.sourceId ||
          !fields.targetId ||
          !fields.type ||
          !fields.claim?.trim()
        )
          throw new Error(
            'Selecione origem, destino, predicado e informe a afirmação.',
          );
        const predicate = catalog.data?.predicates.find(
          (p) => p.id === fields.type,
        );
        if (!predicate)
          throw new Error('Selecione um predicado do catálogo da API.');
        const [source, target] = await Promise.all([
          api.node(fields.sourceId),
          api.node(fields.targetId),
        ]);
        if (
          !predicate.sourceKinds.includes(source.kind) ||
          !predicate.targetKinds.includes(target.kind)
        )
          throw new Error(
            'Tipos incompatíveis com o predicado retornado pelo catálogo.',
          );
        if (
          fields.evidenceStatus !== 'inference' &&
          (!evidence.length || evidence.some((e) => !e.sourceId))
        )
          throw new Error(
            'Uma fonte é obrigatória para relação documentada ou interpretação atribuída.',
          );
        if (
          fields.evidenceStatus === 'inference' &&
          (!fields.attribution?.trim() || !fields.justification?.trim())
        )
          throw new Error('Inferência exige autoria e justificativa.');
        body = {
          ...body,
          sourceId: fields.sourceId,
          targetId: fields.targetId,
          type: fields.type,
          claim: fields.claim,
          justification: fields.justification,
          context: fields.context,
          evidenceStatus: fields.evidenceStatus,
          intensity: fields.intensity ? Number(fields.intensity) : null,
          intensityReason: fields.intensityReason,
          attribution: fields.attribution,
          contested,
          evidence,
        };
      }
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
  return (
    <section>
      <Link to={`/${type}`}>
        Voltar a {typeLabels[type].toLocaleLowerCase('pt-BR')}
      </Link>
      <h1>
        {baseline ? 'Editar' : 'Cadastrar'}{' '}
        {
          {
            nodes: 'ponto',
            relations: 'relação',
            sources: 'fonte',
            contexts: 'contexto',
          }[type]
        }
      </h1>
      {catalog.error && (
        <Failure error={catalog.error} retry={() => void catalog.refetch()} />
      )}
      {options.error && (
        <Failure error={options.error} retry={() => void options.refetch()} />
      )}
      {(catalog.isPending || options.isPending) && (
        <p role="status">Carregando catálogos…</p>
      )}
      <form onSubmit={(e) => void submit(e)} className="editor">
        <fieldset disabled={busy || !!conflict}>
          <legend>Dados do registro</legend>
          {text('label', 'Nome', true)}
          {text('description', 'Descrição', false, true)}
          <label>
            Estado editorial
            <select
              value={fields.status}
              onChange={(e) => update('status', e.target.value)}
            >
              <option value="active">Ativo</option>
              <option value="pending">Pendente</option>
              {fields.status === 'archived' && (
                <option value="archived">Arquivado</option>
              )}
            </select>
          </label>
          {type === 'nodes' && (
            <>
              <label>
                Tipo
                <select
                  value={fields.kind}
                  onChange={(e) => update('kind', e.target.value)}
                >
                  {catalog.data?.kinds.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              {text('aliases', 'Outros nomes (separados por vírgula)')}
              {fields.kind === 'concept' &&
                text('conceptScope', 'Interpretação contextualizada')}
              <fieldset>
                <legend>Contextos</legend>
                {options.data?.contexts.map((c) => (
                  <label className="check" key={c.id}>
                    <input
                      type="checkbox"
                      checked={contexts.includes(c.id)}
                      onChange={(e) => {
                        setContexts(
                          e.target.checked
                            ? [...contexts, c.id]
                            : contexts.filter((id) => id !== c.id),
                        );
                        setActionKey(crypto.randomUUID());
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {type === 'sources' && (
            <>
              {text('author', 'Autor da fonte')}
              {text('url', 'URL da fonte (HTTP/HTTPS)')}
            </>
          )}
          {type === 'contexts' && (
            <>
              {text('region', 'Região')}
              <p>Deixe os anos vazios para período desconhecido.</p>
              {(['start', 'end'] as const).map((key) => (
                <div className="form-grid" key={key}>
                  <label>
                    {key === 'start' ? 'Ano inicial' : 'Ano final'}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={fields[key]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </label>
                  <label>
                    Era do {key === 'start' ? 'início' : 'fim'}
                    <select
                      value={fields[`${key}Era`]}
                      onChange={(e) => update(`${key}Era`, e.target.value)}
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
                  checked={approximate}
                  onChange={(e) => {
                    setApproximate(e.target.checked);
                    setActionKey(crypto.randomUUID());
                  }}
                />
                Período aproximado
              </label>
            </>
          )}
          {type === 'relations' && (
            <>
              <NodePicker
                label="Ponto de origem"
                value={fields.sourceId ?? ''}
                onChange={(id) => update('sourceId', id)}
              />
              <NodePicker
                label="Ponto de destino"
                value={fields.targetId ?? ''}
                onChange={(id) => update('targetId', id)}
              />
              <label>
                Predicado
                <select
                  required
                  value={fields.type}
                  onChange={(e) => update('type', e.target.value)}
                >
                  <option value="">Selecione</option>
                  {catalog.data?.predicates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.symmetric ? ' (simétrica)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {text('claim', 'Afirmação', true, true)}
              {text('justification', 'Justificativa', false, true)}
              <label>
                Contexto
                <select
                  value={fields.context}
                  onChange={(e) => update('context', e.target.value)}
                >
                  <option value="">Sem contexto</option>
                  {options.data?.contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Classificação da evidência
                <select
                  value={fields.evidenceStatus}
                  onChange={(e) => update('evidenceStatus', e.target.value)}
                >
                  <option value="documented">Documentada</option>
                  <option value="attributed_interpretation">
                    Interpretação atribuída
                  </option>
                  <option value="inference">Inferência / hipótese</option>
                </select>
              </label>
              {text('attribution', 'Autoria / atribuição')}
              <label>
                Intensidade
                <select
                  value={fields.intensity}
                  onChange={(e) => update('intensity', e.target.value)}
                >
                  <option value="">Não avaliada</option>
                  <option value="1">1 — Pontual</option>
                  <option value="2">2 — Relevante</option>
                  <option value="3">3 — Central</option>
                </select>
              </label>
              {text('intensityReason', 'Justificativa da intensidade')}
              <label className="check">
                <input
                  type="checkbox"
                  checked={contested}
                  onChange={(e) => {
                    setContested(e.target.checked);
                    setActionKey(crypto.randomUUID());
                  }}
                />
                Relação contestada
              </label>
              <fieldset>
                <legend>Evidências</legend>
                <p>
                  Adicionar uma URL não promove a classificação automaticamente.
                </p>
                {evidence.map((entry, i) => (
                  <EvidenceFields
                    key={i}
                    entry={entry}
                    sources={options.data?.sources ?? []}
                    onChange={(next) => {
                      setEvidence((values) =>
                        values.map((v, index) => (index === i ? next : v)),
                      );
                      setActionKey(crypto.randomUUID());
                    }}
                    onRemove={() => {
                      setEvidence((values) =>
                        values.filter((_, index) => index !== i),
                      );
                      setActionKey(crypto.randomUUID());
                    }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEvidence((values) => [
                      ...values,
                      {
                        sourceId: '',
                        role: 'supports',
                        sourceRole: 'secondary',
                        excerpt: '',
                        locator: '',
                      },
                    ]);
                    setActionKey(crypto.randomUUID());
                  }}
                >
                  Adicionar evidência
                </button>
              </fieldset>
            </>
          )}
          <button
            disabled={catalog.isPending || !!catalog.error || !!options.error}
          >
            Salvar registro
          </button>
        </fieldset>
      </form>
      {error !== null && <Failure error={error} />}
      {message && <p role="status">{message}</p>}
      {conflict && (
        <div
          className="confirmation"
          role="group"
          aria-label="Conflito de edição"
        >
          <h2>Compare antes de continuar</h2>
          <p>
            Seu rascunho foi preservado. A versão atual não foi sobrescrita.
          </p>
          <dl>
            {Object.entries(initialFields(conflict))
              .filter(([key, value]) => fields[key] !== value)
              .map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>Seu rascunho: {fields[key] || '(vazio)'}</dd>
                  <dd>Versão atual: {value || '(vazio)'}</dd>
                </div>
              ))}
            {'contexts' in conflict &&
              JSON.stringify(contexts) !==
                JSON.stringify(conflict.contexts) && (
                <div>
                  <dt>Contextos</dt>
                  <dd>Seu rascunho: {contexts.join(', ') || '(vazio)'}</dd>
                  <dd>
                    Versão atual: {conflict.contexts.join(', ') || '(vazio)'}
                  </dd>
                </div>
              )}
            {'evidence' in conflict &&
              JSON.stringify(evidence) !==
                JSON.stringify(conflict.evidence) && (
                <div>
                  <dt>Evidências</dt>
                  <dd>
                    <pre className="error-details">
                      Seu rascunho: {JSON.stringify(evidence, null, 2)}
                    </pre>
                  </dd>
                  <dd>
                    <pre className="error-details">
                      Versão atual: {JSON.stringify(conflict.evidence, null, 2)}
                    </pre>
                  </dd>
                </div>
              )}
            {'contested' in conflict && contested !== conflict.contested && (
              <div>
                <dt>Contestação</dt>
                <dd>
                  Seu rascunho: {contested ? 'Sim' : 'Não'} · Versão atual:{' '}
                  {conflict.contested ? 'Sim' : 'Não'}
                </dd>
              </div>
            )}
            {'period' in conflict &&
              approximate !== conflict.period.approximate && (
                <div>
                  <dt>Período aproximado</dt>
                  <dd>
                    Seu rascunho: {approximate ? 'Sim' : 'Não'} · Versão atual:{' '}
                    {conflict.period.approximate ? 'Sim' : 'Não'}
                  </dd>
                </div>
              )}
          </dl>
          <button
            onClick={() => {
              setBaseline(conflict);
              setConflict(null);
              setError(null);
            }}
          >
            Continuar editando sobre a versão atual
          </button>
          <button
            onClick={() => {
              setFields(initialFields(conflict));
              if ('contexts' in conflict) setContexts(conflict.contexts);
              if ('evidence' in conflict) setEvidence(conflict.evidence);
              if ('contested' in conflict) setContested(conflict.contested);
              if ('period' in conflict)
                setApproximate(conflict.period.approximate);
              setBaseline(conflict);
              setConflict(null);
              setError(null);
            }}
          >
            Usar dados atuais e descartar rascunho
          </button>
        </div>
      )}
      {baseline && (
        <div className="actions">
          {(type === 'nodes' || type === 'relations') && (
            <Link to={`/history/${type}/${baseline.id}`}>Ver histórico</Link>
          )}
          <button
            disabled={busy || baseline.status === 'archived'}
            onClick={() => {
              setActionKey(crypto.randomUUID());
              setArchive(true);
            }}
          >
            Arquivar registro
          </button>
        </div>
      )}
      {archive && (
        <div
          role="group"
          aria-label="Confirmar arquivamento"
          className="confirmation"
        >
          <p>
            Arquivar altera o registro na API. Dependências podem impedir a
            operação. Recolher o mapa é uma ação visual separada.
          </p>
          <button disabled={busy} onClick={() => void doArchive()}>
            Confirmar arquivamento
          </button>
          <button disabled={busy} onClick={() => setArchive(false)}>
            Cancelar
          </button>
        </div>
      )}
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
  const search = useInfiniteQuery({
    queryKey: ['picker', q],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.search(q, { ...defaultFilters, pending: true }, pageParam, signal),
    getNextPageParam: (p) => p.nextCursor,
    enabled: !!q,
  });
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
