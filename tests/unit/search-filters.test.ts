import { describe, expect, it } from 'vitest';
import type { ListFilters } from '../../src/api/adapter';
import {
  countText,
  draftFromFilters,
  emptyText,
  filtersFromDraft,
  filtersFromParams,
  isSearchable,
  maxQueryLength,
  paramsFromFilters,
} from '../../src/pages/searchFilters';
import type { SearchDraft } from '../../src/pages/searchFilters';

const params = (text: string) => new URLSearchParams(text);
const draft = (extra: Partial<SearchDraft> = {}): SearchDraft => ({
  q: '',
  exact: false,
  pending: false,
  kind: '',
  start: '',
  startEra: 'ce',
  end: '',
  endEra: 'ce',
  unknownPeriod: true,
  ...extra,
});

describe('isSearchable', () => {
  it.each([
    ['nodes', true],
    ['sources', true],
    ['contexts', true],
    ['relations', false],
    ['views', false],
  ] as const)('%s: %s', (type, expected) => {
    expect(isSearchable(type)).toBe(expected);
  });
});

describe('filtersFromParams', () => {
  it('URL vazia: nenhum filtro', () => {
    for (const type of ['nodes', 'sources', 'contexts'] as const)
      expect(filtersFromParams(type, params(''))).toEqual({});
  });

  it('pontos: todos os filtros, com os nomes da API', () => {
    const url =
      'q=Jung&match=exact&kind=figure&includePending=true&startYear=-499&endYear=0&includeUnknownPeriod=false';
    expect(filtersFromParams('nodes', params(url))).toEqual({
      q: 'Jung',
      match: 'exact',
      kind: 'figure',
      includePending: true,
      startYear: -499,
      endYear: 0,
      includeUnknownPeriod: false,
    });
  });

  it.each(['sources', 'contexts'] as const)(
    '%s: só texto, modo e pendentes; tipo e período são ignorados',
    (type) => {
      const url =
        'q=a&match=exact&includePending=true&kind=person&startYear=1&endYear=2&includeUnknownPeriod=false';
      expect(filtersFromParams(type, params(url))).toEqual({
        q: 'a',
        match: 'exact',
        includePending: true,
      });
    },
  );

  it('valores fora do padrão da API são ignorados', () => {
    expect(
      filtersFromParams(
        'nodes',
        params(
          'match=contains&includePending=false&includePending=1&includeUnknownPeriod=true&kind=planta',
        ),
      ),
    ).toEqual({});
    expect(filtersFromParams('nodes', params('match=Exact'))).toEqual({});
    expect(filtersFromParams('nodes', params('kind=toString'))).toEqual({});
    expect(filtersFromParams('nodes', params('kind='))).toEqual({});
  });

  it('o texto perde espaços nas pontas e é cortado no limite da API', () => {
    expect(filtersFromParams('nodes', params('q=%20%20Jung%20'))).toEqual({
      q: 'Jung',
    });
    expect(filtersFromParams('nodes', params('q=%20%20'))).toEqual({});
    expect(filtersFromParams('nodes', params('q='))).toEqual({});
    const long = 'a'.repeat(maxQueryLength + 50);
    expect(filtersFromParams('nodes', params(`q=${long}`)).q).toBe(
      'a'.repeat(maxQueryLength),
    );
    const exact = 'b'.repeat(maxQueryLength);
    expect(filtersFromParams('nodes', params(`q=${exact}`)).q).toBe(exact);
  });

  it('anos: inteiros de -100000 a 3000; o resto é ignorado', () => {
    const year = (name: string, value: string) =>
      filtersFromParams('nodes', params(`${name}=${value}`));
    expect(year('startYear', '-100000')).toEqual({ startYear: -100000 });
    expect(year('startYear', '3000')).toEqual({ startYear: 3000 });
    expect(year('endYear', '0')).toEqual({ endYear: 0 });
    expect(year('endYear', '-1')).toEqual({ endYear: -1 });
    for (const bad of ['-100001', '3001', '1.5', 'abc', '', '+5', '1e3', ' 5'])
      expect(year('startYear', bad)).toEqual({});
    expect(year('endYear', '3001')).toEqual({});
  });
});

describe('paramsFromFilters', () => {
  it('ordem fixa, uma busca igual dá a mesma URL', () => {
    const filters: ListFilters = {
      includeUnknownPeriod: false,
      endYear: 0,
      startYear: -499,
      includePending: true,
      kind: 'work',
      match: 'exact',
      q: 'Q42',
    };
    expect(paramsFromFilters(filters).toString()).toBe(
      'q=Q42&match=exact&kind=work&includePending=true&startYear=-499&endYear=0&includeUnknownPeriod=false',
    );
  });

  it('omite o que é vazio, nulo ou indefinido e mantém o zero', () => {
    expect(paramsFromFilters({}).toString()).toBe('');
    expect(
      paramsFromFilters({
        q: undefined,
        match: undefined,
        startYear: null,
        endYear: null,
      }).toString(),
    ).toBe('');
    expect(paramsFromFilters({ startYear: 0, endYear: 0 }).toString()).toBe(
      'startYear=0&endYear=0',
    );
  });

  it('codifica acento, espaço e símbolos', () => {
    expect(paramsFromFilters({ q: 'Édipo & filhos' }).toString()).toBe(
      'q=%C3%89dipo+%26+filhos',
    );
  });

  it('ida e volta com a URL', () => {
    const url =
      'q=a+b&match=exact&kind=concept&includePending=true&startYear=-9&endYear=900&includeUnknownPeriod=false';
    const filters = filtersFromParams('nodes', params(url));
    expect(paramsFromFilters(filters).toString()).toBe(url);
  });
});

describe('formulário', () => {
  it('draftFromFilters: sem filtros, formulário padrão', () => {
    expect(draftFromFilters({})).toEqual(draft());
  });

  it('draftFromFilters: ano astronômico vira ano civil e era', () => {
    expect(
      draftFromFilters({
        q: 'Jung',
        match: 'exact',
        includePending: true,
        kind: 'person',
        startYear: -499,
        endYear: 1900,
        includeUnknownPeriod: false,
      }),
    ).toEqual(
      draft({
        q: 'Jung',
        exact: true,
        pending: true,
        kind: 'person',
        start: '500',
        startEra: 'bce',
        end: '1900',
        endEra: 'ce',
        unknownPeriod: false,
      }),
    );
    expect(draftFromFilters({ startYear: 0, endYear: 1 })).toMatchObject({
      start: '1',
      startEra: 'bce',
      end: '1',
      endEra: 'ce',
    });
    expect(draftFromFilters({ includeUnknownPeriod: true }).unknownPeriod).toBe(
      true,
    );
    expect(draftFromFilters({ match: 'contains' }).exact).toBe(false);
  });

  it('filtersFromDraft: formulário padrão não filtra nada', () => {
    for (const type of ['nodes', 'sources', 'contexts'] as const)
      expect(filtersFromDraft(type, draft())).toEqual({});
  });

  it('filtersFromDraft: pontos levam tipo e período em ano astronômico', () => {
    expect(
      filtersFromDraft(
        'nodes',
        draft({
          q: '  Jung ',
          exact: true,
          pending: true,
          kind: 'figure',
          start: '500',
          startEra: 'bce',
          end: '30',
          endEra: 'ce',
          unknownPeriod: false,
        }),
      ),
    ).toEqual({
      q: 'Jung',
      match: 'exact',
      kind: 'figure',
      includePending: true,
      startYear: -499,
      endYear: 30,
      includeUnknownPeriod: false,
    });
  });

  it('filtersFromDraft: um só ano, e "desconhecido" ligado é o padrão', () => {
    expect(
      filtersFromDraft('nodes', draft({ start: '1', startEra: 'bce' })),
    ).toEqual({ startYear: 0 });
    expect(
      filtersFromDraft('nodes', draft({ end: '1', endEra: 'bce' })),
    ).toEqual({
      endYear: 0,
    });
    expect(filtersFromDraft('nodes', draft({ start: '5', end: '5' }))).toEqual({
      startYear: 5,
      endYear: 5,
    });
  });

  it.each(['sources', 'contexts'] as const)(
    'filtersFromDraft: %s ignora tipo e período, mesmo preenchidos',
    (type) => {
      expect(
        filtersFromDraft(
          type,
          draft({
            q: 'a',
            exact: true,
            pending: true,
            kind: 'work',
            start: 'x',
            end: '2',
            unknownPeriod: false,
          }),
        ),
      ).toEqual({ q: 'a', match: 'exact', includePending: true });
    },
  );

  it.each(['0', '-3', '1.5', 'abc'])(
    'ano inválido (%s) lança a mensagem',
    (value) => {
      expect(() => filtersFromDraft('nodes', draft({ start: value }))).toThrow(
        'Informe ano inteiro positivo e escolha a era.',
      );
      expect(() => filtersFromDraft('nodes', draft({ end: value }))).toThrow(
        'Informe ano inteiro positivo e escolha a era.',
      );
    },
  );

  it('ano fora dos limites da API lança com o intervalo aceito', () => {
    expect(() =>
      filtersFromDraft('nodes', draft({ start: '100002', startEra: 'bce' })),
    ).toThrow('de 100001 a.C. a 3000 d.C.');
    expect(() =>
      filtersFromDraft('nodes', draft({ end: '3001', endEra: 'ce' })),
    ).toThrow('de 100001 a.C. a 3000 d.C.');
    expect(
      filtersFromDraft('nodes', draft({ start: '100001', startEra: 'bce' })),
    ).toEqual({ startYear: -100000 });
    expect(filtersFromDraft('nodes', draft({ end: '3000' }))).toEqual({
      endYear: 3000,
    });
  });

  it('ano inicial depois do final lança; igual ou anterior passa', () => {
    const message = 'O ano inicial não pode ser posterior ao final.';
    expect(() =>
      filtersFromDraft('nodes', draft({ start: '10', end: '9' })),
    ).toThrow(message);
    expect(() =>
      filtersFromDraft(
        'nodes',
        draft({ start: '10', startEra: 'ce', end: '10', endEra: 'bce' }),
      ),
    ).toThrow(message);
    expect(() =>
      filtersFromDraft('nodes', draft({ start: '10', end: '10' })),
    ).not.toThrow();
    expect(
      filtersFromDraft(
        'nodes',
        draft({ start: '10', startEra: 'bce', end: '10', endEra: 'ce' }),
      ),
    ).toEqual({ startYear: -9, endYear: 10 });
  });

  it('fontes e contextos não validam ano', () => {
    expect(() =>
      filtersFromDraft('sources', draft({ start: '0', end: '-1' })),
    ).not.toThrow();
  });
});

describe('textos da lista', () => {
  it('countText: singular, plural, zero e "há mais"', () => {
    expect(countText(0, false)).toBe('0 registros carregados');
    expect(countText(1, false)).toBe('1 registro carregado');
    expect(countText(2, false)).toBe('2 registros carregados');
    expect(countText(50, true)).toBe('50 registros carregados · há mais');
    expect(countText(1, true)).toBe('1 registro carregado · há mais');
  });

  it('emptyText: sem busca, o texto de sempre', () => {
    for (const type of ['nodes', 'sources', 'contexts'] as const) {
      expect(emptyText(type, {})).toBe('Nenhum registro encontrado.');
      expect(emptyText(type, { includePending: true })).toBe(
        'Nenhum registro encontrado.',
      );
      expect(emptyText(type, { match: 'exact' })).toBe(
        'Nenhum registro encontrado.',
      );
    }
  });

  it('emptyText: nomeia a busca no gênero do tipo', () => {
    expect(emptyText('nodes', { q: 'zzz' })).toBe(
      'Nenhum ponto encontrado para “zzz”.',
    );
    expect(emptyText('sources', { q: 'zzz' })).toBe(
      'Nenhuma fonte encontrada para “zzz”.',
    );
    expect(emptyText('contexts', { q: 'zzz' })).toBe(
      'Nenhum contexto encontrado para “zzz”.',
    );
  });

  it('emptyText: no modo exato sugere desmarcar "exato"', () => {
    expect(emptyText('nodes', { q: 'Q42', match: 'exact' })).toBe(
      'Nenhum ponto encontrado para “Q42”. Desmarque “Nome ou identificador exato” para buscar por trecho.',
    );
    expect(emptyText('nodes', { q: 'Q42', match: 'contains' })).not.toContain(
      'Desmarque',
    );
  });

  it('emptyText: tipo e período entram na frase', () => {
    for (const filters of [
      { kind: 'work' },
      { startYear: 0 },
      { endYear: 0 },
      { includeUnknownPeriod: false },
    ] as const)
      expect(emptyText('nodes', { ...filters })).toBe(
        'Nenhum ponto encontrado com o tipo ou o período escolhido.',
      );
    expect(emptyText('nodes', { q: 'a', kind: 'work' })).toBe(
      'Nenhum ponto encontrado para “a” com o tipo ou o período escolhido.',
    );
    expect(
      emptyText('nodes', { q: 'a', kind: 'work', match: 'exact' }),
    ).toContain('escolhido. Desmarque');
  });
});
