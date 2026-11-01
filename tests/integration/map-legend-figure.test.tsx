import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices } from '../../src/dev/fixtures';
import { MapPage } from '../../src/pages/MapPage';

vi.mock('../../src/graph/GraphCanvas', () => ({
  GraphCanvas: () => <div role="img" aria-label="grafo" />,
}));

describe('mapa — legenda dos tipos', () => {
  it('a legenda do mapa desenha a figura em SVG, como os outros tipos', async () => {
    const services = createFixtureServices();
    void services.session.login();
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={['/map']}>
          <ServicesProvider services={services}>
            <MapPage />
          </ServicesProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const item = await screen.findByText('Figura', {
      selector: '.kind-key li',
    });
    const shapes = [...document.querySelectorAll('.kind-key li svg')];
    expect(shapes).toHaveLength(5);
    expect(item.querySelector('svg polygon')).toHaveAttribute(
      'points',
      '7,1.75 12.75,12.25 1.25,12.25',
    );
    expect(item.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(item.textContent).toBe('Figura');
  });
});
