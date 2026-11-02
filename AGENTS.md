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
  pages/                MapPage, RecordsPage (listas/imports/pendências/histórico), RecordSearch + searchFilters (busca das listas, estado na URL, modo Nome|Significado), EntityEditor
  pages/                busca por significado: MeaningResults (Pontos), RecordItem (linha de lista), SimilarPoints (painel do mapa), SuggestionsPage (/sugestoes), ImportSimilar (aviso no lote)
  pages/editor/         payload, seletores por busca, campos comuns, contextualização (lote), prefill (URL da relação nova) e SimilarHint (dica do ponto novo)
  components/           Feedback, labels (rótulos PT-BR), period (anos astronômicos), identifiers (links), semantic + SemanticNote (nota do 503, pontuação "semelhança 0,87")
  dev/fixtures.ts       API fictícia em memória, só em dev com VITE_ENABLE_FIXTURES=true
  dev/fixture-batch.ts  lote de importação e recusas do REST da API fictícia
  dev/fixture-semantic.ts  busca por significado fictícia: Jaccard no lugar do modelo, sugestões, dispensa e `similar` do lote
contracts/              openapi.json (snapshot da API) + source.json (commit/SHA-256)
tests/                  unit/, integration/, e2e/ (dist, rede simulada), e2e-fixtures/ (fictício), e2e-real/ (API real descartável)
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
npm run test:coverage     # Vitest + cobertura v8, quebra abaixo de 80%
npm run test:e2e:fixtures # Playwright desktop+mobile com fixtures (npx playwright install chromium)
npm run test:e2e:real     # Playwright (só chromium) contra API REAL descartável; veja abaixo
npm run format:check      # Prettier (npm run format corrige)
npm run build             # contracts:check + lint + typecheck + vite build + check-dist
npm run contracts:import -- <openapi.json> <commit-40-hex>   # novo snapshot da API
npm run contracts:generate                                   # regenera src/api/generated
npm run test:mutation     # Stryker — só manual
npm run test:mutation:gate # piso de 80% por arquivo do núcleo, sobre o último relatório
```

Antes de concluir: `lint`, `typecheck`, `test:coverage`, `format:check` e, se
tocou telas, `test:e2e:fixtures`. O build exige `VITE_API_BASE_URL`.

`test:e2e:real` (`playwright.real.config.ts`, `tests/e2e-real/`) exige uma **API
descartável**: em `AUTH_MODE=local`, com um banco de teste que pode ficar sujo e
`ALLOWED_ORIGINS` incluindo `http://127.0.0.1:4173`. Defina `E2E_API_URL` com a
origem dela (ex.: `E2E_API_URL=http://127.0.0.1:3000 npm run test:e2e:real`). O
config faz `vite build` com `VITE_API_BASE_URL=$E2E_API_URL` em `dist-e2e-real/`
(não mexe no `dist`) e serve com `vite preview` em 127.0.0.1:4173. Sem
`E2E_API_URL` o teste é pulado com uma mensagem. Nunca aponte para dados reais:
o teste cria e desfaz um lote sintético. Na raiz do
workspace, `make e2e` sobe essa API descartável (Postgres com pgvector em
memória, a API da branch local com o modelo real em `../idea-sonar-api/.models`) e
roda este E2E; o spec `semantic.spec.ts` espera a indexação por polling.

## Portões de qualidade

- Escopo: todo `src/**`, menos `src/api/generated/**` (gerado do contrato),
  `src/dev/**` (fixtures que não entram no bundle), `src/main.tsx` (bootstrap)
  e `*.d.ts`. O mesmo escopo vale para cobertura e mutação — ver
  `qualityExclude` em `vitest.config.ts` e `mutate` em `stryker.config.mjs`.
- Cobertura: `test:coverage` quebra abaixo de 80% em linhas, ramos, funções e
  statements. Relatório em `coverage/` (texto, HTML e lcov), fora do Git.
- Mutação: `test:mutation` quebra abaixo de 80%. É manual e leva dezenas de
  minutos; `incremental: true` reaproveita mutantes cujo código e testes não
  mudaram, e `--force` refaz tudo. Relatório em `reports/mutation/`.
  `vitest.mutation.config.ts` roda testes unitários e de integração de tela,
  exceto os três que sobem subprocessos (`build-env`, `lint`, `contracts`).
- Portão por arquivo: o 80% global deixa um arquivo central fraco passar na
  média dos simples. `test:mutation:gate` (`scripts/mutation-gate.mjs`) lê
  `reports/mutation/mutation.json` e exige 80% em cada arquivo do núcleo
  (`src/api/**`, `src/graph/**`, `src/pages/editor/payload.ts`); sai com 1 se
  algum ficar abaixo. Roda depois do `test:mutation`, sem refazer a mutação.
- `// Stryker disable` só para mutante de fato equivalente, com o motivo no
  comentário. Para texto PT-BR, prefira asserções no texto a supressões.

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
- Contrato 1.3.0 (busca por significado; só acréscimos): `GET /search/semantic`
  (`q` 1–500, `kind`, `includePending`, `limit` 1–50), `GET /nodes/{id}/similar`,
  `GET /suggestions/parallels` (`limit`, `minScore`) e o `POST` de dispensar um
  par, `/suggestions/parallels/dismiss` (`{a, b, reason}`; idempotente por par, sem
  `Idempotency-Key`: `withoutIdempotencyKey` no transporte). Os quatro respondem 503
  `SEMANTIC_UNAVAILABLE` quando a busca está desligada: a tela mostra uma nota quieta
  (`SemanticFailure`), nunca "tentar novamente". Os itens `create` do lote trazem
  `similar: [{id, label, score}]` (ausente = busca desligada; lista vazia = nada
  parecido). Regra do produto: semelhança é pista, não identidade nem prova de
  influência; a pontuação é cosseno comprimido (textos sem relação dão 0,80–0,89), então
  aparece só como "semelhança 0,87" (duas casas, vírgula), nunca como percentual.
- Formatos-chave: `version` inteiro (PATCH envia `If-Match: <versão>`), POST de
  criação com `Idempotency-Key`; filtros `q, match, kind, contextId, includePending,
startYear, endYear, includeUnknownPeriod`; listas `{ items, nextCursor }`. O cursor
  só vale para os filtros que o emitiram: filtro mudou, a lista recomeça (os filtros
  entram na chave da consulta).
- Títulos por tipo: nodes/contexts `label`, sources `title`, relations `claim`,
  views `name` (`components/labels.ts`). Anos são astronômicos (0 = 1 a.C.).
- Fixtures (`src/dev/fixtures.ts`) devem seguir os mesmos formatos da API.

## Convenções

- Commits em PT-BR no estilo conventional (`feat:`, `fix:`, `build:`, `docs:`, `test:`).
- Complexidade > 10 quebra o lint: extraia componentes/helpers.
- Textos de interface em PT-BR; acessibilidade verificada por axe nos E2E.
- CI automático está desativado (`.github/workflows-disabled/`); mutação é manual.

## Design

- Fonte da verdade visual: `DESIGN.md` (tokens, tipografia, componentes, regras do painel escuro); contexto de produto em `PRODUCT.md`. Tokens em `:root` de `src/app/styles.css`; cores do grafo em `src/graph/styles/palette.ts`.
- Skill de design em `.claude/skills/impeccable` (Impeccable 4.8.0): use-a para mudanças de UI e mantenha `DESIGN.md` em dia.
- Detector de anti-padrões: `npx impeccable@4.8.0 detect src/` (e `detect http://localhost:5173/map` com o dev server rodando para as regras que precisam de página renderizada).
- Contraste AA é regra: o laranja `#e76732` só em não-texto; botão primário usa `#bb431d`. Fontes são self-hosted (`@fontsource*`), nunca de CDN.

## Ambiente local completo

Na pasta pai (`../`) há `compose.yml` + `Makefile` para subir Postgres, API e
este front (Docker em :8080 ou nativo com `make web` em :5173). Veja `../AGENTS.md`.
