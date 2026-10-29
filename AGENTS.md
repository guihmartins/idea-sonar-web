# idea-sonar-web — guia para agentes

Frontend do Idea Sonar: SPA em PT-BR para explorar e editar um grafo pessoal de
conhecimento (pontos, relações, fontes, contextos, views). Consome a API REST do
repo irmão `idea-sonar-api` (`/api/v1`). Plano original em `PLAN.md`; decisões
em `docs/decisions.md`.

## Stack

- Node 24.19.0 / npm 11.9.0 de referência (`.nvmrc`, Docker); `engines` aceita
  Node 24.x >= 24.19.0 e npm >= 11.9.0, com `engine-strict` e versões exatas.
- React 19, Vite 8, TypeScript 5.9 estrito, react-router 7, TanStack Query 5,
  zod 4, Cytoscape.js (carregado sob demanda), Auth0 SPA SDK (só no modo `oidc`).
- Testes: Vitest + Testing Library (unit/integration), Playwright + axe (E2E),
  Stryker (mutação, só manual).

## Estrutura

```
src/
  main.tsx, app/        providers, rotas (App.tsx), sessão/serviços (services.tsx)
  config/               schema.ts valida VITE_* (mesmo parser no Vite e no app)
  api/client.ts         transporte HTTP: timeout, retries, If-Match, Idempotency-Key, erros
  api/domain.ts         schemas zod das respostas + ContractCheck contra os tipos gerados
  api/adapter.ts        rotas/filtros/corpos da API; valida cada resposta
  api/generated/        gerado de contracts/openapi.json — nunca editar
  auth/                 sessão PKCE (Auth0), usada só com VITE_AUTH_MODE=oidc
  graph/                ledger de expansões, adaptação para Cytoscape, layout, restore
  pages/                MapPage, RecordsPage (listas/imports/pendências/histórico), EntityEditor
  components/           Feedback, labels (rótulos PT-BR), period (anos astronômicos)
  dev/fixtures.ts       API fictícia em memória, só em dev com VITE_ENABLE_FIXTURES=true
contracts/              openapi.json (snapshot da API) + source.json (commit/SHA-256)
tests/                  unit/, integration/, e2e/ (API real), e2e-fixtures/ (fictício)
infra/docker/           Dockerfile (build Node → nginx não root :8080) e default.conf
```

## Comandos

```sh
npm ci
npm run dev               # Vite em :5173 (lê .env/.env.local)
npm run dev:fixtures      # sem backend, dados fictícios em memória
npm run lint              # ESLint, complexidade máx. 10, 0 warnings
npm run typecheck
npm test                  # Vitest
npm run test:e2e:fixtures # Playwright desktop+mobile com fixtures (npx playwright install chromium)
npm run format:check      # Prettier (npm run format corrige)
npm run build             # contracts:check + lint + typecheck + vite build + check-dist
npm run contracts:import -- <openapi.json> <commit-40-hex>   # novo snapshot da API
npm run contracts:generate                                   # regenera src/api/generated
npm run test:mutation     # Stryker — só manual
```

Antes de concluir: `lint`, `typecheck`, `test`, `format:check` e, se tocou telas,
`test:e2e:fixtures`. O build exige `VITE_API_BASE_URL`.

## Configuração (build-time)

- `VITE_API_BASE_URL` (obrigatória): só a origem da API, sem `/api/v1`; HTTP ou
  HTTPS em dev e build (TLS de produção termina no proxy). Embutida no bundle:
  mudar exige rebuild.
- `VITE_AUTH_MODE`: `none` (padrão; sem login nem token) ou `oidc` (exige
  `VITE_OIDC_ISSUER` HTTPS, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_AUDIENCE`).
- `VITE_ENABLE_FIXTURES=true` só em dev; qualquer build com ela falha.
- Todos os `VITE_*` são públicos: nunca coloque segredos. `.env*` reais são ignorados.

## Contrato com a API

- A API é a fonte da verdade (`idea-sonar-api/contracts/openapi.json`). Ao mudar
  o contrato lá: importe o snapshot (`contracts:import` com o commit), regenere e
  ajuste `domain.ts`/`adapter.ts` até `typecheck` (ContractCheck) e testes passarem.
- Formatos-chave: `version` inteiro (PATCH envia `If-Match: <versão>`), POST de
  criação com `Idempotency-Key`; filtros `kind, contextId, includePending,
startYear, endYear, includeUnknownPeriod`; listas `{ items, nextCursor }`.
- Títulos por tipo: nodes/contexts `label`, sources `title`, relations `claim`,
  views `name` (`components/labels.ts`). Anos são astronômicos (0 = 1 a.C.).
- Fixtures (`src/dev/fixtures.ts`) devem seguir os mesmos formatos da API.

## Convenções

- Commits em PT-BR no estilo conventional (`feat:`, `fix:`, `build:`, `docs:`, `test:`).
- Complexidade > 10 quebra o lint: extraia componentes/helpers.
- Textos de interface em PT-BR; acessibilidade verificada por axe nos E2E.
- CI automático está desativado (`.github/workflows-disabled/`); mutação é manual.

## Ambiente local completo

Na pasta pai (`../`) há `compose.yml` + `Makefile` para subir Postgres, API e
este front (Docker em :8080 ou nativo com `make web` em :5173). Veja `../AGENTS.md`.
