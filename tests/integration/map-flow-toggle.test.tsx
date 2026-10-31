import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { ServicesProvider } from '../../src/app/services';
import { createQueryClient } from '../../src/app/queryClient';
import { createFixtureServices } from '../../src/dev/fixtures';
function mockPrefersReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn() }),
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
});
async function openMap() {
  const services = createFixtureServices();
  await services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/map']}>
        <ServicesProvider services={services}>
          <App />
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'Explorar mapa' });
}
describe('botão Fluxo do mapa', () => {
  it('inicia pressionado quando o usuário não pediu menos movimento', async () => {
    mockPrefersReducedMotion(false);
    await openMap();
    expect(
      await screen.findByRole('button', { name: 'Fluxo' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('inicia despressionado quando prefers-reduced-motion está ativo', async () => {
    mockPrefersReducedMotion(true);
    await openMap();
    expect(
      await screen.findByRole('button', { name: 'Fluxo' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
  it('alterna aria-pressed ao clicar', async () => {
    mockPrefersReducedMotion(false);
    const user = userEvent.setup();
    await openMap();
    const toggle = await screen.findByRole('button', { name: 'Fluxo' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
