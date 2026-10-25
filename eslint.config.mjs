import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'reports/**',
      '.stryker-tmp/**',
      'test-results/**',
      'playwright-report/**',
      'src/api/generated/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { complexity: ['error', { max: 10, variant: 'classic' }] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['infra/cloudfront/rewrite.js'],
    languageOptions: { sourceType: 'script' },
  },
]);
