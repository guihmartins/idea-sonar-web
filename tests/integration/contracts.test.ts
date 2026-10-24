// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
const script = fileURLToPath(
  new URL('../../scripts/contracts.mjs', import.meta.url),
);
it('importa somente snapshot identificado, regenera e detecta checksum alterado', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'idea-contract-test-'));
  try {
    mkdirSync(join(cwd, 'contracts'));
    // Contrato sintético exclusivamente neste diretório temporário, sem alegação oficial.
    const snapshot = join(cwd, 'synthetic.json');
    writeFileSync(
      snapshot,
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'SYNTHETIC TEST ONLY', version: 'test' },
        paths: {},
      }),
    );
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    expect(run('import', snapshot, 'a'.repeat(40)).status).toBe(0);
    expect(run('check').status).toBe(0);
    expect(
      readFileSync(join(cwd, 'src/api/generated/client.ts'), 'utf8'),
    ).toContain('openapi-fetch');
    writeFileSync(join(cwd, 'src/api/generated/schema.ts'), '// drift');
    expect(run('check').status).toBe(1);
    expect(run('generate').status).toBe(0);
    writeFileSync(join(cwd, 'contracts/openapi.json'), '{}');
    expect(run('check').status).toBe(1);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
