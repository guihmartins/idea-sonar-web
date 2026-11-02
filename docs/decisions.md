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

## 2026-10-29 — Novo sistema visual (Impeccable)

- Identidade visual redesenhada com a skill Impeccable 4.8.0 (modo Operate): papel claro `#f7f7f2`, tinta `#252920`, destaque laranja, DM Sans para interface e IBM Plex Mono para metadado. `PRODUCT.md` e `DESIGN.md` na raiz passam a ser a referência; tema claro apenas.
- Acessibilidade: branco sobre `#e76732` dá ~3,3:1, então o botão primário e os links usam `#bb431d` (~5,3:1) e o laranja fica restrito a marcadores, foco e destaques do grafo. Bordas laterais coloridas e kicker acima de títulos de página foram removidos.
- Fontes self-hosted via `@fontsource-variable/dm-sans` 5.3.0 e `@fontsource/ibm-plex-mono` 5.3.0 (pesos 400 e 500), sem CDN: o app lida com dados privados, roda offline em Docker e usa `no-referrer`. Versões exatas, publicadas há mais de duas semanas, sem `engines`/peers.
- O mapa virou uma janela escura `#20271f` (barra de título com raiz e contagem, controles segmentados com `aria-pressed`, grade pontilhada, painel de detalhes e legenda em rodapé). Cores do grafo centralizadas em `src/graph/styles/palette.ts`, usadas pelo adapter, pela legenda e pelos testes.
- Apenas apresentação: contrato, `src/api`, payloads, visibilidade e restauração não mudaram. Nomes acessíveis, papéis e a classe `.graph-list` foram preservados.

## 2026-10-31 — Cobertura e mutação em todo o src

- Pedido do usuário: ESLint com complexidade máx. 10 (já existia, mantido e
  verificado), cobertura ≥80% e nota de mutação ≥80% em todo o `src`.
- Escopo de qualidade único para as duas métricas, para não haver código
  "medido por uma e não pela outra": `src/**` menos `src/api/generated/**`
  (gerado do contrato, nunca editado à mão), `src/dev/**` (fixtures que não
  entram em build de produção), `src/main.tsx` (bootstrap sem lógica) e
  `*.d.ts`. Declarado em `qualityExclude` (`vitest.config.ts`) e espelhado em
  `mutate` (`stryker.config.mjs`).
- Cobertura com `@vitest/coverage-v8` 5.0.5, versão casada com o Vitest 5.0.5
  do projeto (provider v8 é o mesmo motor do runtime, sem instrumentar o
  código). Thresholds de 80% em linhas, ramos, funções e statements, todos no
  mesmo patamar: um único número evita negociar métrica por métrica. Script
  `test:coverage`; `coverage/` ignorado no Git, no ESLint e no Prettier.
- Mutação deixa de cobrir seis arquivos do marco 1 e passa a cobrir o mesmo
  `src`. Como isso inclui telas, `vitest.mutation.config.ts` passou a rodar
  também os testes de integração `.tsx`; continuam fora apenas
  `build-env`, `lint` e `contracts`, que sobem subprocessos (Vite, ESLint,
  gerador de contrato) e custariam minutos por mutante sem exercitar `src`.
- Telas com Testing Library e `user-event` são ordens de grandeza mais lentas
  que as funções puras medidas antes: `timeoutMS` foi de 2s para 20s e
  `timeoutFactor` de 1,5 para 2, para não contar mutante vivo como timeout.
  Concorrência de 2 para 4 (executor com 10 núcleos). `incremental: true`
  reaproveita mutantes cujo código e testes não mudaram, o que torna o loop
  "matar sobreviventes" viável; o estado fica em `reports/`, fora do Git.
- Nenhum operador de mutação foi desabilitado e nenhum limiar foi relaxado.
  `// Stryker disable` fica reservado a mutante de fato equivalente, com o
  motivo escrito; para rótulos PT-BR a regra é asserção no texto, não
  supressão. O gate de 80% (`thresholds.break`) continua valendo.
- Verificado que o Stryker não gera mutante para atributo nem para texto JSX
  (`className`, `role`, `aria-label`, conteúdo de elemento): os mutantes de
  tela são condicionais, operadores lógicos/relacionais, literais em
  expressões, arrays e objetos. Isso define onde os testes de tela precisam
  asserir para matar mutante, e foi o que guiou a escrita.
- CI automático segue desativado e a mutação segue manual: o gate de cobertura
  roda em `test:coverage`, o de mutação só quando alguém executa Stryker.

## 2026-11-01 — Contrato 1.1.0, conceito contextual pelo lote e seletores por busca

- Snapshot da API atualizado para o commit `e27da26` (1.1.0): update parcial no lote, erros com `details[].path`, `viewUrl` para `/imports/{id}`, `BATCH_UNDONE` e limites de ano. Os 409 que não são de versão (`BATCH_UNDONE`, `DEPENDENCIES`…) mostram a mensagem da API e não abrem a comparação de versão do editor.
- **Conceito contextual (bug F4).** Pelo REST um conceito contextual ativo exige uma relação `contextualizes` ativa para um conceito amplo ativo, e uma relação ativa exige pontos ativos: nenhum dos dois pode ser ativado primeiro. Só `POST /imports` grava os dois na mesma transação (o escopo contextual é conferido no fim do lote). O editor usa o lote para criar e para ativar conceito contextual; pendente criado como rascunho segue o REST. A chave de idempotência do lote é a `actionKey` do formulário (nova a cada edição, repetida em retry), não uma chave a cada clique, para que uma nova tentativa após timeout reaproveite o lote já gravado.
- Com `pending > 0` o editor não anuncia sucesso: lista cada item e o motivo, mantém o rascunho e liga para a importação.
- **Fontes e contextos (bug F16).** O editor e o mapa não percorrem mais todas as páginas. O editor escolhe contexto de ponto, contexto de relação e fonte de evidência por busca (`api.candidates`, com pendentes) e mostra pelo nome, a partir do ID, o que já está escolhido. No mapa, o filtro de contexto é o mesmo seletor por busca (e não uma lista limitada, que esconderia os contextos além da primeira página) e legenda, títulos de contexto e painel resolvem só os contextos dos pontos visíveis, por ID.
- **E2E real.** `test:e2e:real` roda contra uma API descartável (`AUTH_MODE=local`) apontada por `E2E_API_URL`, com build próprio em `dist-e2e-real`. Os corpos de lote do editor e o fluxo de desfazer foram conferidos contra a API 1.1.0 real, não só contra as fixtures.

## 2026-11-01 — Modelo de dados v2 (contrato 1.2.0)

- Snapshot da API no commit `5215021` (1.2.0). `kind` ganha `figure`; o ponto ganha período e identificadores; o catálogo ganha `identifierSchemes` e o predicado `authored`; o lote ganha `discarded`, `candidates` e o desfecho `discarded`; a pendência pode ser descartada com `{discard: true}`.
- **Figura no mapa:** triângulo (`triangle`, glifo △). É a forma mais simples ainda livre e de cantos retos, distinta das quatro anteriores a 14px; estrela, pentágono, octógono, `vee` e `tag` foram descartados (ver "Shapes" em `DESIGN.md`). Cores e contraste não mudaram.
- **Identificadores:** o editor aceita o endereço do registro e mostra a forma normalizada que a API devolve (ordenada por esquema e valor, por isso a comparação de aliases, identificadores e contextos na ativação é por conjunto, não por ordem). O erro da API aparece na linha do valor; o duplicado, acima das linhas. Linhas em branco não são enviadas.
- **Anos:** período de ponto e de contexto são conferidos no cliente contra -100000..3000, com a mensagem em a.C./d.C.
- **Portão de acesso:** `AuthenticatedGate` não refaz mais `me()` nem desmonta o conteúdo a cada navegação (`navigate` mudava a cada rota e estava nas dependências do efeito); continua refazendo quando a sessão, a API, a tentativa ou a rota de callback mudam.
- **Atlas, testes de arrasto:** a causa da intermitência era uma corrida do próprio teste, que lia o grafo logo depois de "Expandir conexões" sem esperar a expansão (sob carga o nó do conceito ainda não existia). Os testes agora esperam por condição: 3 pontos e 2 relações no rótulo do mapa e desenho parado (posições, pan e zoom iguais por 6 quadros, sem animação). Reproduzido antes do ajuste (12 repetições com 6 workers): "curva reversa" falhou com "Can not create edge … nonexistent source", isto é, o conceito ainda não estava no grafo. A busca de contextos por ponto visível da rodada anterior só altera o título dos grupos e não causa a falha.
- Os fluxos do editor, o descarte, o desfazer e o `E2E` real foram conferidos contra a API 1.2.0 extraída do commit, com Postgres descartável próprio.

## 2026-11-01 — Mutação medida no código atual e portão por arquivo do núcleo

- A primeira medição completa depois do Atlas deu 72,69% e reprovava o `break` de 80%. Os arquivos novos do mapa (estilos, canvas, layout, `MapPage`) nunca tinham sido mutados. Reforço só com testes, sem tocar em código de produção e sem `// Stryker disable`; os números da rodada estão em `docs/mutation-testing.md`.
- O `break` global não protege o que mais importa: a média de arquivos simples cobre um arquivo central fraco. Entra `npm run test:mutation:gate` (`scripts/mutation-gate.mjs`), que exige 80% em cada arquivo do núcleo: `src/api/**`, `src/graph/**` e `src/pages/editor/payload.ts`. Ele só lê o relatório; não refaz a mutação.
- Testes de estilo afirmam o mapeamento dado → desenho (glifo por tipo, traço por evidência, espessura por intensidade, seta só em relação direcional, leque de paralelas) com um Cytoscape real sem tela, e afirmam os valores da paleta exatos de propósito: são o contrato visual do `DESIGN.md`. O `GraphCanvas` é testado contra um dublê do Cytoscape que recusa id repetido, como o real.
- Armadilha do Stryker incremental: mutante estático que sobrevive não é reexecutado quando surgem testes novos. Antes de remedir um arquivo, remover do estado os sobreviventes `static` dele (ou `--force`); está em `docs/mutation-testing.md`.
- Observação sem correção: o Cytoscape avisa que `width: 'label'` e `height: 'label'` estão obsoletos (aparece no log do Vite nos E2E); não afeta o desenho hoje.

## 2026-11-02 — Busca por significado (contrato 1.3.0)

- Snapshot da API no commit `fb84a52` (1.3.0, só acréscimos): `GET /search/semantic`, `GET /nodes/{id}/similar`, `GET /suggestions/parallels`, `POST /suggestions/parallels/dismiss` e o campo opcional `similar` nos itens `create` do lote. Os embeddings são locais na API (`Xenova/multilingual-e5-small`, pgvector). O web só lê e, numa única escrita, dispensa um par.
- **Semelhança é pista, nunca evidência.** Não é identidade nem prova influência. Toda tela de significado diz isso numa frase curta e calma (sem banner nem cor de alarme) e nada é gravado por causa dela: "Registrar paralelo" só abre o editor, e o usuário escreve afirmação, autoria da inferência e justificativa.
- **Pontuação.** O cosseno vem comprimido (textos sem relação dão 0,80 a 0,89), então não vira percentual, barra, probabilidade nem "confiança". Aparece só como "semelhança 0,87" (duas casas, vírgula, `Intl.NumberFormat('pt-BR')`), em mono pequeno; quem dá a leitura é a ordem. `formatScore` e `Score` são o único caminho.
- **503 `SEMANTIC_UNAVAILABLE`.** Busca desligada ou modelo que não carrega não é erro da tela: uma nota quieta ("Busca por significado indisponível: o modelo da API não está ativo."), sem alerta nem "tentar novamente" (o transporte já devolve o 503 na hora, porque só repete 429). `isSemanticUnavailable` (status 503 e código) e `SemanticFailure` são compartilhados; qualquer outro erro segue o `Failure` de sempre, com nova tentativa. Na dica do cadastro o 503 não aparece de forma alguma.
- **Pontos, modo Nome | Significado.** O modo vive na URL (`mode=significado`) como os outros filtros, no mesmo parser (`SearchFilters = ListFilters & { mode }`; o adapter `list` não o envia). Rádios, não botões `aria-pressed`: as setas já movem entre eles. A troca aplica na hora e mantém `q` (aplicado ou só digitado), `kind` e `includePending`; `match` e o período não existem em Significado e saem da URL ("voltar a Nome" começa sem eles). "Limpar" em Significado mantém o modo. Sem texto não há requisição, só a dica. O resultado é um top-k: 20 e "Mostrar mais" pede 50 (a consulta anterior continua na tela enquanto os 50 chegam); uma busca nova remonta o componente e volta a 20. `RecordItem` saiu de `RecordsPage` para ser reaproveitado, com a pontuação na linha de metadado.
- **Painel do mapa.** "Pontos parecidos" depois das relações, `GET /nodes/{id}/similar?limit=5` ao abrir o painel. Ativar uma linha usa `pickNode` do controlador do mapa, o mesmo gesto do resultado da busca do mapa (o ponto vira a raiz); não há segundo jeito de adicionar nós. A lista de relações ganhou nome acessível ("Relações do ponto") para o painel ter duas listas distintas.
- **Sugestões.** `/sugestoes`, depois de Pendências na navegação e no trilho do mapa. 20 pares e "Mostrar mais" até 50, sem o limiar (vale o do servidor). "Dispensar" abre o motivo (obrigatório, o mesmo desenho do motivo de desfazer; o foco vai ao campo), envia `dismissParallel`, relê as sugestões e anuncia o resultado numa região `status`. A API ordena o par e é idempotente por par; `POST` sem `Idempotency-Key` é a única exceção à regra do transporte (`withoutIdempotencyKey`, só quando pedido; sem isso o erro "Ação sem Idempotency-Key." continua).
- **Pré-preenchimento do editor de relação.** `/edit/relations?type=&sourceId=&targetId=&evidenceStatus=` só vale para relação nova: tipo conhecido (do catálogo, que o editor espera só quando há parâmetro), UUIDs e classificação conhecida; o que for inválido é ignorado sem erro, e destino igual à origem também. Nada é salvo; o `key` do editor inclui o pré-preenchimento, então outro link reabre o formulário. Depois de salvar, `invalidateQueries()` já relê as sugestões e o par some.
- **Avisos de parecidos.** No detalhe do lote, "Parecido com:" com links e a linha "Aviso, não desfecho: confira se não é o mesmo ponto." só quando `similar` não é vazio. No cadastro de ponto novo, com nome e descrição, o bloco "Parecido com pontos já cadastrados" ("Aviso, não bloqueio: confira se não é o mesmo ponto antes de salvar.") vem da busca `mode=duplicates` (API `e521740`): 600 ms depois da última tecla, `q` é o texto que o ponto teria no formato da API (`nome · tipo em português · outros nomes sem o idioma · descrição`, vindos do editor, cortado em 500), `includePending` e 3 resultados. O servidor só devolve o que passa do limiar de duplicata (0,94, o do `similar` do lote), então o bloco só aparece quando algo se parece de fato; antes (busca `meaning`, sem piso) ele mostrava os 3 melhores mesmo sem relação, porque as pontuações comprimidas não distinguiam. Os links abrem em outra aba (`target="_blank"`, `rel="noopener noreferrer"`, nome acessível "… (abre em nova aba)"), então o rascunho do cadastro não se perde. É aviso: o salvar não muda; 503 ou qualquer outra falha esconde o bloco, sem erro no editor. O contêiner é uma região `aria-live="polite"` que sempre existe no ponto novo.
- **Fixtures.** `src/dev/fixture-semantic.ts` implementa as quatro rotas e o `similar` do lote com o índice de Jaccard sobre as palavras (3 letras ou mais, sem acento nem caixa) do texto do ponto, escrito como a API o escreve (`nome · tipo em português · outros nomes · descrição`), limiar de 0,78 (o mesmo do `similar` do lote e do `mode=duplicates`, que compara igual) (acima do que os textos de demonstração dão uns aos outros). A base ganhou dois pontos de demonstração com textos quase iguais e sem relação (Individuação e Coniunctio): são o par sugerido e o aviso do item `individuacao` do lote de demonstração. Por isso a base passou de 4 a 6 pontos e os testes que contavam páginas de 2 em 2 foram ajustados. O cache de respostas de POST das fixtures passou a valer só com `Idempotency-Key` (a dispensa não leva chave e repetia a primeira resposta do caminho).
- **Pontos em aberto.** `/search/semantic?mode=meaning` não tem piso: quem precisar de um corte para a busca de sempre ainda não tem (`minScore`), e as pontuações comprimidas não ajudam a distinguir. A dica do cadastro deixou de depender disso com o `mode=duplicates`.
- **Validação.** `lint` (0 avisos), `typecheck` e `format:check` limpos; 965 testes unitários e de integração (cobertura 99,03% statements, 96,82% ramos, 99,08% funções e 99,64% linhas); `build` com `VITE_API_BASE_URL=http://localhost:3000` sem aviso de pacote grande (a página Sugestões sai num pacote próprio de 3,7 kB; o principal fica em 497,4 kB, contra 488,8 kB antes da busca por significado); 66 cenários de E2E com fixtures (desktop e celular, axe) e 5 de E2E real via `make e2e`, com o modelo `multilingual-e5-small` e a indexação esperada por polling; `impeccable detect src/` com 0 anti-padrões (16 notas consultivas, todas de antes, no CSS do Atlas); mutação 91,85% com o portão por arquivo do núcleo aprovado.
