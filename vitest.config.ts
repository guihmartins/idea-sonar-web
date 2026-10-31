import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Escopo de qualidade: todo src, menos o que não é código nosso (gerado do
// contrato), não entra no bundle de produção (fixtures de dev) ou é só
// bootstrap sem lógica (main.tsx). O mesmo escopo vale para a mutação.
export const qualityExclude = [
  'src/api/generated/**',
  'src/dev/**',
  'src/main.tsx',
  '**/*.d.ts',
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
    ],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: qualityExclude,
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
