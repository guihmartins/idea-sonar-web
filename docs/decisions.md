# Decisões

## 2026-10-24 — Marco 1: fundação

- Base inspecionada: `main` em `3bf5f64606c05fbd9f1769d49e6231b6de901e95`. Continha somente `PLAN.md` v2.0, lido integralmente. Nenhum `AGENTS.md` ou outra instrução local encontrado. Trabalho na branch `feat/marco-1-fundacao`.
- Escopo deste marco: configuração independente, dependências, parser público de ambiente, shell responsivo PT-BR, rotas, testes e CI. Autenticação, cliente gerado, dados, grafo interativo, formulários e infraestrutura são próximos marcos. As telas indicam essa situação sem dados pessoais ou exemplos históricos apresentados como reais.
- Node 24.19.0 LTS e npm 11.9.0 fixados, iguais ao executor; `engine-strict`, `.nvmrc`, versões exatas e `package-lock.json`. Metadados `engines`/`peerDependencies` do npm consultados antes da seleção: React 19.3.1, TypeScript 7.0.2, Vite 8.3.5/plugin React 6.1.2, Router 7.18.4, Query 5.104.5, Cytoscape 3.34.4, Vitest 5.0.5 e Playwright 1.64.1. Cytoscape fornece tipos próprios. Lockfile registra todas as versões transitivas.
- Consultadas as referências atuais de [ambiente Vite](https://vite.dev/guide/env-and-mode), [Router declarativo](https://reactrouter.com/start/declarative/installation) e [Cytoscape](https://js.cytoscape.org/). O plugin React 6 aceita Vite 8; peers de compilação opcional não são necessários. Query aceita React 19. Não foi adicionado gerenciador global de estado.
- `src/config/schema.ts` é a única implementação de validação. Vite a executa antes de servir/buildar; `env.ts` a reutiliza no navegador. Build é identificado por `command`, independentemente de `mode`/`NODE_ENV`, e fixa DEV/PROD coerentes no bundle. `preview` serve o artefato existente sem exigir novamente env.
- API aceita somente origem; rejeita caminhos inclusive antes da normalização de URL, query/fragmento vazios, credenciais e esquemas não HTTP(S). HTTPS em todo build; HTTP local apenas em desenvolvimento. OIDC exige issuer HTTP(S) sob as mesmas restrições de transporte, client ID e audience não vazios. Nenhum fallback local/de mesma origem. Não se supõe que valores sintaticamente válidos pertençam a provedor já configurado.
- Cache Query permanece em memória com retries automáticos desativados. A política de renovação única/429 será implementada no transporte. Nenhuma chamada de dados é feita antes da autenticação.
- Consulta somente de leitura ao caminho oficial `idea-sonar-api/contracts/openapi.json?ref=main` retornou 404. Isso não prova ausência global: o contrato está indisponível por esse caminho/acesso. Nenhuma alteração ou checkout do backend. Não gerar DTO, spec ou cliente oficial fictício. Snapshot, commit, checksum e integração real continuam pendentes. Se necessário no marco de UI, fixtures serão sintéticas e isoladas em dev/test, sem fallback em produção.
- A CI usa valores públicos fictícios somente para construir e verificar a estrutura, sem conectar a provedores reais. Não faz deploy. E2E testa o artefato estático usando Vite preview como ferramenta temporária; não equivale a smoke Docker ou API real.

## Critério dos próximos marcos

1. Importar snapshot verificável e registrar origem/commit/checksum; gerar cliente e checar regeneração em CI. Se indisponível, adapter temporário e fixtures explicitamente fictícias somente para dev/test.
2. SDK oficial do provedor OIDC alinhado com API; tokens em memória, PKCE, `/me`, renovação única, 403, logout e limpeza de cache/navegação.
3. Ledger do grafo e testes de compartilhamento/paginação/respostas tardias; Cytoscape com modo lista e painel de evidências.
4. Formulários, conflitos, importações, pendências, histórico e views persistidas pela API.
5. Docker não root independente, deep links sem mascarar assets ausentes, runbook CloudFront e smoke real quando disponível.

## Validação do marco 1

- `npm ci`, `npm run typecheck`, `npm test` (40 testes) e build HTTPS com valores públicos sintéticos aprovados.
- Regressões executam o CLI real do Vite: ausência de API, caminho `/api/v1`, HTTP com `--mode development` e HTTP com `NODE_ENV=development` impedem o build.
- Playwright aprovado em Chromium desktop e viewport móvel (2 testes sobre `dist`): PT-BR, skip link/foco por teclado, navegação, recarga/deep link, ausência de overflow horizontal e de requests de dados sem autenticação.
- Não verificado neste marco: fluxo OAuth real, contrato/API real, comportamento do grafo, Docker e CloudFront. Dependem dos marcos seguintes.
