# Testes de mutação

StrykerJS 10.1.1 com runner Vitest 10.1.1 e checker TypeScript 10.1.1, Node 24.19.0, TypeScript 5.9.3 e Vitest 5.0.5. Dependências exatas e lockfile versionados.

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

## Portão por arquivo do núcleo

O `break` de 80% é global: a média de arquivos simples cobre um arquivo central fraco. `npm run test:mutation:gate` (`scripts/mutation-gate.mjs`) lê `reports/mutation/mutation.json`, calcula a nota de cada arquivo do núcleo com a mesma fórmula do Stryker e sai com código 1 se algum ficar abaixo de 80%. Não refaz a mutação: roda depois do `npm run test:mutation`, em um segundo.

- **Núcleo:** `src/api/**` (transporte, adapter e schemas), `src/graph/**` (ledger, elementos, estilos, layout, fluxo, restauração e canvas) e `src/pages/editor/payload.ts` (o que vira corpo de gravação). Telas e componentes de apresentação ficam só no piso global.
- **Uso:** `node scripts/mutation-gate.mjs [relatório.json] [mínimo]`; os padrões são `reports/mutation/mutation.json` e `80`.
- O script imprime a nota global, as notas do núcleo e quantos mutantes seguem abertos em cada arquivo; falha também se o relatório não trouxer nenhum arquivo do núcleo (escopo do Stryker alterado por engano).

O Stryker não gera mutante para atributo nem para texto de JSX (`className`, `role`, `aria-label`, conteúdo de elemento). Os mutantes de tela são condicionais, operadores lógicos e relacionais, literais em expressões, arrays e objetos; é neles que os testes de tela precisam afirmar algo.

## Reprodução

```sh
npm ci
npm run test:mutation:baseline   # só a suíte da mutação, sem Stryker
npm run test:mutation            # Stryker; manual, leva dezenas de minutos
npx stryker run --force          # ignora o estado incremental
```

Não exige API, token nem variáveis de provedor. O workflow **Mutation tests** (`.github/workflows/mutation.yml`) só roda por `workflow_dispatch` e guarda o relatório como artefato; não roda em push nem em PR. O CI automático segue arquivado em `.github/workflows-disabled/`.

Cuidados com o estado incremental:

- O Stryker só reexecuta um mutante **sobrevivente** quando um teste novo passa a cobri-lo. Mutantes **estáticos** (constantes e literais avaliados na carga do módulo, como `palette.ts`, tabelas e `useState` inicial) não têm cobertura por teste, então um sobrevivente estático nunca é reavaliado por teste novo. Depois de escrever testes para um arquivo, remova do `reports/stryker-incremental.json` os sobreviventes com `"static": true` desse arquivo (ou use `--force`) antes de remedir.
- Para iterar em poucos arquivos sem tocar no estado principal, use um arquivo de configuração temporário que importe `stryker.config.mjs` e troque `incrementalFile`, `jsonReporter.fileName` e `reporters`; rode com `npx stryker run <config> --mutate 'src/graph/*.ts'`. O `--mutate` aceita lista separada por vírgula, mas não expande `{ts,tsx}` dentro dela.
- O `tsconfig.json` também checa os testes: erro de tipo em teste derruba o checker do Stryker na inicialização, antes de qualquer mutante.

A nota usa `(Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage)`. Erros de compilação não entram na conta. Sobrevivência não prova bug: pode ser falta de teste ou alteração equivalente sob dados válidos do contrato, e cada mutante deve ser lido pelo efeito.

## Rodada atual: fase 6 (01/11/2026)

Execução completa sobre o escopo atual, que já inclui o Atlas (estilos, canvas, layout e MapPage). A medição anterior do mesmo código, antes desta fase, deu **72,69%** e reprovava o `break`; depois dos testes novos: **90,70%** (3216 mutantes válidos, 299 abertos), `npm run test:mutation` com código de saída 0 e `npm run test:mutation:gate` também.

| Arquivo                                    |        Antes |       Depois | Abertos depois |
| ------------------------------------------ | -----------: | -----------: | -------------: |
| `src/graph/styles/index.ts` (núcleo)       |        19,1% |        95,5% |              7 |
| `src/graph/GraphCanvas.tsx` (núcleo)       |        31,5% |        98,2% |              3 |
| `src/graph/styles/palette.ts` (núcleo)     |        41,7% |         100% |              0 |
| `src/graph/layout/positions.ts` (núcleo)   |        62,7% |        98,8% |              1 |
| `src/graph/adapter/elements.ts` (núcleo)   |        81,8% |        95,5% |              1 |
| `src/api/domain.ts` (núcleo)               |        76,9% |         100% |              0 |
| `src/pages/editor/payload.ts` (núcleo)     |        87,4% |        97,8% |              4 |
| `src/graph/flow.ts`, `restore.ts` (núcleo) | 91,4%, 86,3% | 93,5%, 86,3% |           6, 7 |
| `src/api/client.ts`, `adapter.ts` (núcleo) | 92,3%, 92,5% |  92,3%, 100% |          14, 0 |
| `src/pages/MapPage.tsx`                    |        60,7% |        83,0% |            105 |
| `src/pages/editor/Contextualization.tsx`   |        67,5% |        92,8% |              6 |
| `src/pages/EntityEditor.tsx`               |        72,2% |        84,0% |             62 |
| `src/app/services.tsx`                     |        73,7% |        91,9% |              8 |
| `src/pages/editor/pickers.tsx`             |        75,9% |        92,0% |             11 |
| `src/pages/RecordsPage.tsx`                |        80,9% |        91,4% |             28 |

O que os testes novos afirmam (comportamento, não constante):

- **Estilo do grafo:** glifo por tipo (incluindo a figura em triângulo), traço por status de evidência, espessura por intensidade (e +0,3 na relação selecionada), seta só em relação direcional, cor por índice de contexto, nó selecionado invertido, leque de relações paralelas (as duas direções caem em lados opostos) e cada ramo da curva em S, com coordenadas exatas sobre um Cytoscape real sem tela. Os valores da paleta são afirmados exatos de propósito: são o contrato visual de `DESIGN.md` ("Grafo sobre a prancha"), com 3:1 de contraste sobre o marfim conferido por conta.
- **Layout:** centro do canvas com zoom e pan, caixa do rótulo e colisão (encostar conta como colisão, 1px de folga não), e o slot de cada tentativa.
- **`GraphCanvas`:** nomes e seletores dos eventos, snapshot de posições e viewport, seleção e destaque da vizinhança, grupos de contexto em pixels do contêiner, comando de zoom, foco, ajuste, cancelamento ao desmontar e o fluxo animado (duração entre 3 e 5 s, retomada da aba oculta sem pular o tempo). O Cytoscape é um dublê que, como o real, recusa id repetido.
- **Telas:** trilho de seções, painéis do ponto e da relação, legenda, modo lista, foco, restauração de view, estados de carregamento, vazio e erro com nova tentativa, seletores por busca, grupo de contextualização, forma dos campos do editor, ciclo de salvar, arquivar e conflito, e as telas do portão de sessão.

### Mutantes abertos que não valem um teste

Nenhum `// Stryker disable` foi usado; os abertos ficam no relatório. Os do núcleo que são equivalentes:

- `styles/index.ts` `hashSign`, `hash * 31 - código`: só a paridade do hash é usada, e `31` é ímpar, então `+` e `-` dão a mesma paridade.
- `styles/index.ts` `parallelSlot`, comparador do `sort` (cinco mutantes): os ids são únicos, e o `sort` do V8 só olha se o resultado é negativo; devolver `0` no lugar de `1` não muda a ordem. `index <= 0 ? 0 : index` também não: com índice 0 os dois lados dão 0.
- `positions.ts` `attempt <= maxAttempts`: a tentativa 47 já aceita à força (`attempt === maxAttempts - 1`) e sai do laço antes da 48.
- `GraphCanvas.tsx` `[]` trocado por `["…"]` nas dependências do efeito de montagem: uma constante se comporta como `[]`. `stop()` dentro de `!flowEnabled`: o efeito anterior já chama `stop()` na limpeza. `state.key !== key` para `true`: só refaz o trajeto amostrado a cada quadro, mesmo resultado, mais custo.
- `elements.ts` `n.contexts[0] ?? ''`: ramo inalcançável, porque o ramo já exige lista não vazia.

Os demais abertos do núcleo (`client.ts` 14, `restore.ts` 7, `flow.ts` 6, `payload.ts` 4) são guardas sobrepostas, mensagens de erro raras e limites de laço do cálculo de amostragem, sem teste dedicado. Nenhum arquivo do núcleo está abaixo de 80%.

### Fora do núcleo, ainda abertos

`MapPage.tsx` (105) e `EntityEditor.tsx` (62) concentram quase metade dos abertos. A maioria é `queryKey`, textos de aria e ícones SVG, estados de interface que só aparecem em corrida (desmontar durante uma chamada) e `setX` de reinício que não muda o que se vê. `config/schema.ts` (14, 86,1%) tem validações sobrepostas, descritas na rodada histórica abaixo.

## Rodada: busca nas listas (01/11/2026)

Execução incremental depois da busca nas listas de pontos, fontes e contextos (só os mutantes dos arquivos e testes tocados foram refeitos): **91,35%** (3398 mutantes válidos), contra 90,70% da fase 6. `npm run test:mutation` e `npm run test:mutation:gate` saíram com código 0; nenhum arquivo do núcleo mudou de nota além de `src/api/adapter.ts`, que segue em 100%.

| Arquivo                        |   Nota | Abertos |
| ------------------------------ | -----: | ------: |
| `src/pages/searchFilters.ts`   |   100% |       0 |
| `src/pages/RecordSearch.tsx`   |   100% |       0 |
| `src/components/YearField.tsx` |   100% |       0 |
| `src/components/period.ts`     |   100% |       0 |
| `src/api/adapter.ts` (núcleo)  |   100% |       0 |
| `src/pages/editor/fields.tsx`  | 91,89% |       9 |
| `src/pages/RecordsPage.tsx`    | 91,82% |      27 |

Na primeira passada ficaram vivos oito mutantes dos arquivos novos, e seis viraram asserção: o cancelamento do envio do formulário (`preventDefault`), a era do fim, a dica de cada campo (`placeholder`) e os filtros na chave `['list', type, filters]`. Dois eram equivalentes e o código foi simplificado em vez de suprimido: `value ?? ''` em `isKind` e o `target === applied ? null : target` do pedido pendente, que o próximo `setPending(null)` já anulava. Como os literais de `searchHints` são mutantes estáticos, os sobreviventes estáticos desses arquivos saíram do estado incremental antes da segunda passada.

## Rodada: busca por significado (02/11/2026)

Execução incremental depois da busca por significado (contrato 1.3.0): modo Nome | Significado em Pontos, pontos parecidos no painel do mapa, página Sugestões, pré-preenchimento do editor de relação e os avisos de parecidos. Nota global **91,83%** (3759 mutantes válidos, 307 abertos), contra 91,35% da rodada anterior; `npm run test:mutation` e `npm run test:mutation:gate` saíram com código 0. Primeira passada: 91,06% (3758 válidos); depois de fechar sobreviventes com testes e de simplificar três guardas que não mudavam o resultado chegou a 91,85%, e a segunda passada, depois de o aviso do cadastro passar à busca `mode=duplicates` (texto no formato da API, tipo e outros nomes vindos do editor), ficou em 91,83%.

| Arquivo                            |   Nota | Abertos |
| ---------------------------------- | -----: | ------: |
| `src/pages/searchFilters.ts`       |   100% |       0 |
| `src/pages/RecordSearch.tsx`       |   100% |       0 |
| `src/pages/RecordItem.tsx`         |   100% |       0 |
| `src/pages/SuggestionsPage.tsx`    |   100% |       0 |
| `src/pages/ImportSimilar.tsx`      |   100% |       0 |
| `src/pages/editor/prefill.ts`      |   100% |       0 |
| `src/components/semantic.ts`       |   100% |       0 |
| `src/app/App.tsx`                  |   100% |       0 |
| `src/pages/editor/SimilarHint.tsx` | 97,30% |       1 |
| `src/pages/SimilarPoints.tsx`      | 96,67% |       1 |
| `src/pages/MeaningResults.tsx`     | 92,31% |       4 |
| `src/api/adapter.ts` (núcleo)      |   100% |       0 |
| `src/api/domain.ts` (núcleo)       |   100% |       0 |
| `src/api/client.ts` (núcleo)       | 92,47% |      14 |
| `src/pages/EntityEditor.tsx`       | 83,29% |      67 |
| `src/pages/MapPage.tsx`            | 83,12% |     105 |

Nenhum arquivo do núcleo mudou de nota além do `client.ts`, que ganhou a exceção `withoutIdempotencyKey` e seguiu em 92,47%, com os mesmos 14 abertos. O `EntityEditor.tsx` passou de 84,0% para 82,88% (62 para 69 abertos) e o `MapPage.tsx` ficou em 83% (105 abertos): os abertos novos estão listados abaixo.

O que os testes novos afirmam (comportamento, não constante):

- **Modo e URL:** a URL com e sem `mode=significado` para pontos, fontes e contextos; que só texto, tipo e pendentes atravessam a troca (e `match`/período não); o limite de 500 caracteres só em Significado; "Limpar" que mantém o modo; setas entre os dois rádios sem perder o foco; voltar e avançar.
- **Resultados:** a requisição exata (`q`, `kind`, `includePending`, `limit`), pontuação "0,87" / "0,90" / "1,00" e a ausência de `%`, "Mostrar mais" com 20 e com 20 em 50, o limite que volta a 20 em busca nova e a consulta que não reaproveita a resposta de outro tipo ou de outros pendentes (chave da consulta).
- **Fixtures:** a similaridade de Jaccard, o limiar, a ordem da busca, o par sugerido sem relação (nos dois sentidos, pendente conta, arquivada não), a dispensa idempotente por par e em qualquer ordem, os 400 (`a === b`, motivo vazio ou de 2001 caracteres, limites) e o `similar` do lote, do resultado, da simulação e do detalhe.
- **Telas:** as linhas do painel do mapa e o gesto de ativá-las (o ponto vira a raiz), a consulta por ponto, o motivo obrigatório da dispensa (com `preventDefault`, foco no campo e erro limpo na nova tentativa), a invalidação só das sugestões, o pré-preenchimento (cada valor conferido sozinho, ids com letras, destino igual à origem, só relação nova, formulário que reabre com outra URL) e o aviso do cadastro (600 ms, uma consulta por texto final em `mode=duplicates`, `q` no formato do texto do ponto com tipo em português, outros nomes sem o idioma e corte em 500, só aparece com resultado, links em outra aba, some sem nome ou descrição, 503 e outras falhas escondem o bloco).

### Mutantes abertos que não valem um teste

Nenhum `// Stryker disable` foi usado. Equivalentes ou só observáveis por colisão de chave:

- `MeaningResults.tsx`: o literal `'semantic'` da chave da consulta e os dois `??` de `kind` e `includePending` dentro dela (a tela é remontada a cada busca, então uma chave igual não mostra resposta velha).
- `SimilarPoints.tsx` e `SimilarHint.tsx`: o literal inicial da chave (`'similar'`, `'similar-hint'`); o resto da chave tem teste.
- `EntityEditor.tsx`: `wanted` (a guarda do pré-preenchimento) é redundante com o que vem depois (só relação nova usa os quatro campos, e o catálogo é o mesmo da consulta `['catalog']`, cujos literais também ficam abertos), as variantes de `id ?? 'new'` na `key` do formulário e os quatro `?? ''` dos campos que `NewNodeHint` repassa ao aviso (`fields` sempre traz as chaves, então o recuo nunca é usado).

Como o Stryker não reavalia sobrevivente estático, os sobreviventes estáticos dos arquivos tocados (`hintTitle` no `SimilarHint.tsx` e as constantes de texto do `EntityEditor.tsx`) saíram do `reports/stryker-incremental.json` antes da segunda passada.

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
