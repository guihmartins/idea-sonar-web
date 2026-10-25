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
  it.each([
    [{ start: null, end: null, approximate: false }, 'Período desconhecido'],
    [{ start: null, end: null, approximate: true }, 'Período desconhecido'],
    [{ start: 0, end: 1, approximate: false }, '1 a.C. — 1 d.C.'],
    [
      { start: -1, end: 100, approximate: true },
      'Aproximadamente 2 a.C. — 100 d.C.',
    ],
    [{ start: null, end: 0, approximate: false }, '? — 1 a.C.'],
    [{ start: 1, end: null, approximate: true }, 'Aproximadamente 1 d.C. — ?'],
  ])(
    'preserva intervalo, aproximação e extremos desconhecidos',
    (period, label) => {
      expect(formatPeriod(period)).toBe(label);
    },
  );
});
