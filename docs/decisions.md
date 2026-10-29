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

## 2026-10-24 — Marcos 2 a 5: implementação do frontend

- Nova leitura da árvore da API: `main` contém somente PLAN.md; OpenAPI ainda não publicado. Segue pendente a importação **oficial**, reconciliação de DTOs e smoke real. Nenhum backend foi alterado ou clonado.
- Modelo de apresentação temporário com validação Zod e adapter HTTP separado. Não é um contrato oficial. Fixtures de dados/sessão são explicitamente fictícias, só importadas com DEV + flag; build rejeita flag ativa e checa ausência de conteúdo sintético no dist. Produção não possui fallback.
- Infra de contrato implementada: import de arquivo local revisado com commit completo, info.version, SHA-256; geração determinística de tipos/cliente e checagem de drift em CI/build. REQUIRE_API_CONTRACT bloqueia release integrada enquanto pending. Teste do gerador usa spec sintética somente em pasta temporária.
- Ajuste de compatibilidade: openapi-typescript 7.13.0 declara peer TypeScript ^5; fixado TypeScript **5.9.3** em vez de 7.0.2. Não usamos force/legacy-peer-deps. Auth0 SPA SDK 2.29.0, Zod 4.6.7 e openapi-fetch 0.17.0 exatos; formatter e axe também fixados no lockfile.
- Escolhido adapter Auth0 oficial como proposta inicial implementada, com PKCE delegado ao SDK, token em memória, /me antes de telas privadas e limpeza no logout. Não alegamos conta configurada; issuer/audience/scopes/CORS/callbacks e smoke OAuth dependem de ambientes externos.
- Transporte exige chave por ação de criação e versão para edição. Não repete mutações em timeout/429; retry de 401 conserva chave/request ID e renova no máximo uma vez. GET 429 pode esperar até 2s uma única vez. Erros estruturados e request ID aparecem sem logs de dados/tokens.
- Ledger local por raízes e expansões alcançáveis. Recolher preserva nós sustentados por outras expansões e remove ciclos órfãos. Generation + AbortSignal impedem respostas antigas após raiz/filtros/recolhimento. Limite de 500, paginação sem arestas órfãs, direções simétricas e relações paralelas preservadas.
- Cytoscape carregado sob demanda; instância destruída no cleanup, resize observado e posições existentes preservadas em expansões. Lista equivalente por teclado, painel de evidências/texto seguro e legenda sem depender só de cor. Views guardam raiz/filtros/expansões/posições/viewport e restauram buscando dados atuais, avisando ausências.
- Formulários usam catálogo, IDs selecionados em busca e validação local sem alterar classificação automaticamente. Fonte obrigatória para documented/attributed; inferência exige autoria/justificativa. Períodos convertem a.C. explicitamente (1 a.C. = 0), preservando desconhecido e aproximado. 409/412 carrega atual e mantém rascunho para comparação; nada sobrescrito automaticamente.
- Importações, confirmação de undo, pendências e histórico consultam API/adapter; frontend não executa transação ou merge local. Export é baixado sob ação explícita. Fixtures simulam operações somente para dev/test, em memória.
- Docker validado: Node 24.19.0 da imagem trouxe npm 11.17.0; instalado npm 11.9.0 explicitamente antes de npm ci, também fixado em CI. Nginx não root com configuração legível pelo usuário 101, read-only/tmpfs/capabilities removidas. Smoke verifica deep links conhecidos e 404 de assets sem backend. CloudFront entregue como runbook e rewrite, sem provisionar AWS.

## Validação final dos marcos implementados

- Instalação limpa com `npm ci`, formatação, TypeScript estrito, 58 testes unitários/de integração e build HTTPS aprovados. Inclui SDK em memória, renovação limitada, idempotência, If-Match, comparação de conflito, ledger compartilhado, períodos históricos e geração/checksum em diretório temporário.
- Playwright: 2 cenários de dist de produção e 12 cenários dev/test em desktop/celular, incluindo fluxos completos, fontes/contextos/relações, evidências obrigatórias, exportação e preservação de posições arrastadas entre expansão/modo lista. Axe não encontrou violações WCAG A/AA nas telas verificadas. Inspeção visual desktop/celular sem erro de página.
- O teste de posições identificou e corrigiu a sobrescrita de snapshots em re-render: refs de posição/viewport agora são atualizadas por ações explícitas/snapshots; expansões preservam posições atuais em vez de reaplicar snapshots antigos. Restauração também pode ser cancelada ao trocar raiz/filtros.
- Build elimina fixtures e verifica isso automaticamente. Auth0 e Cytoscape são chunks carregados sob demanda; nenhum chunk acima do limite padrão de aviso do Vite. A pipeline normal não acessa o repositório backend.
- Imagem Docker construída e smoke aprovado com filesystem read-only, tmpfs, sem capabilities, usuário não root e sem backend. Deep links conhecidos 200; assets/rotas inexistentes 404. Rewrite CloudFront verificado localmente para preservar assets e caminhos desconhecidos.
- Nova consulta final da API confirmou a mesma árvore de main contendo somente PLAN.md. Integração real continua pendente de snapshot oficial, alinhamento do adapter e provedor/CORS/callbacks/scopes. Não houve provisionamento AWS ou alteração na API.

## 2026-10-25 — Acesso temporário sem token

- Pedido do usuário: “Deixa sem token por enquanto”. Esta decisão substitui temporariamente a exigência inicial de login do PLAN, sem remover a implementação OIDC.
- VITE_AUTH_MODE aceita none/oidc e assume none quando ausente. Só VITE_API_BASE_URL é obrigatória em none. OIDC continua validado e exigido quando explicitamente selecionado; valores de modo desconhecidos falham.
- Sem sessão: telas abrem direto, sem /me, SDK, login/logout ou usuário fictício; transporte omite Authorization e cookies e não renova 401. Erro 401 informa a exigência da API, sem oferecer login. API externa e sua autorização não são alteradas.
- Mutações conservam idempotência/If-Match e erros de rede/conflito. Fixtures continuam exclusivamente dev/test, sem fallback de produção. Docker/Compose passam o modo no build e não exigem configuração OIDC em none.
- Reativação exige novo build com VITE_AUTH_MODE=oidc e configuração do provedor. Não há troca de modo em runtime.

- Validação desta alteração: 62 testes unitários/de integração, 4 E2E de produção sem token e 12 E2E dev/test aprovados. Build executado somente com VITE_API_BASE_URL; imagem construída sem args OIDC e smoke estático aprovado. E2E verifica ausência de Authorization, /me, tráfego OIDC e login/renovação em 401, além de descartar callbacks antigos no modo none.

## 2026-10-25 — Testes de mutação com Stryker

- Stryker core/runner Vitest/checker TypeScript 10.1.1 fixados após conferir engines e peers (Node >=22, Vitest >=2, TypeScript >=3.6). Compatíveis com Node 24.19.0, Vitest 5.0.5 e TypeScript 5.9.3 do projeto.
- Escopo explícito em seis módulos de configuração, transporte, SDK, ledger, elementos e períodos; não é uma nota global da UI. Configuração Vitest de mutação isola testes unitários para não disparar builds/subprocessos/Playwright por mutante. Suíte normal preservada.
- Checker TypeScript distingue mutantes que não compilam; cobertura perTest e operadores padrão, incluindo estáticos, sem supressões artificiais. Concorrência limitada a um checker e um runner para caber no executor.
- Primeira rodada real: 521 mutantes, nota 61,45%, 50 testes; identificou falta de cobertura em períodos e representação do grafo e verificações insuficientes de HTTP. Reforçados testes de comportamento sem mudar os módulos de produção. Metodologia e resultado em docs/mutation-testing.md.
- Gate de 80% e workflow manual dedicado com artifact HTML/JSON; não adicionamos vários minutos a cada push do pipeline principal. Relatórios/sandboxes não entram no Git nem na imagem Docker. A escolha atual de acesso sem token não foi alterada.

- Rodada final: 91,34% (327/358 válidos), 521 gerados: 320 mortos, 7 timeouts, 30 sobreviventes, 1 sem cobertura e 163 erros de compilação. 125 testes unitários usados pelo runner. Ledger e períodos chegaram a 100%; elementos ficaram em 75,86%, com lacunas visuais documentadas. Sem exclusão de operadores ou mutantes. Os módulos de produção permaneceram intactos.

## 2026-10-25 — Workflows do frontend desativados

- Pedido explícito do usuário: desativar os workflows no frontend. Arquivados ci.yml e mutation.yml em `.github/workflows-disabled/`, fora do diretório reconhecido pelo GitHub Actions. Nenhuma definição executável permanece em `.github/workflows/`.
- Definições preservadas para possível reativação explícita; comandos npm de testes, Stryker, build e Docker mantidos. Nenhuma nova execução de workflow foi solicitada nesta alteração.
- A imagem enviada pelo usuário mostra uma falha de idea-sonar-api; o escopo solicitado foi idea-sonar-web. Nenhuma configuração/arquivo do backend foi alterado.
- Validação limitada à ausência de YAMLs no diretório ativo, formatação e diff, pois o código do produto não mudou.

## 2026-10-25 — ESLint com complexidade 10 e mutação somente manual

- Correção do usuário: manter desativado o CI automático, mas deixar Mutation tests para execução manual. Restaurada somente a definição mutation.yml em .github/workflows, com workflow_dispatch, sem push/pull_request. ci.yml permanece arquivado. Não executamos/disparamos Stryker nesta alteração.
- ESLint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.72.0 e globals 17.13.0 fixados após validar engines/peers com Node 24.19.0 e TypeScript 5.9.3. Configuração flat, recomendações JS/TS e complexity como error, max 10, variante classic; sem relaxamentos por arquivo/componente/teste. Apenas artefatos e gerados ignorados.
- npm run lint e lint:fix falham com warnings; npm run build inclui lint. Teste com ESLint real comprova que 10 passa e 11 falha com severity 2.
- Refatoradas 17 funções acima do limite, extraindo transporte/políticas HTTP, validação OIDC, colapso/mesclagem do ledger, restauração de views, payloads do editor, controller/componentes de tela, fixtures e feedback de erros. Entrada global de CloudFront declarada como script/exported, sem desabilitar complexidade.
- Regressões adicionais preservam páginas já restauradas quando a próxima falha, impedem loop por cursor repetido e rejeitam respostas após cancelamento. Os testes existentes continuam verificando corpo/headers, idempotência, timeouts, conflitos e visibilidade compartilhada.
- O relatório de mutação de 91,34% permanece histórico, anterior a esta refatoração, e não representa uma nova execução. O usuário fará a próxima rodada manualmente. Modo sem token e escopo exclusivo do frontend preservados.

- Validação final: lint sem erros/warnings, TypeScript estrito, 141 testes unitários/de integração, 16 E2E desktop/celular (incluindo acessibilidade e fluxos completos) e build aprovados. Auditoria via ESLint encontrou 432 funções em src, máximo 10 e zero acima do limite. Nenhuma execução do Stryker nesta alteração.

## 2026-10-29 — HTTP permitido na URL da API, engines e correções de revisão

- Solicitado pelo usuário: rodar localmente e em Docker sem HTTPS; TLS será configurado depois (certbot na EC2). `VITE_API_BASE_URL` passa a aceitar `http:` e `https:` em dev e em build, mantendo as demais restrições (somente origem, sem credenciais/query/fragmento). Issuer OIDC continua exigindo HTTPS em build.
- `engines` relaxado para Node `>=24.19.0 <25` e npm `>=11.9.0` (igual à API); 24.19.0/11.9.0 seguem como referência em `.nvmrc`, Docker e CI.
- Auth0: `domain` sem barra final; o SDK monta `${domain}/authorize` e o issuer esperado `${domain}/`.
- nginx: headers de segurança repetidos nos `location` com `add_header` próprio (a herança do bloco `server` era descartada).

## 2026-10-29 — Contrato da API integrado

- Snapshot `contracts/openapi.json` importado da API (`contracts/source.json`), com tipos e cliente gerados em `src/api/generated/`.
- `src/api/domain.ts` passou a validar os formatos reais (versão inteira, catálogo `nodeKinds`/`relationTypes`, campos de fonte/contexto/relação/evidência/view, lotes, pendências e histórico de auditoria). `ContractCheck` compara o modelo com os tipos gerados na compilação.
- Adapter usa os filtros da API (`contextId`, `includePending`, `startYear`, `endYear`, `includeUnknownPeriod`), `If-Match` com a versão inteira e os corpos `{expectedVersion, reason}` (undo) e `{expectedVersion, reason, selection}` (resolve). Pendências são resolvidas escolhendo um registro existente buscado pelo nome proposto no lote.
- Editor segue as regras da API (justificativa obrigatória, evidência de suporte com fonte, atribuição/autoria conforme a classificação, contestação com evidências a favor e contra; tipo e escopo de ponto imutáveis após criar).
- Mensagem de erro da API é exibida quando o status não tem mensagem própria.
- Validação: lint, typecheck, Vitest, E2E com fixtures (desktop/mobile, axe) e smoke contra a API real em Docker e nativo (modo sem token).
