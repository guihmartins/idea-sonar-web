// Grupo "Contextualização" do formulário de ponto: um conceito contextual ativo
// só existe com uma relação `contextualizes` ativa para um conceito amplo ativo,
// então o editor pede os dois juntos e os grava em um único lote (POST /imports).
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/services';
import type { Entity, Node, Relation } from '../../api/domain';
import { Failure, editorialLabels } from '../../components/Feedback';
import { EvidenceEditor, EvidenceStatusFields } from './fields';
import type { FieldsModel } from './fields';
import { NodePicker } from './pickers';
import { pendingContextualizations, pendingItems } from './contextual';
import type { BatchOutcome, ContextualFlow } from './contextual';

export interface ContextualModel extends FieldsModel {
  baseline: Entity | undefined;
  flow: ContextualFlow | null;
  relationChoice: string;
  setRelationChoice: (id: string) => void;
}

// A API só aceita conceito amplo como destino de `contextualizes`.
const isBroadConcept = (node: Node) => node.conceptScope === 'broad';

function ContextualizationFields({ model }: { model: ContextualModel }) {
  return (
    <>
      <NodePicker
        label="Conceito amplo"
        value={model.fields.targetId ?? ''}
        onChange={(id) => model.update('targetId', id)}
        filters={{ kind: 'concept', includePending: false }}
        accept={isBroadConcept}
      />
      {model.text('claim', 'Afirmação da contextualização', true, true)}
      {model.text(
        'justification',
        'Justificativa da contextualização',
        true,
        true,
      )}
      <EvidenceStatusFields model={model} />
      <EvidenceEditor model={model} />
    </>
  );
}

function LinkOption({
  relation,
  checked,
  many,
  onChoose,
}: {
  relation: Relation;
  checked: boolean;
  many: boolean;
  onChoose: () => void;
}) {
  const { api } = useServices();
  const target = useQuery({
    queryKey: ['node', relation.targetId],
    queryFn: ({ signal }) => api.node(relation.targetId, signal),
  });
  const broad = target.data;
  const summary = (
    <>
      {relation.claim}
      <span className="period">
        Conceito amplo: {broad?.label ?? relation.targetId}
        {broad ? ` · ${editorialLabels[broad.status]}` : ''}
      </span>
    </>
  );
  return (
    <>
      {many ? (
        <label className="check">
          <input
            type="radio"
            name="Relação a ativar"
            checked={checked}
            onChange={onChoose}
          />
          <span>{summary}</span>
        </label>
      ) : (
        <p className="link-summary">{summary}</p>
      )}
      {broad && broad.status !== 'active' && (
        <p className="muted">
          O conceito amplo não está ativo. Ative-o antes: uma relação ativa
          exige os dois pontos ativos.
        </p>
      )}
    </>
  );
}

function ActivationLinks({
  model,
  node,
}: {
  model: ContextualModel;
  node: Node;
}) {
  const { api } = useServices();
  const links = useQuery({
    queryKey: ['contextualizations', node.id],
    queryFn: ({ signal }) =>
      api.nodeRelations(node.id, 'contextualizes', signal),
  });
  if (links.isPending)
    return <p role="status">Buscando a relação de contextualização…</p>;
  if (links.error)
    return <Failure error={links.error} retry={() => void links.refetch()} />;
  const options = pendingContextualizations(links.data.items, node);
  if (options.length === 0)
    return (
      <>
        <p>
          Este conceito não tem relação de contextualização pendente. Informe
          uma: ela é criada e ativada junto com o ponto, em um único lote.
        </p>
        <ContextualizationFields model={model} />
      </>
    );
  const chosen =
    options.find((r) => r.id === model.relationChoice) ?? options[0];
  return (
    <>
      <p>
        Ao salvar, o ponto e a relação de contextualização pendente são ativados
        juntos, em um único lote.
      </p>
      {options.length > 1 && (
        <p className="muted">
          Há mais de uma relação pendente. Escolha a que será ativada.
        </p>
      )}
      {options.map((relation) => (
        <LinkOption
          key={relation.id}
          relation={relation}
          many={options.length > 1}
          checked={relation.id === chosen?.id}
          onChoose={() => model.setRelationChoice(relation.id)}
        />
      ))}
    </>
  );
}

export function ContextualizationGroup({ model }: { model: ContextualModel }) {
  const node = model.baseline as Node | undefined;
  return (
    <fieldset>
      <legend>Contextualização</legend>
      {model.flow === 'activate' && node ? (
        <ActivationLinks model={model} node={node} />
      ) : (
        <>
          <p>
            Um conceito contextual ativo precisa de ao menos um contexto e de
            uma relação “contextualiza” com um conceito amplo ativo. O editor
            grava o conceito e a relação juntos, em um único lote.
          </p>
          <ContextualizationFields model={model} />
        </>
      )}
    </fieldset>
  );
}

const itemTypeLabels: Record<string, string> = {
  nodes: 'Ponto',
  relations: 'Relação',
  sources: 'Fonte',
  contexts: 'Contexto',
};

// Resultado do lote. Com pendências não é sucesso: lista cada item e o motivo.
export function BatchResultPanel({
  outcome,
}: {
  outcome: BatchOutcome | null;
}) {
  if (!outcome) return null;
  const { flow, result } = outcome;
  const pending = pendingItems(result);
  const link = <Link to={`/imports/${result.batchId}`}>Ver importação</Link>;
  if (pending.length === 0)
    return (
      <p role="status" className="status">
        <span>
          {flow === 'create'
            ? 'Conceito contextual criado e ativado.'
            : 'Conceito contextual ativado.'}{' '}
          {link}
        </span>
      </p>
    );
  return (
    <div role="alert" className="status status--warning">
      <div>
        <p>
          O lote foi gravado, mas{' '}
          {pending.length === 1
            ? '1 item ficou pendente'
            : `${pending.length} itens ficaram pendentes`}
          . A ativação do conceito contextual não foi concluída.
        </p>
        <ul>
          {pending.map((item) => (
            <li key={item.clientRef}>
              {itemTypeLabels[item.entityType] ?? item.entityType}{' '}
              <code>{item.clientRef}</code>:{' '}
              {item.reason ?? 'Sem motivo informado.'}
            </li>
          ))}
        </ul>
        <p>{link}</p>
      </div>
    </div>
  );
}
