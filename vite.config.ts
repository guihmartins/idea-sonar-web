import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { parseEnvironment } from './src/config/schema.ts';

export default defineConfig(({ command, mode, isPreview }) => {
  if (!isPreview) {
    // --mode development não permite HTTP em artefatos de produção.
    parseEnvironment(
      loadEnv(mode, process.cwd(), 'VITE_'),
      command === 'serve',
    );
  }
  return {
    plugins: [react()],
    define:
      command === 'build'
        ? {
            'import.meta.env.DEV': 'false',
            'import.meta.env.PROD': 'true',
          }
        : {},
    build: { sourcemap: false },
  };
});
