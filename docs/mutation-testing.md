# Testes de mutação

StrykerJS 10.1.1 com runner Vitest 10.1.1 e checker TypeScript 10.1.1, Node 24.19.0, TypeScript 5.9.3 e Vitest 5.0.5. Dependências exatas e lockfile versionados.

## Escopo

Seis módulos de lógica crítica, sem alteração do comportamento de produção:

- `src/config/schema.ts`: validação da URL da API e modos none/OIDC.
- `src/api/client.ts`: headers, corpos, idempotência, If-Match, renovação, erros, timeout e cancelamento.
- `src/auth/auth0.ts`: configuração/delegação ao SDK oficial e token em memória.
- `src/graph/visibility/ledger.ts`: raízes, expansão/paginação, compartilhamento, gerações e limite de pontos.
- `src/graph/adapter/elements.ts`: identidade, formas, cor, direção, evidência e intensidade.
- `src/components/period.ts`: anos astronômicos, intervalos, aproximação e período desconhecido.

Não inclui telas React, estilos, layout/canvas, adapter HTTP provisório, schemas DTO, gerados, fixtures ou scripts de build. Testes de integração/build e Playwright permanecem na suíte normal. A nota abaixo **não representa todo o frontend**, nem valida integração com API/OIDC reais.

## Reprodução

```sh
npm ci
npm run test:mutation:baseline
npm run test:mutation
```

A primeira etapa executa somente os testes unitários usados pelo runner. A segunda cria sandboxes temporários, instrumenta o código e executa mutações reais. Não exige API, token ou variáveis de provedor. O modo sem token do produto permanece inalterado.

Configuração: `stryker.config.mjs` e `vitest.mutation.config.ts`. Cobertura por teste, seleção de testes relacionados, operadores padrão e mutantes estáticos habilitados. Nenhum operador/mutante foi excluído para elevar a nota. O checker separa alterações que não compilam; elas não contam como mutações detectadas por testes. Dois processos concorrentes (um checker e um runner), timeout adicional de 2s e fator 1,5.

## Resultado

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

## Sobreviventes e limitações

Os 30 sobreviventes **não foram suprimidos**. A nota não é 100% e o gate é global no escopo selecionado, não por arquivo.

- **Elementos (6):** quatro cores podem virar string vazia sem quebrar os asserts atuais de consistência/contraste com neutro; a indexação da paleta e a escala de espessura também têm mutantes sobreviventes. É uma lacuna real de teste da validade CSS/política visual; a adaptação de elementos tem a menor nota (75,86%).
- **Sem cobertura (1):** fallback `n.contexts[0] ?? ''`, dentro do ramo que exige array não vazio. Com strings[] validado pelo adapter, o primeiro item desse ramo não é undefined; arrays esparsos não vêm do JSON válido. Mantivemos o mutante no relatório, sem inventar dados inválidos para inflar a nota.
- **HTTP (14):** incluem remoção da mensagem de rede, limpeza/listener de abort em corridas de Retry-After, guarda de método do retry e parsing defensivo de respostas inválidas. Alguns são redundantes em cenários normais; corridas de cancelamento e diagnóstico de erro continuam candidatos para testes adicionais. Não foram declarados todos equivalentes.
- **Configuração (9):** há validações sobrepostas entre helper, URL, regex e exigência de origem raiz. Exemplo: credenciais precisam de `@`, já rejeitado pela regex mesmo sem checar username/password. Ainda faltam casos não canônicos que distingam todas as guardas. Nenhuma validação foi removida.
- **Auth0 (1):** a guarda de modo pode mudar sem ser percebida quando somente configurações normalizadas pelo parser são usadas. Falta cobrir diretamente o estado inconsistente de modo none com objeto OIDC presente; o bootstrap do produto já evita chamar o SDK nesse modo.

O JSON preserva IDs, localizações, substituições e testes associados para revisão individual. Não há validação de toda a UI/Canvas por mutação nesta rodada; integração real com API permanece fora do escopo.

## Relatórios e CI

- HTML navegável: `reports/mutation/index.html`.
- Dados por mutante/teste: `reports/mutation/mutation.json`.
- HTML/JSON e `.stryker-tmp` são ignorados no Git, no contexto Docker e no formatter.
- Workflow **Mutation tests** desativado por solicitação de 25/10/2026; definição preservada em `.github/workflows-disabled/mutation.yml`. Não há execução manual/automática ou publicação de artifacts enquanto desativado. Os relatórios continuam disponíveis pelo comando local.
- Gate configurado em 80% no escopo acima; nota inferior faz `npm run test:mutation` falhar. O workflow de verificação também está desativado; testes de integração, build, E2E e container continuam disponíveis por comandos locais.

Sobrevivência não prova que o código tem um bug: pode indicar falta de teste ou uma alteração equivalente sob os dados/contrato válidos. A análise deve olhar o efeito de cada mutante. Uma nota alta tampouco substitui revisão ou testes com API real.
