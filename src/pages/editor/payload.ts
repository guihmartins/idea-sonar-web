import type { Api } from '../../api/adapter';
import type { Catalog, Evidence, Node, RelationType } from '../../api/domain';
import { astronomicalYear } from '../../components/period';
export type Editable = 'nodes' | 'relations' | 'sources' | 'contexts';
export interface EvidenceDraft {
  sourceId: string;
  sourceKind: Evidence['sourceKind'];
  stance: Evidence['stance'];
  locator: string;
  excerpt: string;
  explanation: string;
  conversationReference: string;
}
export interface EditorDraft {
  fields: Record<string, string>;
  contexts: string[];
  evidence: EvidenceDraft[];
  contested: boolean;
}
export const emptyEvidence: EvidenceDraft = {
  sourceId: '',
  sourceKind: 'secondary',
  stance: 'supports',
  locator: '',
  excerpt: '',
  explanation: '',
  conversationReference: '',
};
export function evidenceDraft(entry: Evidence): EvidenceDraft {
  return {
    ...entry,
    sourceId: entry.sourceId ?? '',
    excerpt: entry.excerpt ?? '',
    conversationReference: entry.conversationReference ?? '',
  };
}
const text = (value: string | undefined) => (value ?? '').trim();
const orNull = (value: string | undefined) => text(value) || null;
// "Nome (idioma)"; sem idioma, usa "und" (indeterminado, BCP 47).
const aliasPattern = /^(.*\S)\s*\(([A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*)\)$/u;
export function parseAliases(value: string): Node['aliases'] {
  return value
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
    .map((alias) => {
      const match = aliasPattern.exec(alias);
      return {
        alias: match?.[1] ?? alias,
        language: match?.[2] ?? 'und',
      };
    });
}
export function formatAliases(aliases: Node['aliases']): string {
  return aliases
    .map((a) => (a.language === 'und' ? a.alias : `${a.alias} (${a.language})`))
    .join(', ');
}
function nodeBody({ fields, contexts }: EditorDraft) {
  const concept = fields.kind === 'concept';
  if (concept && !fields.conceptScope)
    throw new Error('Conceitos exigem escopo: amplo ou contextualizado.');
  return {
    kind: fields.kind,
    label: text(fields.label),
    description: text(fields.description),
    conceptScope: concept ? fields.conceptScope : null,
    aliases: parseAliases(fields.aliases ?? ''),
    contexts,
  };
}
function isHttpUrl(value: string) {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
function sourceBody({ fields }: EditorDraft) {
  const reference = {
    canonicalUrl: orNull(fields.canonicalUrl),
    publicationLabel: orNull(fields.publicationLabel),
    doi: orNull(fields.doi),
  };
  if (reference.canonicalUrl && !isHttpUrl(reference.canonicalUrl))
    throw new Error('Use uma URL HTTP(S) para a fonte.');
  if (!Object.values(reference).some(Boolean))
    throw new Error(
      'Informe URL, DOI ou publicação para que a fonte seja recuperável.',
    );
  return {
    title: text(fields.title),
    authorText: text(fields.authorText),
    ...reference,
    notes: orNull(fields.notes),
  };
}
function contextBody({ fields }: EditorDraft) {
  const startYear = astronomicalYear(
    fields.start ?? '',
    fields.startEra ?? 'ce',
  );
  const endYear = astronomicalYear(fields.end ?? '', fields.endEra ?? 'ce');
  if (startYear !== null && endYear !== null && endYear < startYear)
    throw new Error('O fim do período deve ser posterior ao início.');
  return {
    label: text(fields.label),
    startYear,
    endYear,
    precision: fields.precision,
    periodLabel: orNull(fields.periodLabel),
    regionLabel: orNull(fields.regionLabel),
    notes: orNull(fields.notes),
  };
}
function requireRelation(fields: Record<string, string>) {
  if (
    !fields.sourceId ||
    !fields.targetId ||
    !fields.type ||
    !text(fields.claim) ||
    !text(fields.justification)
  )
    throw new Error(
      'Selecione origem, destino, predicado e informe afirmação e justificativa.',
    );
  return { sourceId: fields.sourceId, targetId: fields.targetId };
}
async function validateEndpoints(
  type: RelationType,
  endpoints: { sourceId: string; targetId: string },
  api: Api,
) {
  const [source, target] = await Promise.all([
    api.node(endpoints.sourceId),
    api.node(endpoints.targetId),
  ]);
  if (
    !type.allowedEndpoints.some(
      (e) => e.source === source.kind && e.target === target.kind,
    )
  )
    throw new Error(
      'Tipos incompatíveis com o predicado retornado pelo catálogo.',
    );
}
function evidenceInput(entry: EvidenceDraft) {
  if (!text(entry.locator) || !text(entry.explanation))
    throw new Error('Cada evidência exige localizador e explicação.');
  return {
    sourceId: orNull(entry.sourceId),
    sourceKind: entry.sourceKind,
    stance: entry.stance,
    locator: text(entry.locator),
    excerpt: orNull(entry.excerpt),
    explanation: text(entry.explanation),
    conversationReference: orNull(entry.conversationReference),
  };
}
type EvidenceInput = ReturnType<typeof evidenceInput>;
// Mesmas regras da API, com mensagens antes do envio.
function validateSupport(
  status: string | undefined,
  evidence: EvidenceInput[],
) {
  if (
    status !== 'inference' &&
    !evidence.some(
      (e) =>
        e.stance === 'supports' &&
        e.sourceId &&
        e.sourceKind !== 'conversation',
    )
  )
    throw new Error(
      'Uma fonte é obrigatória para relação documentada ou interpretação atribuída: adicione evidência que a sustente.',
    );
}
function validateAttribution(fields: Record<string, string>) {
  if (fields.evidenceStatus === 'inference' && !text(fields.inferenceAuthor))
    throw new Error('Inferência exige autoria da inferência.');
  if (
    fields.evidenceStatus === 'attributed_interpretation' &&
    !text(fields.attributionText)
  )
    throw new Error('Interpretação atribuída exige a atribuição.');
  if (fields.intensity && !text(fields.intensityReason))
    throw new Error('Justifique a intensidade avaliada.');
}
function validateContestation(
  fields: Record<string, string>,
  evidence: EvidenceInput[],
) {
  const stances = new Set(evidence.map((e) => e.stance));
  if (!stances.has('supports') || !stances.has('challenges'))
    throw new Error(
      'Relação contestada exige evidências que sustentam e que contestam.',
    );
  if (!text(fields.contestationNote))
    throw new Error('Explique a contestação.');
}
async function relationBody(
  draft: EditorDraft,
  catalog: Catalog | undefined,
  api: Api,
) {
  const { fields, contested } = draft;
  const endpoints = requireRelation(fields);
  const type = catalog?.relationTypes.find((t) => t.code === fields.type);
  if (!type) throw new Error('Selecione um predicado do catálogo da API.');
  await validateEndpoints(type, endpoints, api);
  const evidence = draft.evidence.map(evidenceInput);
  validateSupport(fields.evidenceStatus, evidence);
  validateAttribution(fields);
  if (contested) validateContestation(fields, evidence);
  return {
    ...endpoints,
    type: type.code,
    contextId: orNull(fields.contextId),
    claim: text(fields.claim),
    justification: text(fields.justification),
    evidenceStatus: fields.evidenceStatus,
    intensity: fields.intensity ? Number(fields.intensity) : null,
    intensityReason: orNull(fields.intensityReason),
    attributionText: orNull(fields.attributionText),
    inferenceAuthor: orNull(fields.inferenceAuthor),
    contested,
    contestationNote: contested ? orNull(fields.contestationNote) : null,
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
    status: draft.fields.status,
    ...(await specificBody(type, draft, catalog, api)),
  };
}
