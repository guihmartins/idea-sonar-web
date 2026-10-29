import { useEffect, useRef } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { SessionGate } from './services';
import { MapPage } from '../pages/MapPage';
import { EntityEditor } from '../pages/EntityEditor';
import {
  RecordsPage,
  ImportsPage,
  ImportPage,
  PendingPage,
  HistoryPage,
  ExportPage,
} from '../pages/RecordsPage';
export function App() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus();
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="header">
        <Link className="brand" to="/map">
          <span className="brand-mark" aria-hidden="true" />
          Idea Sonar
        </Link>
        <span className="badge">Conhecimento em perspectiva</span>
      </header>
      <SessionGate>
        <div className="shell">
          <nav aria-label="Navegação principal">
            <p className="eyebrow">Seu mapa de ideias</p>
            <NavLink to="/map">Explorar mapa</NavLink>
            <NavLink to="/nodes">Pontos</NavLink>
            <NavLink to="/relations">Relações</NavLink>
            <NavLink to="/sources">Fontes</NavLink>
            <NavLink to="/contexts">Contextos</NavLink>
            <NavLink to="/imports">Importações</NavLink>
            <NavLink to="/pending">Pendências</NavLink>
            <NavLink to="/views">Views salvas</NavLink>
            <NavLink to="/export">Exportar dados</NavLink>
          </nav>
          <main ref={main} id="conteudo" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Navigate to="/map" replace />} />
              <Route path="/login" element={<Navigate to="/map" replace />} />
              <Route
                path="/callback"
                element={<p role="status">Concluindo autenticação…</p>}
              />
              <Route path="/map" element={<MapPage />} />
              {(
                ['nodes', 'relations', 'sources', 'contexts', 'views'] as const
              ).map((type) => (
                <Route
                  key={type}
                  path={`/${type}`}
                  element={<RecordsPage type={type} />}
                />
              ))}
              <Route path="/edit/:type" element={<EntityEditor />} />
              <Route path="/edit/:type/:id" element={<EntityEditor />} />
              <Route path="/imports" element={<ImportsPage />} />
              <Route path="/imports/:id" element={<ImportPage />} />
              <Route path="/pending" element={<PendingPage />} />
              <Route path="/history/:type/:id" element={<HistoryPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route
                path="/access-denied"
                element={
                  <section>
                    <h1>Acesso negado</h1>
                    <p>Esta conta não tem permissão para acessar os dados.</p>
                  </section>
                }
              />
              <Route
                path="*"
                element={
                  <section>
                    <h1>Página não encontrada</h1>
                    <Link to="/map">Voltar ao mapa</Link>
                  </section>
                }
              />
            </Routes>
          </main>
        </div>
      </SessionGate>
    </>
  );
}
