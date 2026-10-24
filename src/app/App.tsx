import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { AppConfig } from '../config/schema';
import { FoundationPage } from '../pages/FoundationPage';

export function App({ config }: { config: AppConfig }) {
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="header">
        <Link className="brand" to="/map"><span aria-hidden="true">◉</span> Idea Sonar</Link>
        <span className="badge">Em construção</span>
      </header>
      <div className="shell">
        <nav aria-label="Navegação principal">
          <p className="eyebrow">Seu mapa de ideias</p>
          <NavLink to="/map">Explorar mapa</NavLink>
          <NavLink to="/imports">Importações</NavLink>
          <NavLink to="/pending">Pendências</NavLink>
          <NavLink to="/views">Views salvas</NavLink>
        </nav>
        <main id="conteudo" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<FoundationPage title="Explore conexões entre ideias" config={config} />} />
            <Route path="/imports" element={<FoundationPage title="Importações" />} />
            <Route path="/imports/:id" element={<FoundationPage title="Detalhes da importação" />} />
            <Route path="/pending" element={<FoundationPage title="Pendências" />} />
            <Route path="/views" element={<FoundationPage title="Views salvas" />} />
            <Route path="/login" element={<FoundationPage title="Entrar no Idea Sonar" />} />
            <Route path="/callback" element={<FoundationPage title="Autenticação em preparação" />} />
            <Route path="/access-denied" element={<section><h1>Acesso negado</h1><p>Esta conta não tem permissão para acessar os dados.</p></section>} />
            <Route path="*" element={<section><h1>Página não encontrada</h1><Link to="/map">Voltar ao mapa</Link></section>} />
          </Routes>
        </main>
      </div>
    </>
  );
}
