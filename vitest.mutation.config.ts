import { defineConfig } from 'vitest/config';
import base from './vitest.config.ts';

// A mutação cobre todo src, então precisa também dos testes de integração de
// tela. Ficam de fora apenas os que sobem subprocessos (build, ESLint,
// contratos): por mutante isso custaria minutos e nada neles testa src.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/integration/build-env.test.ts',
      'tests/integration/lint.test.ts',
      'tests/integration/contracts.test.ts',
    ],
  },
});
