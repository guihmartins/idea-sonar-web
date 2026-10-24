import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { createQueryClient } from './app/queryClient';
import { env } from './config/env';
import './app/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz da aplicação ausente.');
const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App config={env} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
