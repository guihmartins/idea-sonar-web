import { readdir, readFile } from 'node:fs/promises';
const files = await readdir('dist/assets');
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const body = await readFile(`dist/assets/${file}`, 'utf8');
  for (const forbidden of [
    'fixture-only',
    'Trecho fictício: este material',
    'Autor fictício',
    'createFixtureServices',
  ]) {
    if (body.includes(forbidden))
      throw new Error(`Fixture no bundle de produção: ${file}`);
  }
}
console.log(
  'OK: fixtures de desenvolvimento ausentes do JavaScript de produção.',
);
