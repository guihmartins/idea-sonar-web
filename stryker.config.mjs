/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  $schema: './node_modules/@stryker-mutator/core/schema/stryker-schema.json',
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts', related: true },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  // Mesmo escopo da cobertura (qualityExclude em vitest.config.ts): todo src,
  // menos o gerado do contrato, as fixtures de dev e o bootstrap.
  mutate: [
    'src/**/*.{ts,tsx}',
    '!src/api/generated/**',
    '!src/dev/**',
    '!src/main.tsx',
    '!src/**/*.d.ts',
  ],
  coverageAnalysis: 'perTest',
  concurrency: 4,
  // Telas com React Testing Library e user-event são bem mais lentas que as
  // funções puras do marco 1; 2s derrubava mutante vivo como timeout.
  timeoutMS: 20000,
  timeoutFactor: 2,
  // Reaproveita o resultado dos mutantes cujo código e testes não mudaram.
  // Estado em reports/ (ignorado no git); `--force` refaz a execução inteira.
  incremental: true,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  thresholds: { high: 80, low: 60, break: 80 },
  cleanTempDir: 'always',
};
