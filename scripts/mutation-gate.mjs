// Gate por arquivo sobre o relatório do Stryker: o break global de 80% deixa um
// arquivo central fraco passar na média de arquivos simples. Uso:
//   node scripts/mutation-gate.mjs [reports/mutation/mutation.json] [mínimo]
import { readFile } from 'node:fs/promises';

// Núcleo: regras de domínio, ingestão e adaptadores que gravam ou expõem dados.
const core = [
  /^src\/api\//,
  /^src\/graph\//,
  /^src\/pages\/editor\/payload\.ts$/,
];
const detected = new Set(['Killed', 'Timeout']);
const counted = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);

const [path = 'reports/mutation/mutation.json', minimum = '80'] =
  process.argv.slice(2);
const threshold = Number(minimum);
const report = JSON.parse(await readFile(path, 'utf8'));

function score(mutants) {
  const valid = mutants.filter((m) => counted.has(m.status));
  const hits = valid.filter((m) => detected.has(m.status)).length;
  return {
    valid: valid.length,
    open: valid.length - hits,
    score: valid.length ? (100 * hits) / valid.length : 100,
  };
}

const rows = Object.entries(report.files)
  .filter(([file]) => core.some((pattern) => pattern.test(file)))
  .map(([file, { mutants }]) => ({ file, ...score(mutants) }))
  .sort((a, b) => a.score - b.score);
const all = score(Object.values(report.files).flatMap((f) => f.mutants));

console.log(
  `Mutação global: ${all.score.toFixed(2)}% (${all.valid} mutantes válidos)`,
);
console.log(`Núcleo, mínimo ${threshold}% por arquivo:`);
for (const r of rows)
  console.log(
    `  ${r.score >= threshold ? 'ok   ' : 'FALHA'} ${r.score.toFixed(2).padStart(6)}%  ${String(r.open).padStart(4)} abertos  ${r.file}`,
  );
const failing = rows.filter((r) => r.score < threshold);
if (!rows.length) {
  console.error(
    'Nenhum arquivo do núcleo no relatório: confira o escopo do Stryker.',
  );
  process.exit(1);
}
if (failing.length) {
  console.error(
    `${failing.length} arquivo(s) do núcleo abaixo de ${threshold}%.`,
  );
  process.exit(1);
}
