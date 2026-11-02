// Busca das listas de pontos, fontes e contextos: o que a URL guarda, o que o
// formulário edita e o que a API recebe são o mesmo conjunto de filtros, com os
// nomes da API. Valor vazio ou igual ao padrão da API fica de fora da URL e da
// requisição (sem `match` é "contém"; `includePending` e `includeUnknownPeriod`
// só aparecem quando mudam o padrão: ligado e desligado, respectivamente).
import type { ListFilters } from '../api/adapter';
import type { EntityType, Kind } from '../api/domain';
import { kindLabels } from '../components/labels';
import {
  astronomicalYear,
  maxYear,
  minYear,
  yearFields,
} from '../components/period';

export type SearchableType = 'nodes' | 'sources' | 'contexts';
export const isSearchable = (type: EntityType): type is SearchableType =>
  type === 'nodes' || type === 'sources' || type === 'contexts';

// Limite do `q` na API.
export const maxQueryLength = 200;
export const exactLabel = 'Nome ou identificador exato';

// Ordem fixa dos parâmetros: a mesma URL para a mesma busca.
const order = [
  'q',
  'match',
  'kind',
  'includePending',
  'startYear',
  'endYear',
  'includeUnknownPeriod',
] as const;

function compact(filters: ListFilters): ListFilters {
  return Object.fromEntries(
    order.flatMap((key) => {
      const value = filters[key];
      return value === undefined || value === null ? [] : [[key, value]];
    }),
  );
}

export function paramsFromFilters(filters: ListFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(compact(filters)))
    params.set(key, String(value));
  return params;
}

const text = (raw: string | null) =>
  (raw ?? '').trim().slice(0, maxQueryLength) || undefined;
const isKind = (value: string | null): value is Kind =>
  value !== null && Object.keys(kindLabels).includes(value);
// Ano astronômico inteiro dentro dos limites da API; o resto é ignorado.
function yearParam(raw: string | null): number | undefined {
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
  const year = Number(raw);
  return year >= minYear && year <= maxYear ? year : undefined;
}

function commonFromParams(params: URLSearchParams): ListFilters {
  return {
    q: text(params.get('q')),
    match: params.get('match') === 'exact' ? 'exact' : undefined,
    includePending: params.get('includePending') === 'true' ? true : undefined,
  };
}

function nodeFromParams(params: URLSearchParams): ListFilters {
  const kind = params.get('kind');
  return {
    kind: isKind(kind) ? kind : undefined,
    startYear: yearParam(params.get('startYear')),
    endYear: yearParam(params.get('endYear')),
    includeUnknownPeriod:
      params.get('includeUnknownPeriod') === 'false' ? false : undefined,
  };
}

// URL → filtros aplicados. Parâmetro inválido ou alheio ao tipo (tipo e período
// só valem para pontos) é ignorado, em vez de virar um 400 da API.
export function filtersFromParams(
  type: SearchableType,
  params: URLSearchParams,
): ListFilters {
  return compact({
    ...commonFromParams(params),
    ...(type === 'nodes' ? nodeFromParams(params) : {}),
  });
}

// O que o formulário edita: textos e marcas, com o ano em ano civil + era.
export interface SearchDraft {
  q: string;
  exact: boolean;
  pending: boolean;
  kind: Kind | '';
  start: string;
  startEra: string;
  end: string;
  endEra: string;
  unknownPeriod: boolean;
}

export function draftFromFilters(filters: ListFilters): SearchDraft {
  const start = yearFields(filters.startYear ?? null);
  const end = yearFields(filters.endYear ?? null);
  return {
    q: filters.q ?? '',
    exact: filters.match === 'exact',
    pending: filters.includePending === true,
    kind: filters.kind ?? '',
    start: start.value,
    startEra: start.era,
    end: end.value,
    endEra: end.era,
    unknownPeriod: filters.includeUnknownPeriod !== false,
  };
}

function nodeFromDraft(draft: SearchDraft): ListFilters {
  const startYear = astronomicalYear(draft.start, draft.startEra) ?? undefined;
  const endYear = astronomicalYear(draft.end, draft.endEra) ?? undefined;
  if (startYear !== undefined && endYear !== undefined && startYear > endYear)
    throw new Error('O ano inicial não pode ser posterior ao final.');
  return {
    kind: draft.kind || undefined,
    startYear,
    endYear,
    includeUnknownPeriod: draft.unknownPeriod ? undefined : false,
  };
}

// Formulário → filtros. Ano inválido lança Error com a mensagem para o usuário.
export function filtersFromDraft(
  type: SearchableType,
  draft: SearchDraft,
): ListFilters {
  return compact({
    q: text(draft.q),
    match: draft.exact ? 'exact' : undefined,
    includePending: draft.pending ? true : undefined,
    ...(type === 'nodes' ? nodeFromDraft(draft) : {}),
  });
}

export const searchLabels: Record<SearchableType, string> = {
  nodes: 'Busca de pontos',
  sources: 'Busca de fontes',
  contexts: 'Busca de contextos',
};
export const searchHints: Record<SearchableType, string> = {
  nodes: 'Nome, outro nome ou identificador',
  sources: 'Título, DOI ou endereço',
  contexts: 'Nome do contexto',
};

// Linha de estado lida em voz alta: quantos registros as páginas já trazem.
export function countText(count: number, hasMore: boolean): string {
  const loaded =
    count === 1 ? '1 registro carregado' : `${count} registros carregados`;
  return hasMore ? `${loaded} · há mais` : loaded;
}

const emptyNouns: Record<SearchableType, string> = {
  nodes: 'Nenhum ponto encontrado',
  sources: 'Nenhuma fonte encontrada',
  contexts: 'Nenhum contexto encontrado',
};
const narrowing = [
  'kind',
  'startYear',
  'endYear',
  'includeUnknownPeriod',
] as const;

// Estado vazio que nomeia a busca; em modo exato, sugere desmarcar "exato".
export function emptyText(type: SearchableType, filters: ListFilters): string {
  const narrowed = narrowing.some((key) => filters[key] !== undefined);
  const scope = narrowed ? ' com o tipo ou o período escolhido' : '';
  if (!filters.q)
    return narrowed
      ? `${emptyNouns[type]}${scope}.`
      : 'Nenhum registro encontrado.';
  const hint =
    filters.match === 'exact'
      ? ` Desmarque “${exactLabel}” para buscar por trecho.`
      : '';
  return `${emptyNouns[type]} para “${filters.q}”${scope}.${hint}`;
}
