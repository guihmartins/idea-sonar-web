# Contrato e integração

## Situação

Em 24/10/2026 o caminho oficial retornou 404; nova consulta da árvore de `main` encontrou apenas `PLAN.md`. `contracts/source.json` permanece `pending`. Não existe OpenAPI ou cliente **oficial** inventado neste repositório. Smoke real pendente.

`src/api/domain.ts` é modelo de apresentação validado por Zod. `src/api/adapter.ts` usa provisoriamente as rotas/formatos de referência do PLAN. Respostas incompatíveis mostram erro explícito; produção nunca troca para mocks. Isso permite implementar e testar o frontend antes da API, sem alegar que o protocolo de rede está confirmado.

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
