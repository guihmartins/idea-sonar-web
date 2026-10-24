# Idea Sonar Web — plano exclusivo do frontend

Versão 2.0 · 24/10/2026 · Repositório: guihmartins/idea-sonar-web

## 1. Instruções para o Codex e escopo

Implemente SOMENTE o frontend web neste repositório. Backend independente está em guihmartins/idea-sonar-api. Este plano substitui a proposta anterior de monorepo. Não criar servidor Hono, MCP, PostgreSQL, Drizzle, migrations, sistema próprio de senhas ou endpoints de negócio aqui. Não acessar banco pelo navegador.

Este documento é autocontido para construir a interface e seu cliente HTTP. O contrato OpenAPI publicado pela API é a autoridade dos formatos de rede. Ler instruções do repo, verificar arquivos existentes, implementar por marcos e registrar decisões em docs/decisions.md.

Deploy inicial: container servindo arquivos estáticos. Deploy futuro: S3 + CloudFront. A API continua separada; mobile será outra aplicação futura consumindo a mesma API. Não criar código mobile nem acoplar build a um checkout do backend.

A URL da API DEVE vir de variável de ambiente no BUILD: VITE_API_BASE_URL. Não usar config.json em runtime, injeção no startup do container ou fallback silencioso para mesma origem. Não exigir backend para servir o bundle.

## 2. Objetivo do produto

Mapa pessoal de autores, tradições, conceitos e obras para explorar ideias, interpretações contextualizadas, transmissão e influências cruzadas. Os dados exigem autenticação mesmo se o código frontend for público.

O mapa é navegável e expansível:
1. Usuário pesquisa Jung e seleciona seu ponto.
2. Expande conexões de um salto.
3. Seleciona gnosticismo e abre outras conexões.
4. Clica em um fio para ler afirmação, contexto e evidências.
5. Recolhe trechos, muda foco e salva um recorte.
6. Pode cadastrar/editar manualmente, consultar importações feitas via chat/MCP e resolver pendências.

O frontend não decide a verdade histórica nem classifica automaticamente uma conexão como comprovada. Mostra as classificações e fontes retornadas pela API.

## 3. Stack e estrutura independente

- React, TypeScript estrito, Vite, Cytoscape.js.
- Node.js LTS 24+ para desenvolvimento/build, major/patch suportados fixados.
- npm e lockfile próprios; sem workspace compartilhado entre repos.
- React Router para rotas; cliente HTTP tipado; TanStack Query para cache/estado de requests, se compatível com versões escolhidas.
- Estado do grafo local em hooks/reducer simples; não adicionar gerenciadores globais sem necessidade.
- Vitest/Testing Library para lógica/UI; Playwright para testes de fluxo.
- Versões exatas escolhidas após checar documentação/compatibilidade; não copiar snippets antigos sem verificar.

~~~text
src/{app,api,auth,config,graph,components,pages}
src/api/{generated,client.ts}
src/graph/{adapter,layout,visibility,styles}
contracts/{openapi.json,source.json}
public/
infra/{docker,cloudfront}/
docs/{decisions.md,api-contract.md,auth.md,deploy.md}
tests/{unit,integration,e2e}
~~~

Pipeline próprio: npm ci → typecheck → testes → build → imagem estática ou artefato dist. Nenhum deploy automático da API. Não criar terceiro repo de contratos.

## 4. Variáveis de ambiente no build — requisito obrigatório

.env.example contém valores de exemplo públicos:

~~~dotenv
VITE_API_BASE_URL=https://api.example.com
VITE_OIDC_ISSUER=https://identity.example.com/
VITE_OIDC_CLIENT_ID=public-spa-client-id
VITE_OIDC_AUDIENCE=https://api.example.com
~~~

VITE_API_BASE_URL é a origem/base pública da API SEM /api/v1. Cliente acrescenta /api/v1 exatamente uma vez. Neste MVP, a API é publicada na raiz do host. Validar:
- URL absoluta http/https; HTTPS obrigatória em produção.
- HTTP apenas localhost/127.0.0.1 em desenvolvimento.
- Sem credenciais embutidas, query, fragmento ou caminho não raiz.
- Normalizar barra final.
- Valor ausente/inválido faz build falhar claramente; não gerar bundle quebrado e não assumir localhost em produção.

Config central em src/config/env.ts lê import.meta.env e é tipada; validação equivalente executa antes/durante vite build usando o mesmo contrato de configuração. Variáveis do provedor são públicas e também validadas para builds reais autenticados.

Exemplo de build (configurar também variáveis OIDC):
~~~bash
VITE_API_BASE_URL=https://api.example.com npm run build
~~~

Docker multi-stage recebe essas configurações públicas via build args, disponibiliza-as no estágio de build e executa npm run build. O estágio final só copia dist para servidor estático não root. docker compose deve passar build.args, não apenas environment de runtime.

Alterar URL da API exige novo build e deploy. Essa é a decisão do usuário. O mesmo dist pode rodar em Docker ou S3 quando suas configurações públicas forem iguais.

Todos os VITE_* são públicos no bundle: nunca usar senha, token, client_secret, DATABASE_URL, credencial de CI ou chave AWS. .env local ignorado no git; .env.example versionado. SDK obtém access token em runtime após login; token não vem de env.

Não criar /config.json de runtime ou proxy obrigatório /api para contornar essa regra. Cliente chama a URL absoluta configurada; integração local também exercita cross-origin.

## 5. Autenticação e requests

OAuth/OIDC Authorization Code + PKCE com SDK oficial do provedor. Auth0 é proposta, não conta já configurada; alinhar issuer/audience/client ID com a API. Não implementar servidor de identidade próprio nem guardar senhas.

- Cliente SPA público, sem client_secret.
- Access token em memória; não gravar tokens em localStorage nem enviar ID token como autorização.
- Requisições usam Authorization: Bearer <access_token>.
- Backend valida token/scopes e autoriza somente proprietário. Route guard é UX, não proteção de dados.
- GET /api/v1/me confirma acesso; usuário autenticado mas não autorizado vê estado 403.
- Scopes combinados com API: idea-sonar:read, idea-sonar:write, idea-sonar:undo.
- 401: SDK tenta renovação uma vez; se falhar, pedir login. Não criar loop.
- 403: não repetir login infinitamente; mostrar acesso negado.
- Logout limpa cache de requests, dados privados em memória e estado de navegação.
- Callback/login/logout URLs precisam ser registradas para domínio Docker inicial e domínio CloudFront/customizado futuro.

Cliente HTTP centralizado:
1. Monta base configurada + /api/v1 + caminho.
2. Injeta access token, Content-Type apenas quando houver corpo, request ID e AbortSignal/timeout.
3. Trata erro estruturado, status e falhas de rede.
4. Para POST de criação, gera Idempotency-Key por ação e reutiliza a mesma chave em retry.
5. PATCH usa If-Match de versão/ETag; em conflito 409 recarrega e informa diferença, sem sobrescrever silenciosamente.
6. Não repetir mutação com nova chave após timeout.
7. Tratar 429 com indicação de espera e retry limitado.
8. Não logar tokens nem conteúdo privado.

Backend permite origens específicas por CORS, headers Authorization/Content-Type/Idempotency-Key/If-Match e expõe ETag/X-Request-Id. Se bloquear, informar necessidade de configurar API; não desativar segurança do navegador. Não encaminhar token da API para links externos.

## 6. Contrato entre repositórios

Fonte oficial: contracts/openapi.json de guihmartins/idea-sonar-api, versão identificada por commit/tag e info.version.

Fluxo:
1. Obter snapshot de versão explícita por checkout autorizado ou artefato da API.
2. Salvar em contracts/openapi.json e origem/commit/checksum em contracts/source.json.
3. Gerar tipos/clientes em src/api/generated usando gerador compatível com a spec.
4. Não editar gerados manualmente. Script e CI verificam diferença após geração.
5. Atualizações de contrato entram por commit/PR próprio do web. Build normal não baixa latest nem depende de acesso ao repo backend.
6. Credencial para obter contrato privado é de desenvolvimento/CI; jamais no bundle.
7. Schema pode acompanhar repo público apenas com endpoints/DTOs e exemplos sintéticos, sem dados pessoais, hosts internos ou segredos.

Se API ainda não publicar contrato, implementar UI com fixtures explicitamente fictícias e adapter HTTP temporário, registrar dependência e alinhar assim que contrato estiver disponível. Não inventar endpoints e declarar integração concluída. Mocks são apenas dev/test; produção sempre usa API real e não tem fallback para fixtures.

Rotas esperadas sob /api/v1:

| Operação | Endpoint |
|---|---|
| Identidade | GET /me |
| Catálogos | GET /catalog |
| Busca | GET /nodes?q=&kind=&cursor=&limit= |
| Detalhes do ponto | GET /nodes/:id |
| Expansão | GET /nodes/:id/neighbors |
| Detalhes do fio | GET /relations/:id |
| Cadastro/edição | POST /nodes, /relations, /sources; PATCH respectivas /:id |
| Contextos | GET/POST /contexts; GET/PATCH /contexts/:id |
| Fontes | GET /sources e /sources/:id |
| Histórico de entidades | GET /nodes/:id/history e /relations/:id/history |
| Importações | GET /imports e /imports/:id |
| Desfazer lote | POST /imports/:id/undo |
| Pendências | GET /pending; POST /pending/:id/resolve |
| Views | GET/POST /views; GET/PATCH /views/:id |
| Exportação | GET /export |

API também possui POST /imports para ingestão via chat/MCP; web não implementa servidor MCP nem classificador. Não precisa criar editor de JSON de lotes no MVP.

Formatos de referência, que devem ser confirmados na OpenAPI:
- NodeDetail: id, kind, label, description, aliases, conceptScope, contexts, status, version, degreeTotal.
- NeighborPage: nodes[], relations[], nextCursor, truncated.
- RelationDetail: id, sourceId, targetId, type, claim, justification, context, evidenceStatus, intensity, intensityReason, attribution, contested, evidence[], version.
- Erro: {error:{code,message,details,requestId}}.
- Entidades usam UUID; timestamps ISO 8601; períodos históricos têm convenção abaixo.
- Paginação padrão 50, máximo 200. Cursor pertence à combinação de filtros; descartá-lo ao mudar filtro.

## 7. Semântica que a interface precisa preservar

Tipos de pontos:
- person: pessoa/autor histórico.
- tradition: tradição/corrente.
- concept: conceito amplo ou interpretação contextualizada.
- work: obra/texto/documento.

Conceito contextualizado continua concept e pode apontar por contextualizes para conceito amplo. Tradição, região e período são contexto, não prova automática de influência.

Predicados iniciais: influenced, formulated, developed, studied, used, adhered_to, transmitted, reinterpreted, incorporated_from, criticized, part_of, type_of, contextualizes, appears_in, parallel_to, differs_from.

Usar catálogo da API para labels, inversas e compatibilidades. Não duplicar influenced como nova relação “foi influenciado por”: essa é leitura inversa. parallel_to/differs_from são simétricas. incorporated_from parte de quem incorporou e aponta para a fonte. Múltiplas relações entre mesmo par precisam aparecer individualmente, inclusive períodos/atribuições diferentes.

Evidência:
- documented: documentada.
- attributed_interpretation: interpretação atribuída a uma fonte.
- inference: inferência/hipótese identificada.

Primária/secundária descreve fonte relativa à afirmação, não nível universal de certeza. Exibir supports/challenges/contextualizes para evidências. Contested é marcador separado. Pending é estado editorial, não sinônimo de inferência.

Intensidade 1 pontual, 2 relevante, 3 central; null não avaliada. Mostrar justificativa. Não inventar percentuais ou classificar autores por posição geométrica.

Períodos históricos usam anos astronômicos no contrato: 0 = 1 a.C., -1 = 2 a.C.; converter explicitamente no formulário/visualização. Preservar approximate/range/unknown; filtro deve permitir período desconhecido.

## 8. Grafo navegável e visual

Layout da tela: busca/filtros, grafo central, painel de detalhes e legenda acessível. Desktop com painel lateral; telas pequenas com painel recolhível e modo lista equivalente. Interface PT-BR.

| Recurso | Significado |
|---|---|
| Círculo | person |
| Hexágono | tradition |
| Losango | concept |
| Retângulo | work |
| Cor | Tema/contexto, com legenda; sem contexto = neutro |
| Tamanho | degreeTotal da API, com mínimo/máximo |
| Linha contínua | documented |
| Linha tracejada | attributed_interpretation |
| Linha pontilhada | inference |
| Espessura | Intensidade, com estilo neutro para null |
| Seta | Direção; ausente nas relações simétricas |
| Badge | Contestação/pendência quando exibida |

Cor não é único sinal; labels/tooltips e painel explicam. Múltiplos contextos aparecem em badges, não como filiação exclusiva. Até o catálogo estar carregado, não gerar classificações locais definitivas.

Interações:
- Selecionar ponto destaca vizinhos e abre detalhes.
- Expandir consulta um salto; não carregar grafo inteiro.
- Paginar expansões sem perder filtro e sem inserir arestas sem endpoints.
- Clicar no fio abre afirmação completa e evidências, incluindo fontes/trechos/localizadores.
- Centralizar muda foco; manter histórico simples voltar/avançar.
- Recolher remove somente elementos exclusivos daquela expansão; nós compartilhados permanecem.
- Manter ledger de expansões/raízes e derivar conjunto visível; não apagar todos os descendentes ingenuamente.
- Cancelar ou ignorar respostas antigas após mudança de foco/filtros.
- Fixar posições ao arrastar; expansão não embaralha nós fixados.
- Layout automático é ajuda visual, não distância histórica exata.
- Salvar view: raiz, filtros, expandedNodes, posições, viewport e nome; restauração busca dados atuais, tolerando nós arquivados/ausentes.
- Pendentes ocultos por padrão, com filtro explícito.
- Limite inicial 500 pontos no recorte; informar limite e sugerir recolher/filtrar, sem falhar silenciosamente.
- Evitar rótulos sobrepostos; realçar rótulos no foco e diferenciar arestas paralelas.
- Acesso por teclado, foco visível, bom contraste e modo lista para relações.

## 9. Telas e edição

Entregar:
1. Login/callback/acesso negado.
2. Explorar mapa e busca.
3. Painel de ponto/relacionamento e fontes.
4. Formulários de pontos, relações, fontes e contextos.
5. Lista de importações com itens criados/atualizados/reutilizados/pendentes.
6. Pendências com motivos e resolução.
7. Histórico de entidade.
8. Views salvas e exportação.

Formulários usam tipos/catálogos da API. Validação local ajuda UX, mas API é autoridade. Fonte obrigatória para documented/attributed_interpretation; inferência exige autoria e justificativa. Não promover estado automaticamente ao adicionar URL.

Reutilizar IDs de busca; homônimos exibem candidatos. Duplicatas/conflitos abrem resolução, não merge silencioso. Arquivar usa API e pode retornar dependências. Recolher só muda visualização.

Desfazer importação é ação explícita no painel. Explicar alcance e conflitos retornados; backend decide transação. Não simular undo só removendo nós no browser.

Estados loading, empty, error e retry em todas as telas de dados. Renderizar descrições/trechos como texto ou Markdown sanitizado. Links externos não recebem token; validar esquemas e proteção de nova aba. Dados privados não entram no bundle ou fixtures de produção.

## 10. Docker agora, S3/CloudFront depois

Docker:
- Build Node LTS 24+, npm ci, validação de env, geração do cliente a partir de snapshot local, npm run build.
- Build args públicos repassam VITE_API_BASE_URL e configuração OIDC.
- Runtime servidor estático não root com dist; não Node API nem vite dev server.
- Fallback SPA só em rotas de página; assets inexistentes retornam erro, não index.html.
- Compose deste repo sobe somente web, sem Postgres/backend. URL real da API entra no build.
- Deep links /map, /imports/:id e callback precisam recarregar corretamente.

S3/CloudFront:
- Mesmo dist estático; S3 privado, CloudFront HTTPS com Origin Access Control.
- Usar origem S3 REST com OAC, não website endpoint.
- Rewrite de rotas SPA conhecidas sem mascarar erros de assets.
- Assets com hash têm cache longo/immutable; index.html com cache curto/revalidação.
- Deploy publica assets antes de index, preservando versões anteriores por janela suficiente e invalidando index quando necessário.
- API permanece externa na URL do build. Mudança de URL exige rebuild.
- Registrar novos callbacks/origins OAuth/CORS antes de migrar domínio.
- Bucket privado não substitui autenticação de dados. O bundle pode ser baixado publicamente; a API exige login.
- Credenciais AWS são apenas de CI/administração, nunca VITE_*.
- Não provisionar infraestrutura AWS sem acesso/autorização; entregar runbook e artefato pronto.

## 11. Testes e aceite

- Build falha sem API base URL ou com URL inválida; HTTPS em produção.
- Build com URL de teste produz requests para ela, sem hardcoded localhost ou /api na origem do site.
- Requests autenticados usam access token; logout limpa cache; 401 limitado; 403 correto.
- Idempotency-Key preservada em retry; conflito If-Match não sobrescreve edição.
- Grafo: expandir/paginar/recolher mantém nó compartilhado; filtros descartam cursor antigo; resposta tardia não contamina recorte.
- Relações paralelas, simétricas, contexto, inferência e contestação têm representação correta.
- Posições fixadas e views persistem via API, sem confundir armazenamento com layout global.
- Componentes/testes usam fixtures sintéticas; testes de contrato seguem snapshot OpenAPI.
- E2E: login, buscar Jung, expandir gnosticismo, abrir evidência, salvar/restaurar view e resolver pendência em ambiente de teste.
- Se seed/API não estiverem disponíveis, rodar teste com mock isolado e registrar smoke real pendente.
- Container estático e dist fora do dev server funcionam em deep link.
- Não há segredos, banco, MCP server, código de backend ou mocks habilitados em build de produção.
- Layout utilizável em desktop e celular; modo lista/teclado.
- npm ci, typecheck, testes críticos e build aprovados.

## 12. Checklist

- [x] Inspecionar repo, fixar versões e registrar decisões.
- [x] Configuração de build e VITE_API_BASE_URL com validação.
- [ ] Importar contrato oficial versionado e reconciliar cliente (pipeline de geração pronto; OpenAPI da API ainda indisponível).
- [x] Autenticação e requests HTTP.
- [x] Busca, navegação, expansão/recolhimento e painel.
- [x] Legenda, filtros, contextos e evidências.
- [x] Formulários e conflitos de versão.
- [x] Importações, pendências, histórico e views.
- [ ] Smoke real quando API/provedor disponíveis (testes locais, E2E fictício, acessibilidade automatizada e Docker implementados).
- [x] Docker independente e runbook S3/CloudFront.

## 13. Entregáveis e referências

README com instalação, env de build, autenticação, sincronização do contrato, comandos de testes/build, Docker e deploy estático. Documentar dependências externas reais sem alegar que foram configuradas.

- https://vite.dev/guide/env-and-mode
- https://js.cytoscape.org/
- https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html

## 14. Prompt inicial

> Leia PLAN.md e as instruções do repositório. Implemente exclusivamente idea-sonar-web: React, TypeScript, Vite e Cytoscape.js. Consuma a API externa autenticada usando VITE_API_BASE_URL obrigatória no build. Gere o cliente a partir de uma versão fixa da OpenAPI. Entregue navegação, edição, evidências, testes e Docker estático preparado para S3/CloudFront. Não crie backend, MCP, banco ou migrations e não altere o outro repo.
