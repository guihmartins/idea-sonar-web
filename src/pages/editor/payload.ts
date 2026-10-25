import type { Api } from '../../api/adapter';
import type { Catalog, Entity, Relation } from '../../api/domain';
import { astronomicalYear } from '../../components/period';
export type Editable = 'nodes' | 'relations' | 'sources' | 'contexts';
export interface EditorDraft {
  fields: Record<string, string>;
  baseline: Entity | undefined;
  contexts: string[];
  evidence: Relation['evidence'];
  approximate: boolean;
  contested: boolean;
}
function nodeBody(draft: EditorDraft) {
  return {
    kind: draft.fields.kind,
    aliases: (draft.fields.aliases ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    conceptScope: draft.fields.conceptScope,
    contexts: draft.contexts,
    degreeTotal:
      draft.baseline && 'degreeTotal' in draft.baseline
        ? draft.baseline.degreeTotal
        : 0,
  };
}
function sourceBody({ fields }: EditorDraft) {
  if (fields.url && !['https:', 'http:'].includes(new URL(fields.url).protocol))
    throw new Error('Use uma URL HTTP(S) para a fonte.');
  return { author: fields.author, url: fields.url };
}
function contextBody({ fields, approximate }: EditorDraft) {
  const start = astronomicalYear(fields.start ?? '', fields.startEra ?? 'ce');
  const end = astronomicalYear(fields.end ?? '', fields.endEra ?? 'ce');
  if (start !== null && end !== null && end < start)
    throw new Error('O fim do período deve ser posterior ao início.');
  return { region: fields.region, period: { start, end, approximate } };
}
function requireRelation(fields: Record<string, string>) {
  if (
    !fields.sourceId ||
    !fields.targetId ||
    !fields.type ||
    !fields.claim?.trim()
  )
    throw new Error(
      'Selecione origem, destino, predicado e informe a afirmação.',
    );
  return { sourceId: fields.sourceId, targetId: fields.targetId };
}
function validateSources({ fields, evidence }: EditorDraft) {
  if (
    fields.evidenceStatus !== 'inference' &&
    (!evidence.length || evidence.some((entry) => !entry.sourceId))
  )
    throw new Error(
      'Uma fonte é obrigatória para relação documentada ou interpretação atribuída.',
    );
}
function validateAttribution({ fields }: EditorDraft) {
  if (
    fields.evidenceStatus === 'inference' &&
    (!fields.attribution?.trim() || !fields.justification?.trim())
  )
    throw new Error('Inferência exige autoria e justificativa.');
}
async function relationBody(
  draft: EditorDraft,
  catalog: Catalog | undefined,
  api: Api,
) {
  const { fields, evidence, contested } = draft;
  const endpoints = requireRelation(fields);
  const predicate = catalog?.predicates.find(
    (value) => value.id === fields.type,
  );
  if (!predicate) throw new Error('Selecione um predicado do catálogo da API.');
  const [source, target] = await Promise.all([
    api.node(endpoints.sourceId),
    api.node(endpoints.targetId),
  ]);
  if (
    !predicate.sourceKinds.includes(source.kind) ||
    !predicate.targetKinds.includes(target.kind)
  )
    throw new Error(
      'Tipos incompatíveis com o predicado retornado pelo catálogo.',
    );
  validateSources(draft);
  validateAttribution(draft);
  return {
    ...endpoints,
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
async function specificBody(
  type: Editable,
  draft: EditorDraft,
  catalog: Catalog | undefined,
  api: Api,
) {
  switch (type) {
    case 'nodes':
      return nodeBody(draft);
    case 'sources':
      return sourceBody(draft);
    case 'contexts':
      return contextBody(draft);
    case 'relations':
      return relationBody(draft, catalog, api);
  }
}
export async function buildEditorBody(
  type: Editable,
  draft: EditorDraft,
  catalog: Catalog | undefined,
  api: Api,
): Promise<Record<string, unknown>> {
  return {
    label: draft.fields.label?.trim(),
    description: draft.fields.description,
    status: draft.fields.status,
    ...(await specificBody(type, draft, catalog, api)),
  };
}
