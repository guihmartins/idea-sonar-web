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
export function relationPrefill(
  params: URLSearchParams,
  typeCodes: string[] | undefined,
): RelationPrefill {
  const type = params.get('type') ?? '';
  const source = params.get('sourceId') ?? '';
  const target = params.get('targetId') ?? '';
  const status = evidenceStatusSchema.safeParse(params.get('evidenceStatus'));
  const candidates: [keyof RelationPrefill, string, boolean][] = [
    ['type', type, !!typeCodes?.includes(type)],
    ['sourceId', source, uuid.test(source)],
    // A API recusa relação de um ponto com ele mesmo.
    [
      'targetId',
      target,
      uuid.test(target) && target.toLowerCase() !== source.toLowerCase(),
    ],
    ['evidenceStatus', status.data ?? '', status.success],
  ];
  return Object.fromEntries(
    candidates.flatMap(([key, value, valid]) => (valid ? [[key, value]] : [])),
  );
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
