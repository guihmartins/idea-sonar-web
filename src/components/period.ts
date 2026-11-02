import type { Context } from '../api/domain';
export function displayYear(year: number): string {
  return year <= 0 ? `${1 - year} a.C.` : `${year} d.C.`;
}
// Limites da API para anos astronômicos (0 = 1 a.C.).
export const minYear = -100000;
export const maxYear = 3000;
export function astronomicalYear(value: string, era: string): number | null {
  if (!value.trim()) return null;
  const year = Number(value);
  if (!Number.isSafeInteger(year) || year < 1)
    throw new Error('Informe ano inteiro positivo e escolha a era.');
  const astronomical = era === 'bce' ? 1 - year : year;
  if (astronomical < minYear || astronomical > maxYear)
    throw new Error(
      `Ano fora do intervalo aceito: de ${displayYear(minYear)} a ${displayYear(maxYear)}`,
    );
  return astronomical;
}
// Inverso de astronomicalYear: o ano positivo e a era que o formulário mostra.
export function yearFields(year: number | null): {
  value: string;
  era: 'ce' | 'bce';
} {
  if (year === null) return { value: '', era: 'ce' };
  if (year <= 0) return { value: String(1 - year), era: 'bce' };
  return { value: String(year), era: 'ce' };
}
type Period = Pick<
  Context,
  'startYear' | 'endYear' | 'precision' | 'periodLabel'
>;
// Ponto sem ano nem rótulo não tem período a mostrar (contexto mostra "desconhecido").
export const hasPeriod = (period: Period) =>
  period.startYear !== null ||
  period.endYear !== null ||
  period.periodLabel !== null;
const yearOrUnknown = (year: number | null) =>
  year === null ? '?' : displayYear(year);
export function formatPeriod(period: Period): string {
  if (period.startYear === null && period.endYear === null)
    return period.periodLabel ?? 'Período desconhecido';
  const prefix = period.precision === 'approximate' ? 'Aproximadamente ' : '';
  const label = period.periodLabel ? ` (${period.periodLabel})` : '';
  return `${prefix}${yearOrUnknown(period.startYear)} — ${yearOrUnknown(period.endYear)}${label}`;
}
