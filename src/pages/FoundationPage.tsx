import type { AppConfig } from '../config/schema';

export function FoundationPage({ title, config }: { title: string; config?: AppConfig }) {
  return (
    <section aria-labelledby="page-title">
      <p className="eyebrow">Conhecimento em perspectiva</p>
      <h1 id="page-title">{title}</h1>
      <p className="intro">Autores, tradições, conceitos e obras em um mapa pessoal, com contexto e evidências.</p>
      <div className="notice">
        <h2>Base da aplicação pronta</h2>
        <p>Esta é a estrutura inicial. A autenticação e a integração com a API ainda estão em preparação.</p>
        <p>Nenhum dado pessoal é carregado nesta etapa.</p>
        {config && <p className="endpoint">API configurada: <code>{config.apiBaseUrl}</code></p>}
      </div>
    </section>
  );
}
