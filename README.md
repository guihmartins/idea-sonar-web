# Idea Sonar Web

Frontend independente em React, TypeScript estrito, Vite e Cytoscape.js, com interface PT-BR. Escopo e aceite completos em [PLAN.md](PLAN.md).

## Estado da implementação

Marco 1: configuração, estrutura e navegação inicial. As páginas são estados explícitos de preparação: não carregam dados, não simulam login e não alegam integração concluída. Não há backend, banco ou servidor MCP neste repositório.

## Desenvolvimento

Use Node **24.19.0** (`nvm use`) e npm **11.9.0**. Dependências exatas e lockfile são próprios deste projeto.

```sh
npm ci
cp .env.example .env
# Configure as quatro variáveis públicas no .env.
npm run dev
```

Exemplos de domínio/cliente não representam uma conta ou API configurada. HTTP é permitido somente em `localhost`/`127.0.0.1` durante desenvolvimento. O backend local deve ser cross-origin e permitir a origem do Vite por CORS.

## Validação e build

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

O E2E usa `dist` do build anterior em desktop e celular. `preview` é somente uma ferramenta de verificação, não o servidor final de produção.

O build exige `VITE_API_BASE_URL`, `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID` e `VITE_OIDC_AUDIENCE` via `.env` ou ambiente. A base da API aceita apenas uma origem HTTPS, sem `/api/v1`, caminho, credenciais, query ou fragmento. A configuração central deriva `<origem>/api/v1` e normaliza a barra final. Qualquer `vite build`, inclusive `--mode development`, exige HTTPS. Sem configuração válida o build falha. Alterar valores exige rebuild e deploy.

Todos os `VITE_*` são públicos. Nunca coloque tokens, senhas, `client_secret` ou credenciais AWS nesses valores. Não há `config.json`, proxy obrigatório nem configuração injetada no startup.

## Estrutura e próximos marcos

- `src/app`, `components`, `pages`: composição, navegação e UI.
- `src/config`: parser compartilhado entre Vite e aplicação.
- `src/api`: contrato versionado e transporte; [pendência](docs/api-contract.md).
- `src/auth`: SDK OIDC/PKCE e ciclo de sessão; [escopo](docs/auth.md).
- `src/graph`: adaptação, layout, visibilidade e estilos Cytoscape.
- `contracts`: metadados do snapshot; não contém contrato inventado.
- `tests`: configuração, navegação e smoke da estrutura em navegador.
- `infra`: etapas futuras de Docker estático e CloudFront; [deploy](docs/deploy.md).

Marcos seguintes: contrato e autenticação/HTTP; navegação do grafo e evidências; edição e conflitos; importações/pendências/histórico/views; Docker e validação integrada. Decisões e limites em [docs/decisions.md](docs/decisions.md).
