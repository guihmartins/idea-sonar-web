import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import openapiTS, { astToString } from 'openapi-typescript';
const command = process.argv[2] ?? 'check';
const hash = (value) => createHash('sha256').update(value).digest('hex');
if (command === 'import') {
  const [path, commit] = process.argv.slice(3);
  if (!path || !/^[a-f0-9]{40}$/u.test(commit ?? ''))
    throw new Error(
      'Uso: npm run contracts:import -- <snapshot-local.json> <commit-completo-da-api>',
    );
  const bytes = await readFile(path);
  const spec = JSON.parse(bytes);
  if (!spec.openapi?.startsWith('3.') || !spec.info?.version || !spec.paths)
    throw new Error('Snapshot OpenAPI 3 inválido.');
  await writeFile('contracts/openapi.json', bytes);
  await writeFile(
    'contracts/source.json',
    JSON.stringify(
      {
        status: 'available',
        repository: 'guihmartins/idea-sonar-api',
        path: 'contracts/openapi.json',
        commit,
        infoVersion: spec.info.version,
        sha256: hash(bytes),
      },
      null,
      2,
    ) + '\n',
  );
}
const source = JSON.parse(await readFile('contracts/source.json', 'utf8'));
if (source.status === 'pending') {
  if (process.env.REQUIRE_API_CONTRACT === 'true')
    throw new Error('Contrato oficial pendente: release integrada bloqueada.');
  console.log(
    'PENDENTE: OpenAPI não publicado; adapter provisório, sem cliente oficial gerado.',
  );
} else {
  const bytes = await readFile('contracts/openapi.json');
  const spec = JSON.parse(bytes);
  if (
    !/^[a-f0-9]{40}$/u.test(source.commit) ||
    hash(bytes) !== source.sha256 ||
    spec.info.version !== source.infoVersion
  )
    throw new Error('Origem/checksum/versão do contrato incompatível.');
  const output =
    '// Gerado pelo snapshot identificado em contracts/source.json. Não editar.\n' +
    astToString(await openapiTS(spec));
  const client =
    '// Gerado. Não editar.\nimport createClient from "openapi-fetch";\nimport type { paths } from "./schema";\nexport const createGeneratedClient = (baseUrl: string, fetcher: typeof fetch) => createClient<paths>({ baseUrl, fetch: fetcher });\n';
  await mkdir('src/api/generated', { recursive: true });
  for (const [name, content] of [
    ['schema.ts', output],
    ['client.ts', client],
  ]) {
    const target = `src/api/generated/${name}`;
    if (command === 'check') {
      if ((await readFile(target, 'utf8').catch(() => '')) !== content)
        throw new Error(
          `Regeneração difere: ${target}. Execute npm run contracts:generate.`,
        );
    } else await writeFile(target, content);
  }
}
