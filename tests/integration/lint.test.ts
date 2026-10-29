// @vitest-environment node
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('ESLint aceita complexidade 10 e acusa erro em 11', async () => {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
  });
  function sample(branches: number) {
    const conditions = Array.from(
      { length: branches },
      (_, index) => `if (value > ${index}) result++;`,
    ).join('\n');
    return `export function boundary(value: number) { let result = 0; ${conditions} return result; }`;
  }
  const accepted = await eslint.lintText(sample(9), {
    filePath: 'src/complexity-boundary.ts',
  });
  expect(accepted[0]?.messages).toEqual([]);
  const rejected = await eslint.lintText(sample(10), {
    filePath: 'src/complexity-boundary.ts',
  });
  expect(rejected[0]?.messages).toEqual([
    expect.objectContaining({
      ruleId: 'complexity',
      severity: 2,
      message: expect.stringContaining('complexity of 11'),
    }),
  ]);
});
