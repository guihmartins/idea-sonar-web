# Testes de mutação

StrykerJS 10.1.1 com runner Vitest 10.1.1 e checker TypeScript 10.1.1, Node 24.19.0, TypeScript 5.9.3 e Vitest 5.0.5. Dependências exatas e lockfile versionados.

> **Medição pendente.** Nenhuma nota abaixo vale para a `main` atual: a última rodada completa é anterior ao merge do Atlas e à ampliação do escopo. Uma nova medição da `main` está planejada para uma fase posterior; até lá, os números da seção histórica servem só como referência de método.

## Escopo atual

Todo o código de `src`, o mesmo escopo da cobertura (`qualityExclude` em `vitest.config.ts`, espelhado em `mutate` de `stryker.config.mjs`). Ficam de fora:

- `src/api/generated/**`: gerado do contrato OpenAPI, nunca editado à mão.
- `src/dev/**`: fixtures da API fictícia (inclui o processador de lote), que não entram no bundle de produção.
- `src/main.tsx`: bootstrap sem lógica.
- `*.d.ts`.

Telas React, adapter HTTP, schemas, grafo, layout e estilos do grafo entram. Os testes de integração de tela rodam por mutante, então o custo é bem maior que o do marco 1 (que cobria seis módulos puros): a execução completa leva dezenas de minutos.

A nota mede os testes unitários e de integração do projeto. Não mede o E2E (Playwright), a integração com API ou OIDC reais, nem prova que o código esteja correto.

## Configuração

Arquivos: `stryker.config.mjs` e `vitest.mutation.config.ts`.

- **Runner:** Vitest, com `vitest.mutation.config.ts` e `related: true` (só os testes ligados ao arquivo mutado). A configuração herda a base de `vitest.config.ts` e roda `tests/unit/**` e `tests/integration/**`, exceto `build-env`, `lint` e `contracts`, que sobem subprocessos (Vite, ESLint, gerador de contrato) e custariam minutos por mutante sem exercitar `src`.
- **Checker:** TypeScript (`tsconfig.json`). Mutante que não compila é separado e não conta como detectado pelos testes.
- **Cobertura:** `coverageAnalysis: perTest`, operadores padrão e mutantes estáticos habilitados. Nenhum operador ou mutante foi desabilitado para elevar a nota.
- **Tempo:** `timeoutMS` 20 s e `timeoutFactor` 2; telas com Testing Library são muito mais lentas que funções puras, e prazo curto contaria mutante vivo como timeout. `concurrency` 4.
- **Incremental:** `incremental: true` reaproveita mutantes cujo código e testes não mudaram; o estado fica em `reports/`, fora do Git. `--force` refaz tudo.
- **Gate:** `thresholds` high 80, low 60, `break` 80. Nota abaixo de 80% faz `npm run test:mutation` falhar.
- **Relatórios:** texto no terminal, HTML em `reports/mutation/index.html` e JSON em `reports/mutation/mutation.json`. `reports/` e `.stryker-tmp/` são ignorados no Git, no Docker e no formatter.
- **Supressões:** `// Stryker disable` só para mutante de fato equivalente, com o motivo no comentário. Para texto PT-BR, a regra é asserção no texto, não supressão.

O Stryker não gera mutante para atributo nem para texto de JSX (`className`, `role`, `aria-label`, conteúdo de elemento). Os mutantes de tela são condicionais, operadores lógicos e relacionais, literais em expressões, arrays e objetos; é neles que os testes de tela precisam afirmar algo.

## Reprodução

```sh
npm ci
npm run test:mutation:baseline   # só a suíte da mutação, sem Stryker
npm run test:mutation            # Stryker; manual, leva dezenas de minutos
npx stryker run --force          # ignora o estado incremental
```

Não exige API, token nem variáveis de provedor. O workflow **Mutation tests** (`.github/workflows/mutation.yml`) só roda por `workflow_dispatch` e guarda o relatório como artefato; não roda em push nem em PR. O CI automático segue arquivado em `.github/workflows-disabled/`.

A nota usa `(Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage)`. Erros de compilação não entram na conta. Sobrevivência não prova bug: pode ser falta de teste ou alteração equivalente sob dados válidos do contrato, e cada mutante deve ser lido pelo efeito.

## Pontos fracos conhecidos

Do último relatório (anterior ao merge do Atlas), os dois arquivos que mais pesavam eram `src/app/App.tsx`, com nota **0%**, e `src/api/adapter.ts`, com **68%**. Foram reforçados depois, ainda sem nova medição:

- `tests/integration/app-routes.test.tsx`: título de cada rota, redirecionamentos de `/`, `/login` e `/callback`, página não encontrada, cabeçalho e navegação fora do mapa, foco no conteúdo ao navegar.
- `tests/unit/adapter-requests.test.ts`: URLs exatas de `search`, `candidates`, `neighbors`, `list` e `history`, vazios e nulos omitidos, método, corpo e cabeçalhos de `save`, `undo`, `resolve` e `importBatch`, também pelo transporte real.

Desde aquele relatório entraram o Atlas, os seletores por busca, o grupo de contextualização do editor e o lote de importação; esse código também ainda não foi medido.

## Histórico: rodada do marco 1 (seis módulos)

> **Histórico, não vale para o código atual.** Os números abaixo são da primeira configuração, que mutava apenas seis módulos (`src/config/schema.ts`, `src/api/client.ts`, `src/auth/auth0.ts`, `src/graph/visibility/ledger.ts`, `src/graph/adapter/elements.ts` e `src/components/period.ts`), antes da refatoração para ESLint com complexidade 10 e da ampliação para todo o `src`. Os arquivos foram reorganizados depois e a nota não foi recalculada. Aquela configuração não incluía telas, estilos, layout/canvas, adapter HTTP, schemas DTO, gerados, fixtures nem scripts de build, e usava timeout adicional de 2 s com fator 1,5 e dois processos concorrentes (um checker e um runner).

Rodada inicial em 25/10/2026, usando os testes originais do commit `5eb1c98` com a nova configuração Stryker (gate desativado apenas na primeira medição): **61,45%**, com 50 testes unitários. Foram gerados 521 mutantes: 206 mortos, 14 detectados por timeout, 96 sobreviventes, 42 sem cobertura e 163 erros de compilação. Os timeouts iniciais correspondem a loops/esperas sem resolução introduzidos pelas mutações no ledger e no transporte.

A suíte foi reforçada sem mudar os seis arquivos de produção: limites exatos de 500 pontos, ciclos órfãos, dados/cursor entre páginas, formas/direção/representação, intervalos históricos, delegação ao SDK, URL/query, cancelamento, timeout, Retry-After e erros estruturados.

Rodada final: **91,34%**, com 125 testes unitários e os mesmos 521 mutantes nos mesmos arquivos. Gate de 80% aprovado (exit code 0). Duração: 6min06s inicial e 6min31s final. Nenhum código de produção alterado.

| Resultado              | Inicial |      Final |
| ---------------------- | ------: | ---------: |
| Mortos pelos testes    |     206 |        320 |
| Detectados por timeout |      14 |          7 |
| Sobreviventes          |      96 |         30 |
| Sem cobertura          |      42 |          1 |
| Erros de compilação    |     163 |        163 |
| Total gerado           |     521 |        521 |
| Mutation score         |  61,45% | **91,34%** |

A nota usa `(Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage)`: 327/358 na rodada final. Os 163 erros de compilação não entram no numerador nem no denominador. Timeout permanece visível como categoria própria, sem ser anunciado como assert que matou o mutante.

| Módulo                 | Nota inicial | Nota final | Sobreviventes finais | Sem cobertura |
| ---------------------- | -----------: | ---------: | -------------------: | ------------: |
| Transporte HTTP        |       51,33% |     90,67% |                   14 |             0 |
| Auth0                  |       58,33% |     91,67% |                    1 |             0 |
| Períodos históricos    |       52,78% |    100,00% |                    0 |             0 |
| Configuração           |       82,22% |     90,00% |                    9 |             0 |
| Elementos do grafo     |       24,14% |     75,86% |                    6 |             1 |
| Ledger de visibilidade |       87,80% |    100,00% |                    0 |             0 |

### Sobreviventes e limitações

Os 30 sobreviventes **não foram suprimidos**. A nota não é 100% e o gate é global no escopo selecionado, não por arquivo.

- **Elementos (6):** quatro cores podem virar string vazia sem quebrar os asserts atuais de consistência/contraste com neutro; a indexação da paleta e a escala de espessura também têm mutantes sobreviventes. É uma lacuna real de teste da validade CSS/política visual; a adaptação de elementos tem a menor nota (75,86%).
- **Sem cobertura (1):** fallback `n.contexts[0] ?? ''`, dentro do ramo que exige array não vazio. Com strings[] validado pelo adapter, o primeiro item desse ramo não é undefined; arrays esparsos não vêm do JSON válido. Mantivemos o mutante no relatório, sem inventar dados inválidos para inflar a nota.
- **HTTP (14):** incluem remoção da mensagem de rede, limpeza/listener de abort em corridas de Retry-After, guarda de método do retry e parsing defensivo de respostas inválidas. Alguns são redundantes em cenários normais; corridas de cancelamento e diagnóstico de erro continuam candidatos para testes adicionais. Não foram declarados todos equivalentes.
- **Configuração (9):** há validações sobrepostas entre helper, URL, regex e exigência de origem raiz. Exemplo: credenciais precisam de `@`, já rejeitado pela regex mesmo sem checar username/password. Ainda faltam casos não canônicos que distingam todas as guardas. Nenhuma validação foi removida.
- **Auth0 (1):** a guarda de modo pode mudar sem ser percebida quando somente configurações normalizadas pelo parser são usadas. Falta cobrir diretamente o estado inconsistente de modo none com objeto OIDC presente; o bootstrap do produto já evita chamar o SDK nesse modo.

O JSON preserva IDs, localizações, substituições e testes associados para revisão individual. Não há validação de toda a UI/Canvas por mutação nesta rodada; integração real com API permanece fora do escopo.
