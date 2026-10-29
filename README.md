# Idea Sonar Web

Frontend independente React + TypeScript estrito + Vite + Cytoscape.js, interface PT-BR. Plano original: [PLAN.md](PLAN.md). Decisões e aceite: [docs/decisions.md](docs/decisions.md).

## Modo atual: sem token

Por solicitação de 25/10/2026, `VITE_AUTH_MODE=none` é o padrão temporário. O app abre direto, sem login, `/me`, SDK OIDC ou header Authorization. Somente `VITE_API_BASE_URL` é obrigatória no build. As chamadas continuam indo à API configurada, sem fallback para fixtures. Se a API exigir autenticação, o erro é exibido; este repositório não altera a autorização do backend.

Para reativar: `VITE_AUTH_MODE=oidc`, configurar as três variáveis OIDC e reconstruir o bundle. O fluxo PKCE existente permanece disponível.

## Disponível

- Login/callback/logout opcionais (`VITE_AUTH_MODE=oidc`) com SDK oficial Auth0 (Authorization Code + PKCE, access token em memória), autorização inicial `/me` e cache privado em memória.
- Cliente HTTP com renovação única no 401, 403 explícito, request ID, cancelamento/timeout, idempotência, If-Match e limites de retry.
- Busca e grafo incremental: expansão/paginação, recolhimento seguro de nós compartilhados, filtros, histórico de foco, posições arrastadas, relações paralelas, modo lista e painel de evidências/fontes/contextos.
- Cadastro/edição/arquivamento de pontos, relações, fontes e contextos; validação de evidência e período histórico; comparação em conflitos de edição.
- Importações e confirmação de desfazer lote, pendências, histórico, salvar/restaurar views e exportação.
- Docker estático não root, Compose somente web e runbook S3/CloudFront.

**Integração real pendente:** a API ainda não publicou OpenAPI na `main` consultada em 24/10/2026 (contém apenas plano). O modelo de apresentação/adapter HTTP são **provisórios**, baseados no plano, e precisam ser reconciliados com o snapshot oficial. Nenhum contrato oficial foi inventado. Para uma futura reativação OIDC, Auth0 é o adapter escolhido e precisará de conta, issuer, audience, scopes e callbacks alinhados à API. No modo atual, basta a API permitir o acesso sem token e configurar CORS. Não há smoke real de OAuth/API. Nenhuma alteração no repositório backend.

## Executar

Node **24.19.0** (`nvm use`) e npm **11.9.0** são as versões de referência (CI/Docker); `engines` aceita Node 24.x a partir de 24.19.0 e npm >= 11.9.0. TypeScript 5.9.3 é compatível com o gerador OpenAPI escolhido. Lockfile e versões exatas são próprios.

```sh
npm ci
cp .env.example .env
# Configure VITE_API_BASE_URL. Login está desativado por padrão.
npm run dev
```

Para testar todas as telas antes da API, use dados **inteiramente fictícios**, que vivem apenas na memória da sessão:

```sh
npm run dev:fixtures
# Clique em “Entrar na demonstração fictícia”.
# Busque Jung e expanda Gnosticismo. Não são afirmações históricas.
```

O adapter fictício só é importado por `import.meta.env.DEV` com flag explícita. Qualquer build com `VITE_ENABLE_FIXTURES=true` falha. Produção não contém fixtures nem possui fallback para elas. O modo sem token não simula usuário autenticado; ele dispensa a sessão. Não existe simulação de OAuth em produção. Os fluxos de teste da demonstração não substituem smoke OAuth/API.

## Configuração no build

```dotenv
VITE_API_BASE_URL=https://api.example.com
VITE_AUTH_MODE=none
# OIDC abaixo só é obrigatório com VITE_AUTH_MODE=oidc:
VITE_OIDC_ISSUER=https://identity.example.com/
VITE_OIDC_CLIENT_ID=public-spa-client-id
VITE_OIDC_AUDIENCE=https://api.example.com
```

Os exemplos não representam serviços configurados. `VITE_API_BASE_URL` é obrigatória e aceita somente origem absoluta: sem `/api/v1`, outros caminhos, credenciais, query ou fragmento. O cliente acrescenta `/api/v1` uma vez. HTTP é aceito em desenvolvimento e em build (ambiente local e Docker sem TLS); em produção informe a URL `https` do proxy que termina o TLS (ex.: certbot na EC2). O issuer OIDC continua exigindo HTTPS em build. Parser compartilhado por Vite e app. Alterar valores exige rebuild/deploy.

Todos os `VITE_*` são públicos. Nunca use token, senha, `client_secret`, credencial AWS ou banco nesses valores. Não existe configuração runtime, proxy obrigatório ou dependência do backend para servir `dist`. CORS é configurado na API externa.

## Contrato

```sh
npm run contracts:import -- /caminho/snapshot-openapi.json COMMIT_COMPLETO_DE_40_HEX
npm run contracts:generate
npm run contracts:check
```

O comando importa um snapshot local revisado, registra origem/commit/`info.version`/SHA-256 e gera tipos/cliente com openapi-typescript/openapi-fetch. O build verifica checksum e regeneração; não baixam `latest`. Enquanto pendente, o comando informa a dependência e não inventa arquivos. `REQUIRE_API_CONTRACT=true npm run build` bloqueia uma release que exija contrato integrado. Depois da publicação ainda será necessário reconciliar o adapter e executar smoke real. Veja [api-contract.md](docs/api-contract.md).

## Workflows

O CI automático do frontend permanece desativado, com definição em `.github/workflows-disabled/ci.yml`. **Mutation tests** está disponível somente por `workflow_dispatch` em `.github/workflows/mutation.yml`, para execução manual pelo usuário após a definição estar na branch padrão. Não roda em push/PR e não foi disparado nesta alteração. Stryker também continua disponível por `npm run test:mutation`.

## ESLint e complexidade

```sh
npm run lint
npm run lint:fix
```

ESLint 10 com configuração flat em `eslint.config.mjs` e suporte TypeScript. A regra `complexity: ['error', { max: 10, variant: 'classic' }]` permite 10 e falha em 11 ou mais por função. Aplica-se a JavaScript/TypeScript/TSX próprios, incluindo componentes, fixtures, scripts e testes; só artefatos/gerados são ignorados. Sem exceções de complexidade. `--max-warnings 0` também reprova warnings.

O build executa lint antes de TypeScript/Vite. As funções que ultrapassavam o limite foram separadas por responsabilidade. Há teste de integração que usa o ESLint real para verificar o limite 10/11. O workflow automático continua desligado.

## Verificar

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e           # dist de produção: sem token, sem fixtures
npm run test:e2e:fixtures  # fluxos completos dev/test em desktop e celular
npm run preview           # inspeção local do dist; não usar em produção
npm run format:check
```

Testes cobrem transporte, sessão SDK, ledger, semântica visual, anos astronômicos, configuração, geração/checksum, navegação e fluxos. Axe verifica WCAG A/AA nas telas principais; validação manual continua necessária para leitores de tela e cenários de dados reais. O build e o smoke da imagem estática podem ser executados localmente.

## Testes de mutação (Stryker)

```sh
npm run test:mutation:baseline  # testes unitários usados pelo runner
npm run test:mutation           # mutação real com Vitest + checker TypeScript
```

Configuração em `stryker.config.mjs`, com versões exatas e dois processos concorrentes. Escopo: parser de ambiente, transporte HTTP, adapter Auth0, ledger de visibilidade, adaptação de elementos do grafo e conversão/exibição de períodos históricos. Não inclui telas React, estilos, gerados, fixtures, testes de navegador ou scripts de build; a nota não representa todo o frontend.

Relatórios gerados em `reports/mutation/index.html` e `reports/mutation/mutation.json` (ignorados no Git/Docker). Resultados e análise ficam em [docs/mutation-testing.md](docs/mutation-testing.md). **Mutation tests** é exclusivamente manual (`workflow_dispatch`); o comando local também gera os relatórios. Mutantes estáticos e operadores padrão permanecem habilitados; não são suprimidos para elevar a nota.

## Docker

```sh
docker compose up --build -d
# Env pública é passada por build.args; porta 8080.
```

Somente web. Runtime Nginx não root, filesystem read-only, sem Node/API/dev server. Para smoke local:

```sh
docker build -f infra/docker/Dockerfile -t idea-sonar-web:test \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_OIDC_ISSUER=https://identity.example.com/ \
  --build-arg VITE_OIDC_CLIENT_ID=public-test-spa \
  --build-arg VITE_OIDC_AUDIENCE=https://api.example.com .
npm run test:container
```

Proxy com CA própria: passe `--secret id=proxy_ca,src=/caminho/ca.pem`; a CA não entra na imagem final. [Deploy e migração CloudFront](docs/deploy.md).

## Organização

`src/app` compõe providers/rotas; `src/auth` encapsula SDK; `src/api` separa transporte, adapter e modelo provisório; `src/graph` separa ledger, adaptação, layout e estilos; `src/pages` implementa telas; `src/dev` contém apenas fixtures isoladas. `contracts`, `docs`, `tests` e `infra` são independentes do backend.
