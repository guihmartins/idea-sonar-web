import { describe, expect, it } from 'vitest';
import {
  astronomicalYear,
  displayYear,
  formatPeriod,
} from '../../src/components/period';

describe('períodos históricos', () => {
  it.each([
    [0, '1 a.C.'],
    [-1, '2 a.C.'],
    [1, '1 d.C.'],
    [2026, '2026 d.C.'],
  ] as const)('exibe ano astronômico %i como %s', (year, label) => {
    expect(displayYear(year)).toBe(label);
  });
  it('converte eras sem confundir ano desconhecido, 1 a.C. e 1 d.C.', () => {
    expect(astronomicalYear('1', 'bce')).toBe(0);
    expect(astronomicalYear('2', 'bce')).toBe(-1);
    expect(astronomicalYear('1', 'ce')).toBe(1);
    expect(astronomicalYear('2026', 'ce')).toBe(2026);
    expect(astronomicalYear('  ', 'ce')).toBeNull();
  });
  it.each(['0', '-1', '1.5', 'abc', 'Infinity', '9007199254740992'])(
    'rejeita ano civil inválido: %s',
    (value) => {
      expect(() => astronomicalYear(value, 'bce')).toThrow(
        'ano inteiro positivo',
      );
    },
  );
  const period = (
    startYear: number | null,
    endYear: number | null,
    precision: 'unknown' | 'approximate' | 'range' | 'exact' = 'range',
    periodLabel: string | null = null,
  ) => ({ startYear, endYear, precision, periodLabel });
  it.each([
    [period(null, null, 'unknown'), 'Período desconhecido'],
    [period(null, null, 'approximate'), 'Período desconhecido'],
    [period(null, null, 'unknown', 'Antiguidade'), 'Antiguidade'],
    [period(0, 1), '1 a.C. — 1 d.C.'],
    [period(-1, 100, 'approximate'), 'Aproximadamente 2 a.C. — 100 d.C.'],
    [period(null, 0), '? — 1 a.C.'],
    [period(1, null, 'approximate'), 'Aproximadamente 1 d.C. — ?'],
    [period(1, 2, 'exact', 'Fase inicial'), '1 d.C. — 2 d.C. (Fase inicial)'],
  ])(
    'preserva intervalo, aproximação, rótulo e extremos desconhecidos',
    (period, label) => {
      expect(formatPeriod(period)).toBe(label);
    },
  );
});
