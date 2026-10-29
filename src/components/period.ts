import type { Context } from '../api/domain';
export function displayYear(year: number): string {
  return year <= 0 ? `${1 - year} a.C.` : `${year} d.C.`;
}
export function astronomicalYear(value: string, era: string): number | null {
  if (!value.trim()) return null;
  const year = Number(value);
  if (!Number.isSafeInteger(year) || year < 1)
    throw new Error('Informe ano inteiro positivo e escolha a era.');
  return era === 'bce' ? 1 - year : year;
}
const yearOrUnknown = (year: number | null) =>
  year === null ? '?' : displayYear(year);
export function formatPeriod(
  period: Pick<Context, 'startYear' | 'endYear' | 'precision' | 'periodLabel'>,
): string {
  if (period.startYear === null && period.endYear === null)
    return period.periodLabel ?? 'Período desconhecido';
  const prefix = period.precision === 'approximate' ? 'Aproximadamente ' : '';
  const label = period.periodLabel ? ` (${period.periodLabel})` : '';
  return `${prefix}${yearOrUnknown(period.startYear)} — ${yearOrUnknown(period.endYear)}${label}`;
}
