import { describe, expect, it } from 'vitest';
import { identifierUrl } from '../../src/components/identifiers';
import {
  astronomicalYear,
  hasPeriod,
  maxYear,
  minYear,
} from '../../src/components/period';
import { entitySummary } from '../../src/components/labels';
import type { Node } from '../../src/api/domain';

describe('identifierUrl', () => {
  it.each([
    [
      { scheme: 'wikidata', value: 'Q1000001' },
      'https://www.wikidata.org/wiki/Q1000001',
    ],
    [{ scheme: 'viaf', value: '12345678' }, 'https://viaf.org/viaf/12345678'],
    [
      { scheme: 'isni', value: '000000012103218X' },
      'https://isni.org/isni/000000012103218X',
    ],
    [
      { scheme: 'doi', value: '10.1000/abc.def' },
      'https://doi.org/10.1000/abc.def',
    ],
    [
      { scheme: 'doi', value: '10.1000/a b#c?d' },
      'https://doi.org/10.1000/a%20b%23c%3Fd',
    ],
    [
      { scheme: 'openlibrary', value: 'OL123A' },
      'https://openlibrary.org/authors/OL123A',
    ],
    [
      { scheme: 'openlibrary', value: 'OL45W' },
      'https://openlibrary.org/works/OL45W',
    ],
    [
      { scheme: 'openlibrary', value: 'OL9M' },
      'https://openlibrary.org/books/OL9M',
    ],
  ] as const)('%j vira %s', (identifier, url) => {
    expect(identifierUrl(identifier)).toBe(url);
  });
  it('ISBN e Open Library sem sufixo A/W/M ficam sem link', () => {
    expect(
      identifierUrl({ scheme: 'isbn', value: '9780140449136' }),
    ).toBeNull();
    expect(identifierUrl({ scheme: 'openlibrary', value: 'OL123' })).toBeNull();
  });
});

describe('limites de ano da API', () => {
  it('aceita os extremos e recusa além deles, em d.C. e a.C.', () => {
    expect(astronomicalYear('3000', 'ce')).toBe(maxYear);
    expect(astronomicalYear('100001', 'bce')).toBe(minYear);
    expect(() => astronomicalYear('3001', 'ce')).toThrow(
      'Ano fora do intervalo aceito: de 100001 a.C. a 3000 d.C.',
    );
    expect(() => astronomicalYear('100002', 'bce')).toThrow(
      'Ano fora do intervalo aceito',
    );
  });
});

describe('período de ponto', () => {
  const period = {
    startYear: null,
    endYear: null,
    precision: 'unknown',
    periodLabel: null,
  } as const;
  it('hasPeriod só vale com ano ou rótulo', () => {
    expect(hasPeriod(period)).toBe(false);
    expect(hasPeriod({ ...period, startYear: 0 })).toBe(true);
    expect(hasPeriod({ ...period, endYear: -5 })).toBe(true);
    expect(hasPeriod({ ...period, periodLabel: 'século V' })).toBe(true);
  });
  it('o resumo do ponto mostra o período formatado só quando existe', () => {
    const node = {
      kind: 'figure',
      description: 'Figura arquetípica',
      ...period,
    } as unknown as Node;
    expect(entitySummary('nodes', node)).toBe('Figura · Figura arquetípica');
    expect(
      entitySummary('nodes', {
        ...node,
        startYear: 1875,
        endYear: 1961,
        precision: 'exact',
      } as Node),
    ).toBe('Figura · 1875 d.C. — 1961 d.C. · Figura arquetípica');
  });
});
