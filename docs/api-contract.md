# Contrato e integração

## Situação

Em 02/11/2026 o snapshot de `contracts/openapi.json` da API foi atualizado para o commit `fb84a5280e9a5e24ddab813671bce43783058ec2` (`info.version` 1.3.0, busca por significado; PR #8 da API, só acréscimos). Antes disso, em 01/11/2026, `5215021175aa1f0d409bb7f49077894d93575b9f` (1.2.0, modelo de dados v2). Antes disso: 1.1.0 (`e27da26a162755707edfc4bf9e53306ba25e8ca8`, 31/10/2026) e a primeira importação, de 29/10/2026, 1.0.0 (`d0119459e99e806fb0c55d1a1df33643099e0f3c`). `contracts/source.json` registra origem, commit e SHA-256; `src/api/generated/` contém tipos e cliente gerados.

`src/api/domain.ts` valida por Zod os formatos de resposta do contrato; o tipo `ContractCheck` falha a compilação se o modelo divergir dos tipos gerados. `src/api/adapter.ts` usa as rotas, filtros (`contextId`, `includePending`, `startYear`, `endYear`, `includeUnknownPeriod`), `If-Match` com a versão inteira e os corpos de undo/resolve do contrato. Respostas fora do contrato mostram erro explícito; produção nunca troca para mocks.

## Contrato 1.3.0 (busca por significado)

A API calcula os embeddings localmente (`Xenova/multilingual-e5-small`) e guarda os vetores com pgvector. **Semelhança é pista, nunca evidência: não é identidade nem prova influência.** Nada é gravado por causa dela; a única escrita nova é dispensar um par sugerido, por decisão do usuário.

- `GET /search/semantic?q=&kind=&includePending=&limit=`: `q` de 1 a 500 caracteres, `includePending` `"true"|"false"` (padrão falso), `limit` de 1 a 50 (padrão 10). Devolve `SemanticResults` `{ model, items: [{ node, score }] }`, melhor primeiro; é um top-k, sem cursor.
- `GET /nodes/{id}/similar?limit=`: o mesmo formato, sem o próprio ponto e só com pontos ativos.
- `GET /suggestions/parallels?limit=&minScore=`: `ParallelSuggestions` `{ model, items: [{ a, b, score }] }`, pares de pontos ativos sem relação entre si (nos dois sentidos, qualquer estado menos arquivada) e não dispensados; sem `minScore` vale o limiar do servidor (0,91).
- `POST /suggestions/parallels/dismiss` com `{ a, b, reason }` (motivo de 1 a 2000 caracteres): `ParallelDismissal` `{ id, a, b, kind, reason, createdAt }`. O par é guardado ordenado (ids em minúsculas, o menor primeiro) e repetir devolve o primeiro registro. Não leva `Idempotency-Key`; no web, `withoutIdempotencyKey` em `RequestOptions` é a única exceção à regra "POST exige chave".
- Busca desligada ou modelo que não carrega: os quatro respondem **503 `SEMANTIC_UNAVAILABLE`**; o resto da API segue. O transporte só repete 429, então o 503 volta na hora.
- Itens `create` de ponto no lote trazem `similar: [{ id, label, score }]` (até 3 pontos existentes), na resposta de `POST /imports` e em `GET /imports/{id}` (recalculado a cada leitura contra os pontos de agora; lote desfeito não tem). Campo ausente = busca desligada ou falhou; lista vazia = nada parecido. No `importItemSchema`, `similar` é `exactOptional` (não vira `[]`), para o `ContractCheck` com `exactOptionalPropertyTypes`.
- **A pontuação é comprimida**: textos sem relação costumam dar 0,80 a 0,89. No web ela é só a ordem e um número pequeno, "semelhança 0,87" (duas casas, vírgula), nunca percentual, probabilidade nem "confiança".

No web: `api.semanticSearch(q, { kind, includePending, limit }, signal)`, `api.similarNodes(id, limit, signal)`, `api.parallels({ limit, minScore }, signal)` e `api.dismissParallel(a, b, reason)`; `ContractCheck` compara `SemanticResults`, `ParallelSuggestions` e `ParallelDismissal` com os tipos gerados. As fixtures implementam as quatro rotas e o `similar` do lote (`src/dev/fixture-semantic.ts`).

## Contrato 1.2.0 (modelo de dados v2)

- **Ponto:** `startYear`, `endYear`, `precision`, `periodLabel` (mesmos limites de ano dos contextos, -100000..3000) e `identifiers: [{scheme, value}]` (até 20; `wikidata`, `viaf`, `isni`, `isbn`, `doi`, `openlibrary`). A API normaliza o identificador (o endereço do registro vira o código) e o devolve ordenado por esquema e valor; o par é único em todos os pontos, arquivados inclusive. Repetir identificador no REST é 409 `DUPLICATE` (`message` "Registro duplicado", campo em `details[0]` `identifiers`: "Identificador já cadastrado em outro ponto"). Novo tipo `figure` (sem `conceptScope`), predicado `authored` e `identifierSchemes` no catálogo.
- **Busca:** `match=exact` (nome ou alias inteiro, ou identificador); um `q` que seja identificador válido encontra o dono dele.
- **Lote:** `ImportResult` ganha `discarded`; o item pode trazer `candidates: string[]` (IDs dos registros que ele repetiria) e o desfecho `discarded`. `create` que repete identificador (checado primeiro) ou nome/alias de ponto não arquivado do mesmo tipo fica pendente com os candidatos no item e nos ids do motivo. Erros de validação ao gravar um item levam a posição dele (`nodes.2.identifiers.0.value`).
- **Pendências:** cada item de `GET /pending` traz só a operação proposta (`{ "nodes": [op] }`). `selection: {discard: true}` descarta (desfecho `discarded`, `entityId` nulo na resposta; não toca em registro). Desfazer o lote marca o que ainda estava pendente como `discarded` ("Lote desfeito") e o tira da fila.

No web, `ContractCheck` compara `Node`, `Catalog` e `ImportResult` com os tipos gerados; `importItemSchema.candidates` tem padrão `[]` e `importDetailSchema.result.discarded` tem padrão 0 (lotes gravados antes do modelo v2 não têm o campo). O editor de ponto tem período (mesma conversão a.C./astronômico do contexto, limites conferidos antes de enviar) e linhas de identificador (erro da API na linha do valor; `DUPLICATE` não abre a comparação de versão). `Descartar pendência` envia `{discard: true}` e o detalhe do lote lista "Descartados" e os candidatos de cada pendência com link para o editor.

### Busca nas listas (Pontos, Fontes, Contextos)

`api.list(type, cursor, signal, filters)` aceita `q`, `match` (`contains`, o padrão, ou `exact`), `includePending` e, só para pontos, `kind`, `startYear`, `endYear` e `includeUnknownPeriod`; o `query()` do adapter omite o vazio. `q` acha, sem acento nem caixa, o nome ou outro nome do ponto, o título da fonte e o nome do contexto, e também o dono de um identificador inteiro (QID ou endereço da Wikidata em pontos; DOI ou URL em fontes). `exact` pede o nome inteiro.

`RecordsPage` guarda a busca na URL (`useSearchParams`) com os mesmos nomes; vazio e padrão da API (`match=contains`, `includePending=false`, `includeUnknownPeriod=true`) ficam fora da URL e da requisição, e parâmetro inválido ou alheio ao tipo é ignorado. A API recusa o cursor de uma busca com outros filtros, então os filtros fazem parte da chave da consulta (`['list', type, filters]`) e mudar um deles recomeça a paginação. Relações e Views não têm busca. As fixtures aplicam as mesmas regras (texto, DOI/URL exatos, `includePending`) e recusam o cursor de outra busca com 400.

## Contrato 1.1.0

Nenhuma rota ou campo foi removido; o que mudou é o comportamento e alguns limites:

- `op: "update"` no lote (`ImportBatchV1`, `POST /api/v1/imports`) é parcial: campo omitido é preservado, uma lista enviada substitui a lista inteira, `null` explícito limpa o campo e um update sem campo nenhum é rejeitado.
- Erros de validação trazem `details: [{ path, message }]` com o caminho do campo (`relations.0.claim`).
- `viewUrl` do resultado do lote aponta para `/imports/{batchId}` do web.
- Pendências de lote desfeito saem de `GET /pending`; resolver uma retorna 409 `BATCH_UNDONE`.
- Um ponto não sai de `active` com relações ativas (409 `DEPENDENCIES`), e relação ativa exige ponto de atribuição ativo (422 `INACTIVE_ATTRIBUTION`, que no lote vira pendência). Origem igual ao destino é rejeitada.
- Anos de contexto e dos filtros ficam entre -100000 e 3000 (astronômicos).

No web, `ApiError.code` expõe o código do envelope e `Failure` lista cada `details[].path` com a mensagem. Os 409 `BATCH_UNDONE`, `DEPENDENCIES`, `CONTEXT_DEPENDENCY`, `IMMUTABLE_CLASSIFICATION`, `IDEMPOTENCY_CONFLICT` e `UNDO_CONFLICT` mostram a mensagem da API e não abrem a comparação de versão do editor (só 409/412 de versão abrem). `BATCH_UNDONE` na tela de pendências também recarrega a lista.

Conceito contextual ativo exige contexto e uma relação `contextualizes` ativa com um conceito amplo ativo, e a relação ativa exige os dois pontos ativos: pelo REST um não ativa antes do outro. Só o lote cria ou atualiza os dois na mesma transação (o escopo contextual só é conferido no fim do lote).

### Conceito contextual no editor

`importBatch(body, key)` (`adapter.ts`) faz `POST /imports` com `Idempotency-Key` igual à `idempotencyKey` do corpo e valida a resposta com `importResultSchema` (comparado ao `ImportResult` gerado pelo `ContractCheck`). O corpo é do tipo `ImportBatch`, derivado dos itens gerados do `ImportBatchV1`.

- **Criar** (ponto novo, conceito, escopo contextual, estado ativo): `origin: "manual"`, `inputSummary` "Conceito contextual criado no editor", `nodes[0]` create e `relations[0]` create (`contextualizes`, `source` `{clientRef}`, `target` `{id}` do conceito amplo ativo), `dryRun: false`. Exige ao menos um contexto.
- **Ativar** (ponto pendente ou arquivado, estado → Ativo): o editor lê `GET /relations?nodeId=&type=contextualizes&includePending=true` na hora de salvar e envia update parcial do ponto e de uma relação pendente (`{op:"update", id, expectedVersion, status:"active"}`, mais os campos do ponto que mudaram no formulário). Sem relação pendente, o mesmo lote cria uma, com `source` `{id}` do ponto.
- Conceito contextual pendente criado como rascunho segue o `POST /nodes`. Ponto já ativo segue o `PATCH`.
- Com `pending > 0` o editor lista cada item pendente e o motivo, não diz que deu certo e mantém o rascunho; o link vai para `/imports/{batchId}`.

## Importar versão publicada

1. Obter snapshot autorizado da API em commit/tag explícito. Revisar exemplos: sintéticos, sem dados pessoais/segredos/hosts internos. Não é necessário checkout do backend.
2. `npm run contracts:import -- /snapshot-local.json <commit-completo>` salva bytes em `contracts/openapi.json`, registra commit, `info.version` e SHA-256 e gera tipos/cliente.
3. `npm run contracts:check` verifica checksum, versão e regeneração exata. Gerados nunca são editados manualmente. O teste de geração usa uma spec sintética somente em diretório temporário, sem publicá-la como oficial.
4. Reconciliar `adapter.ts` com DTOs e envelopes reais, paginação, ETags, erros e scopes. Usar o cliente gerado com transporte autenticado; não manter casts de um contrato diferente.
5. Executar testes de contrato e smoke real. Atualização entra em commit/PR próprio do web. Build normal não acessa repo privado nem baixa latest.

Enquanto `pending`, check/build informam a pendência e permitem o desenvolvimento da UI. `REQUIRE_API_CONTRACT=true` bloqueia a release integrada até existir snapshot. A variável não substitui reconciliação e smoke.

## Transporte

Atualização de 25/10/2026: sem sessão em VITE_AUTH_MODE=none (padrão), Authorization é omitido, /me é dispensado e 401 não tenta renovação. As demais regras de timeout, idempotência e conflito permanecem. O fluxo autenticado abaixo permanece em VITE_AUTH_MODE=oidc.

URL absoluta configurada + `/api/v1`. Token só em Authorization para caminhos internos validados. GET sem Content-Type; request ID, AbortSignal e timeout. 401 renova uma vez; 403 não repete login. GET 429 permite uma repetição curta (até 2s) respeitando Retry-After; demais casos informam espera. Mutações não repetem em 429/falha de rede. POST exige chave estável por ação, conservada em retry. PATCH exige versão If-Match; 409/412 carrega dados atuais e preserva o rascunho para comparação explícita.

API deve permitir origens específicas por CORS, Authorization/Content-Type/Idempotency-Key/If-Match/X-Request-Id e expor ETag/X-Request-Id/Retry-After. Falhas CORS são reportadas, sem desativar segurança do navegador. Links externos são HTTP(S), sem token, com noopener/noreferrer.

## Cadastro assistido por IA

Guia prático de consulta e registro de dados pela REST ou pelo MCP (sem
sessão de navegador) no [guia de cadastro por IA](https://github.com/guihmartins/idea-sonar-api/blob/main/docs/ai-registration.md).
No workspace com os dois repositórios lado a lado, o arquivo fica em
`../../idea-sonar-api/docs/ai-registration.md`; o ambiente local é descrito
em `../../AGENTS.md`.
