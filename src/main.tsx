import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { createQueryClient } from './app/queryClient';
import { ServicesProvider } from './app/services';
import type { Services } from './app/services';
import { createTransport } from './api/client';
import { createApi } from './api/adapter';
import { env } from './config/env';
import '@fontsource-variable/dm-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/400-italic.css';
import '@fontsource/source-serif-4/600.css';
import './app/styles.css';
async function bootstrap() {
  const root = document.getElementById('root');
  if (!root) throw new Error('Elemento raiz ausente.');
  let services: Services;
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_FIXTURES === 'true') {
    const { createFixtureServices, createAtlasPreviewServices } =
      await import('./dev/fixtures');
    // Cenário isolado de aceitação visual (rodada 3, fidelidade ao Atlas):
    // só ativo com a flag explícita na URL, nunca no fluxo normal da
    // demonstração fictícia. Ver docs/decisions.md e dev/fixtures.ts.
    services =
      new URLSearchParams(location.search).get('atlas') === 'preview'
        ? createAtlasPreviewServices()
        : createFixtureServices();
  } else if (env.authMode === 'none') {
    services = {
      session: null,
      api: createApi(createTransport(env.apiV1Url, null)),
      fictitious: false,
    };
  } else {
    const { createSession } = await import('./auth/auth0');
    const session = createSession(env);
    services = {
      session,
      api: createApi(createTransport(env.apiV1Url, session)),
      fictitious: false,
    };
  }
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={createQueryClient()}>
        <BrowserRouter>
          <ServicesProvider services={services}>
            <App />
          </ServicesProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
void bootstrap().catch(() => {
  const root = document.getElementById('root');
  if (root)
    root.textContent =
      'Não foi possível iniciar o Idea Sonar. Verifique a configuração pública do build.';
});
