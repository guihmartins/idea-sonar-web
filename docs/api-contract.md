# Contrato e integração

## Situação

Em 31/10/2026 o snapshot de `contracts/openapi.json` da API foi atualizado para o commit `e27da26a162755707edfc4bf9e53306ba25e8ca8` (`info.version` 1.1.0); a primeira importação, de 29/10/2026, era do commit `d0119459e99e806fb0c55d1a1df33643099e0f3c` (1.0.0). `contracts/source.json` registra origem, commit e SHA-256; `src/api/generated/` contém tipos e cliente gerados.

`src/api/domain.ts` valida por Zod os formatos de resposta do contrato; o tipo `ContractCheck` falha a compilação se o modelo divergir dos tipos gerados. `src/api/adapter.ts` usa as rotas, filtros (`contextId`, `includePending`, `startYear`, `endYear`, `includeUnknownPeriod`), `If-Match` com a versão inteira e os corpos de undo/resolve do contrato. Respostas fora do contrato mostram erro explícito; produção nunca troca para mocks.

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
