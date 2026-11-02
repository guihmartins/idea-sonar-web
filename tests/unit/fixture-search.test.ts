import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/client';
import type { Source } from '../../src/api/domain';
import { createFixtureServices } from '../../src/dev/fixtures';
import {
  contextMatches,
  cursorAt,
  cursorStart,
  listScope,
  sourceMatches,
  textMatches,
} from '../../src/dev/fixture-search';

// A API fictícia filtra fontes e contextos como a real (contrato 1.2.0):
// texto sem acento nem caixa, DOI/URL exatos e pendentes só sob pedido.
type Fixtures = ReturnType<typeof createFixtureServices>;
let services: Fixtures;
const signal = new AbortController().signal;
const titles = async (
  type: 'nodes' | 'sources' | 'contexts',
  filters: Parameters<Fixtures['api']['list']>[3],
) =>
  (await services.api.list(type, null, signal, filters)).items.map((item) =>
    'title' in item ? item.title : 'label' in item ? item.label : '',
  );
const source = (extra: Partial<Source>) => ({
  title: 'Tratado de Alquimia',
  authorText: 'Autor fictício',
  canonicalUrl: null,
  workNodeId: null,
  publicationLabel: null,
  doi: null,
  accessedAt: null,
  notes: null,
  status: 'active',
  ...extra,
});
const create = (type: 'sources' | 'contexts', body: object, key: string) =>
  services.api.save(type, body, key);

beforeEach(async () => {
  services = createFixtureServices();
  await services.session.login();
});

describe('fontes', () => {
  it('título sem acento nem caixa, por trecho ou inteiro', async () => {
    expect(await titles('sources', { q: 'SINTETICA de' })).toEqual([
      'Fonte sintética de demonstração',
    ]);
    expect(
      await titles('sources', { q: 'sintética', match: 'contains' }),
    ).toEqual(['Fonte sintética de demonstração']);
    expect(await titles('sources', { q: 'xyz' })).toEqual([]);
    expect(
      await titles('sources', {
        q: 'FONTE SINTETICA DE DEMONSTRACAO',
        match: 'exact',
      }),
    ).toEqual(['Fonte sintética de demonstração']);
    expect(
      await titles('sources', { q: 'Fonte sintética', match: 'exact' }),
    ).toEqual([]);
  });

  it('DOI inteiro encontra o dono, com ou sem endereço do resolvedor; trecho de DOI não', async () => {
    await create(
      'sources',
      source({ title: 'Artigo com DOI', doi: '10.1234/ABC.5' }),
      'k1',
    );
    for (const q of [
      '10.1234/abc.5',
      'https://doi.org/10.1234/ABC.5',
      'doi:10.1234/abc.5',
      '  10.1234/abc.5 ',
    ])
      for (const match of ['exact', 'contains'] as const)
        expect(await titles('sources', { q, match })).toEqual([
          'Artigo com DOI',
        ]);
    expect(await titles('sources', { q: '10.1234', match: 'exact' })).toEqual(
      [],
    );
    expect(await titles('sources', { q: '10.1234' })).toEqual([]);
  });

  it('URL canônica inteira encontra a fonte; trecho da URL não', async () => {
    const url = 'https://example.com/fonte-ficticia';
    for (const match of ['exact', 'contains'] as const)
      expect(await titles('sources', { q: url, match })).toEqual([
        'Fonte sintética de demonstração',
      ]);
    expect(
      await titles('sources', {
        q: 'https://example.com/fonte',
        match: 'exact',
      }),
    ).toEqual([]);
    expect(await titles('sources', { q: 'example.com' })).toEqual([]);
  });

  it('pendentes só com includePending e arquivados nunca', async () => {
    await create(
      'sources',
      source({ title: 'Rascunho', status: 'pending' }),
      'k2',
    );
    await create(
      'sources',
      source({ title: 'Antiga', status: 'archived' }),
      'k3',
    );
    expect(await titles('sources', { q: 'rascunho' })).toEqual([]);
    expect(
      await titles('sources', { q: 'rascunho', includePending: false }),
    ).toEqual([]);
    expect(
      await titles('sources', { q: 'rascunho', includePending: true }),
    ).toEqual(['Rascunho']);
    expect(
      await titles('sources', { q: 'antiga', includePending: true }),
    ).toEqual([]);
    expect(await titles('sources', { includePending: true })).toEqual([
      'Fonte sintética de demonstração',
      'Rascunho',
    ]);
  });

  it('sourceMatches: sem texto tudo passa; doi e URL nulos nunca coincidem', () => {
    const plain = source({}) as Source;
    expect(sourceMatches(plain, '', 'exact')).toBe(true);
    expect(sourceMatches(plain, 'tratado', null)).toBe(true);
    expect(sourceMatches(plain, 'tratado', 'exact')).toBe(false);
    expect(sourceMatches(plain, 'Tratado de Alquimia', 'exact')).toBe(true);
    expect(sourceMatches(plain, '10.1234/x', 'exact')).toBe(false);
    expect(sourceMatches({ ...plain, doi: '' }, '', 'exact')).toBe(true);
    expect(sourceMatches({ ...plain, doi: '' }, 'null', null)).toBe(false);
  });
});

describe('contextos', () => {
  it('rótulo sem acento nem caixa, por trecho ou inteiro', async () => {
    expect(await titles('contexts', { q: 'FICTICIO' })).toEqual([
      'Contexto fictício',
    ]);
    expect(
      await titles('contexts', { q: 'contexto ficticio', match: 'exact' }),
    ).toEqual(['Contexto fictício']);
    expect(await titles('contexts', { q: 'contexto', match: 'exact' })).toEqual(
      [],
    );
    expect(await titles('contexts', { q: 'outro' })).toEqual([]);
  });

  it('só o rótulo conta: a região não entra na busca', async () => {
    expect(await titles('contexts', { q: 'região de teste' })).toEqual([]);
  });

  it('pendentes só com includePending', async () => {
    await create(
      'contexts',
      {
        label: 'Contexto em revisão',
        regionLabel: null,
        startYear: null,
        endYear: null,
        precision: 'unknown',
        periodLabel: null,
        traditionNodeId: null,
        notes: null,
        status: 'pending',
      },
      'k4',
    );
    expect(await titles('contexts', { q: 'revisão' })).toEqual([]);
    expect(
      await titles('contexts', { q: 'REVISAO', includePending: true }),
    ).toEqual(['Contexto em revisão']);
  });

  it('contextMatches: texto vazio passa', () => {
    const context = { label: 'Idade Média' } as Parameters<
      typeof contextMatches
    >[0];
    expect(contextMatches(context, '', 'exact')).toBe(true);
    expect(contextMatches(context, 'idade media', 'exact')).toBe(true);
    expect(contextMatches(context, 'idade', 'exact')).toBe(false);
    expect(contextMatches(context, 'idade', null)).toBe(true);
  });
});

describe('textMatches', () => {
  const params = (text: string) => new URLSearchParams(text);
  it('relações e views ignoram o texto; pontos, fontes e contextos o usam', async () => {
    const relations = await services.api.list('relations', null, signal, {
      q: 'nada disso',
    });
    expect(relations.items.length).toBeGreaterThan(0);
    const views = await services.api.list('views', null, signal, { q: 'zzz' });
    expect(views.items).toEqual([]);
    expect(textMatches('relations', {} as never, params('q=x'))).toBe(true);
    expect(textMatches('views', {} as never, params('q=x'))).toBe(true);
    expect(await titles('nodes', { q: 'jung' })).toEqual([
      'Jung (exemplo fictício)',
    ]);
  });
});

describe('cursor preso aos filtros', () => {
  it('listScope ignora cursor e limite e ordena os demais', () => {
    expect(
      listScope(
        new URLSearchParams('q=a&cursor=2&limit=50&includePending=true'),
      ),
    ).toBe('includePending=true&q=a');
    expect(listScope(new URLSearchParams('cursor=2&limit=50'))).toBe('');
  });

  it('cursorAt e cursorStart: ida e volta; sem filtros o cursor é só o número', () => {
    expect(cursorAt(2, '')).toBe('2');
    expect(cursorAt(4, 'q=a')).toBe('4:q=a');
    expect(cursorStart(null, 'q=a')).toBe(0);
    expect(cursorStart('2', '')).toBe(2);
    expect(cursorStart('4:q=a', 'q=a')).toBe(4);
  });

  it('cursorStart recusa o cursor de outra busca, com 400 e o campo cursor', () => {
    for (const [cursor, scope] of [
      ['2', 'q=a'],
      ['2:q=a', ''],
      ['2:q=a', 'q=b'],
    ] as const) {
      try {
        cursorStart(cursor, scope);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const failure = error as ApiError;
        // Mesmo código e mensagem da API real (repositories/list-query.ts).
        expect([failure.status, failure.code, failure.message]).toEqual([
          400,
          'INVALID_CURSOR',
          'Cursor não corresponde aos filtros',
        ]);
      }
    }
  });

  it('a lista pagina dentro de uma busca e recusa o cursor depois de mudar o filtro', async () => {
    const first = await services.api.list('nodes', null, signal, {});
    expect(first.nextCursor).toBe('2');
    const second = await services.api.list(
      'nodes',
      first.nextCursor,
      signal,
      {},
    );
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBe('4');
    const third = await services.api.list(
      'nodes',
      second.nextCursor,
      signal,
      {},
    );
    expect(third.items).toHaveLength(2);
    expect(third.nextCursor).toBeNull();

    await services.api.save(
      'nodes',
      {
        kind: 'work',
        label: 'Rascunho de obra',
        description: 'Pendente.',
        conceptScope: null,
        status: 'pending',
      },
      'k5',
    );
    const filtered = await services.api.list('nodes', null, signal, {
      includePending: true,
    });
    expect(filtered.nextCursor).toBe('2:includePending=true');
    const rest = await services.api.list('nodes', filtered.nextCursor, signal, {
      includePending: true,
    });
    expect(rest.items.length).toBeGreaterThan(0);
    await expect(
      services.api.list('nodes', filtered.nextCursor, signal, {}),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.list('nodes', first.nextCursor, signal, {
        includePending: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      services.api.list('nodes', filtered.nextCursor, signal, {
        includePending: true,
        q: 'a',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
