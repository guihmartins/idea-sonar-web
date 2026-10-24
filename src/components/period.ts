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
export function formatPeriod(period: {
  start: number | null;
  end: number | null;
  approximate: boolean;
}): string {
  if (period.start === null && period.end === null)
    return 'Período desconhecido';
  return `${period.approximate ? 'Aproximadamente ' : ''}${period.start === null ? '?' : displayYear(period.start)} — ${period.end === null ? '?' : displayYear(period.end)}`;
}
