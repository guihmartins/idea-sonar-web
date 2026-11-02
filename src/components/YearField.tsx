// Ano e era de um período: o formulário pede o ano civil positivo e a era, e
// astronomicalYear (period.ts) converte para o ano astronômico da API. Devolve
// dois rótulos, para caírem lado a lado na grade do formulário.
export interface YearFieldProps {
  label: string;
  eraLabel: string;
  year: string | undefined;
  era: string | undefined;
  onYear: (year: string) => void;
  onEra: (era: string) => void;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
}

export function YearField({
  label,
  eraLabel,
  year,
  era,
  onYear,
  onEra,
  invalid,
  describedBy,
}: YearFieldProps) {
  return (
    <>
      <label>
        {label}
        <input
          type="number"
          min="1"
          step="1"
          value={year}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onYear(e.target.value)}
        />
      </label>
      <label>
        {eraLabel}
        <select value={era} onChange={(e) => onEra(e.target.value)}>
          <option value="ce">d.C.</option>
          <option value="bce">a.C.</option>
        </select>
      </label>
    </>
  );
}
