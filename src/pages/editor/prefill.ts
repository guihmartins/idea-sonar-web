// Pré-preenchimento do editor de relação por URL, só para relação nova:
// `/edit/relations?type=…&sourceId=…&targetId=…&evidenceStatus=…`. É um ponto de
// partida: nada é salvo, e o usuário ainda escreve a afirmação, a autoria da
// inferência e a justificativa. Valor inválido é ignorado, nunca vira erro.
import { evidenceStatusSchema } from '../../api/domain';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const prefillKeys = [
  'type',
  'sourceId',
  'targetId',
  'evidenceStatus',
] as const;
export type RelationPrefill = Partial<
  Record<(typeof prefillKeys)[number], string>
>;

export const hasPrefill = (params: URLSearchParams) =>
  prefillKeys.some((key) => params.has(key));

// `typeCodes`: predicados do catálogo; sem catálogo o tipo não pode ser conferido
// e fica de fora.
const isId = (value: string | null): value is string =>
  value !== null && uuid.test(value);

export function relationPrefill(
  params: URLSearchParams,
  typeCodes: string[] | undefined,
): RelationPrefill {
  const type = params.get('type');
  const source = params.get('sourceId');
  const target = params.get('targetId');
  const status = evidenceStatusSchema.safeParse(params.get('evidenceStatus'));
  const prefill: RelationPrefill = {};
  if (type !== null && typeCodes?.includes(type)) prefill.type = type;
  if (isId(source)) prefill.sourceId = source;
  // A API recusa relação de um ponto com ele mesmo.
  if (isId(target) && target.toLowerCase() !== source?.toLowerCase())
    prefill.targetId = target;
  if (status.success) prefill.evidenceStatus = status.data;
  return prefill;
}

// O que "Registrar paralelo" abre: paralelo de a para b, como inferência.
export function parallelEditorPath(a: string, b: string): string {
  const params = new URLSearchParams({
    type: 'parallel_to',
    sourceId: a,
    targetId: b,
    evidenceStatus: 'inference',
  });
  return `/edit/relations?${params}`;
}
