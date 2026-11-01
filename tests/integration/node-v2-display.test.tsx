import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { createQueryClient } from '../../src/app/queryClient';
import { ServicesProvider } from '../../src/app/services';
import { createFixtureServices, ids } from '../../src/dev/fixtures';
import { MapPage } from '../../src/pages/MapPage';
import { RecordsPage } from '../../src/pages/RecordsPage';
import type { Node } from '../../src/api/domain';

vi.mock('../../src/graph/GraphCanvas', () => ({
  GraphCanvas: () => <div role="img" aria-label="grafo" />,
}));

function renderAt(
  path: string,
  element: ReactElement,
  services = createFixtureServices(),
  route = path,
) {
  void services.session.login();
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <ServicesProvider services={services}>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </ServicesProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return services;
}

const dated: Node = {
  id: ids.jung,
  version: 1,
  status: 'active',
  createdAt: '2026-10-24T12:00:00.000Z',
  updatedAt: '2026-10-24T12:00:00.000Z',
  kind: 'figure',
  label: 'Figura datada fictícia',
  description: 'Registro sintético com período e identificadores.',
  conceptScope: null,
  startYear: 1875,
  endYear: 1961,
  precision: 'approximate',
  periodLabel: 'séc. XIX–XX',
  aliases: [],
  identifiers: [
    { scheme: 'wikidata', value: 'Q1000001' },
    { scheme: 'viaf', value: '12345' },
    { scheme: 'isni', value: '000000012103218X' },
    { scheme: 'doi', value: '10.1000/abc' },
    { scheme: 'openlibrary', value: 'OL1A' },
    { scheme: 'openlibrary', value: 'OL2W' },
    { scheme: 'openlibrary', value: 'OL3M' },
    { scheme: 'isbn', value: '9780140449136' },
  ],
  contexts: [],
  degreeTotal: 0,
  archivedAt: null,
};
const links = (list: HTMLElement) =>
  within(list)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);

describe('ponto — período e identificadores na tela', () => {
  it('o painel do mapa mostra o período e os identificadores como links seguros', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'node').mockResolvedValue(dated);
    renderAt('/map', <MapPage />, services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Buscar ponto' }),
      'Jung',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );
    expect(
      await screen.findByText(
        'Aproximadamente 1875 d.C. — 1961 d.C. (séc. XIX–XX)',
      ),
    ).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Identificadores' });
    expect(links(list)).toEqual([
      ['Wikidata: Q1000001 ↗', 'https://www.wikidata.org/wiki/Q1000001'],
      ['VIAF: 12345 ↗', 'https://viaf.org/viaf/12345'],
      ['ISNI: 000000012103218X ↗', 'https://isni.org/isni/000000012103218X'],
      ['DOI: 10.1000/abc ↗', 'https://doi.org/10.1000/abc'],
      ['Open Library: OL1A ↗', 'https://openlibrary.org/authors/OL1A'],
      ['Open Library: OL2W ↗', 'https://openlibrary.org/works/OL2W'],
      ['Open Library: OL3M ↗', 'https://openlibrary.org/books/OL3M'],
    ]);
    for (const link of within(list).getAllByRole('link')) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    }
    // ISBN não tem página própria: fica em texto, sem link.
    expect(within(list).getByText('ISBN: 9780140449136')).toBeInTheDocument();
    expect(within(list).queryByRole('link', { name: /ISBN/ })).toBeNull();
  });

  it('ponto sem período nem identificadores não ganha linhas vazias', async () => {
    const services = createFixtureServices();
    renderAt('/map', <MapPage />, services);
    const user = userEvent.setup();
    await user.type(
      await screen.findByRole('textbox', { name: 'Buscar ponto' }),
      'Jung',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await user.click(
      await screen.findByRole('button', { name: /Jung \(exemplo fictício\)/ }),
    );
    await screen.findByRole('heading', { level: 2, name: /Jung/ });
    expect(
      screen.queryByRole('list', { name: 'Identificadores' }),
    ).not.toBeInTheDocument();
    expect(document.querySelector('.details-panel .period')).toBeNull();
  });

  it('a lista de pontos mostra o período no resumo e os identificadores', async () => {
    const services = createFixtureServices();
    vi.spyOn(services.api, 'list').mockResolvedValue({
      items: [dated],
      nextCursor: null,
    });
    renderAt('/nodes', <RecordsPage type="nodes" />, services);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Figura datada fictícia',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Figura · Aproximadamente 1875 d.C. — 1961 d.C. (séc. XIX–XX) · Registro sintético com período e identificadores.',
      ),
    ).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Identificadores' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
  });
});
