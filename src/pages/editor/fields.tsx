// Pedaços de formulário compartilhados entre o editor e o grupo de
// contextualização: escolha por lista, classificação da evidência e evidências.
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  identifierSchemeLabels,
  precisionLabels,
  stanceLabels,
  sourceKindLabels,
} from '../../components/labels';
import { emptyEvidence } from './payload';
import type {
  EvidenceDraft,
  IdentifierDraft,
  IdentifierIssues,
} from './payload';
import { CandidatePicker } from './pickers';

// O que os campos precisam do modelo do editor (EditorModel o satisfaz).
export interface FieldsModel {
  fields: Record<string, string>;
  update: (key: string, value: string) => void;
  text: (
    key: string,
    label: string,
    required?: boolean,
    multiline?: boolean,
  ) => ReactNode;
  evidence: EvidenceDraft[];
  setEvidence: Dispatch<SetStateAction<EvidenceDraft[]>>;
  setActionKey: (key: string) => void;
}

function EvidenceFields({
  entry,
  onChange,
  onRemove,
}: {
  entry: EvidenceDraft;
  onChange: (entry: EvidenceDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="evidence">
      <CandidatePicker
        type="sources"
        label="Fonte"
        values={entry.sourceId ? [entry.sourceId] : []}
        onChange={(ids) => onChange({ ...entry, sourceId: ids[0] ?? '' })}
      />
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

export function Choice({
  model,
  field,
  label,
  options,
  disabled = false,
}: {
  model: FieldsModel;
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

export function EvidenceStatusFields({ model }: { model: FieldsModel }) {
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
    </>
  );
}

export function EvidenceEditor({ model }: { model: FieldsModel }) {
  return (
    <fieldset>
      <legend>Evidências</legend>
      <p>Adicionar uma URL não promove a classificação automaticamente.</p>
      {model.evidence.map((entry, i) => (
        <EvidenceFields
          key={i}
          entry={entry}
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
  );
}

// Período de ponto e de contexto: ano + era (a.C. vira ano astronômico ao enviar).
export function PeriodFields({ model }: { model: FieldsModel }) {
  return (
    <>
      {model.text('periodLabel', 'Rótulo do período')}
      <p>
        Deixe os anos vazios para período desconhecido. A API aceita de 100001
        a.C. a 3000 d.C.
      </p>
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
    </>
  );
}

export function IdentifiersEditor({
  identifiers,
  schemes,
  issues,
  onChange,
}: {
  identifiers: IdentifierDraft[];
  schemes: IdentifierDraft['scheme'][];
  issues: IdentifierIssues;
  onChange: (next: IdentifierDraft[]) => void;
}) {
  const first = schemes[0];
  return (
    <fieldset>
      <legend>Identificadores</legend>
      <p>
        Wikidata, VIAF, ISNI, ISBN, DOI ou Open Library. Cada identificador
        pertence a um só ponto; a API aceita o endereço do registro e guarda a
        forma normalizada.
      </p>
      {issues.general.map((message) => (
        <p key={message} className="field-error" role="alert">
          {message}
        </p>
      ))}
      {identifiers.map((entry, index) => {
        const message = issues.rows[index];
        const id = `identifier-${index}`;
        return (
          <div className="form-grid identifier-row" key={index}>
            <label>
              Esquema {index + 1}
              <select
                value={entry.scheme}
                onChange={(e) =>
                  onChange(
                    identifiers.map((value, i) =>
                      i === index
                        ? {
                            ...value,
                            scheme: e.target.value as IdentifierDraft['scheme'],
                          }
                        : value,
                    ),
                  )
                }
              >
                {schemes.map((scheme) => (
                  <option key={scheme} value={scheme}>
                    {identifierSchemeLabels[scheme]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label>
                Valor {index + 1}
                <input
                  id={id}
                  value={entry.value}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? `${id}-error` : undefined}
                  onChange={(e) =>
                    onChange(
                      identifiers.map((value, i) =>
                        i === index
                          ? { ...value, value: e.target.value }
                          : value,
                      ),
                    )
                  }
                />
              </label>
              {message && (
                <span id={`${id}-error`} className="field-error">
                  {message}
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label={`Remover identificador ${index + 1}`}
              onClick={() =>
                onChange(identifiers.filter((_, i) => i !== index))
              }
            >
              Remover
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={!first}
        onClick={() =>
          first && onChange([...identifiers, { scheme: first, value: '' }])
        }
      >
        Adicionar identificador
      </button>
    </fieldset>
  );
}
