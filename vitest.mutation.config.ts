import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';

// CLI/build, navegador e fixtures têm seus próprios testes. Mutação avalia a
// lógica de domínio com testes unitários, sem subprocessos/builds por mutante.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/unit/**/*.test.ts'],
  },
});
