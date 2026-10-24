# Deploy estático independente

## Docker

`infra/docker/Dockerfile`: Node 24.19.0 + npm 11.9.0 fixados, npm ci, verificação local de contrato e build com env pública. Runtime `nginxinc/nginx-unprivileged:1.29.1-alpine`, usuário 101:101, somente dist e configuração de servidor estático. Sem backend, banco, servidor MCP ou Vite em runtime. Compose passa os quatro valores via `build.args`, usa filesystem read-only, tmpfs /tmp e remove capabilities.

```sh
docker compose up --build -d
```

A `.env` local pode alimentar os args públicos; nunca é copiada para a imagem. Alterar API/OIDC exige rebuild. Valores inseridos em environment de runtime não alteram o bundle. Em ambientes com proxy e CA própria, build com `--secret id=proxy_ca,src=/caminho/ca.pem`; os passos npm usam a CA montada sem copiá-la às layers/final.

Servidor: rotas conhecidas `/map`, `/imports/:id`, callback, formulários e histórico recarregam index; arquivos/rotas inexistentes retornam 404. Assets hash recebem cache immutable de um ano; index recebe no-cache. Não existe proxy obrigatório /api. API externa recebe requests cross-origin.

`sh scripts/smoke-container.sh [imagem]` sobe container temporário em porta local aleatória, verifica deep links, assets faltantes e usuário não root e remove o container. A imagem foi construída e o smoke executado sem backend.

Produção deve servir frontend por HTTPS, registrar callbacks/origens de Auth0 e permitir CORS na API. Configuração do provedor e smoke real continuam pendentes. Para exigir contrato publicado no pipeline de release, execute também `REQUIRE_API_CONTRACT=true npm run build` antes de produzir a imagem.

## S3 + CloudFront (runbook; sem provisionamento nesta sessão)

1. Gerar o mesmo dist com URLs HTTPS definitivas. Nenhuma credencial AWS em VITE_*. Usar credenciais de CI/administração.
2. Bucket S3 privado com Block Public Access. Origem CloudFront deve ser endpoint S3 REST, **não website endpoint**. Criar OAC e bucket policy limitada à distribuição.
3. Configurar certificado/domínio e redirect HTTP → HTTPS. Default root object index.html.
4. Associar `infra/cloudfront/rewrite.js` como CloudFront Function viewer-request no comportamento padrão. Ela reescreve apenas rotas SPA conhecidas para /index.html; não converte erros globais 403/404 em index. `/assets/*` deve manter seu comportamento de cache próprio.
5. Assets hash: `Cache-Control: public,max-age=31536000,immutable`. Index: `no-cache` com revalidação/TTL curto (não usar política com MinTTL positivo que ignore no-cache). Configurar content types corretos.
6. Publicar assets antes do index. Preservar versões antigas de assets por janela suficiente; não usar `sync --delete` que quebre abas antigas. Publicar index por último e invalidar `/index.html` e `/` quando necessário. Rollback repõe index anterior e mantém assets correspondentes.
7. Registrar callbacks/login/logout e web origins do novo domínio no provedor; atualizar allowlist CORS da API antes da migração. API permanece no host externo configurado no build.
8. Smoke: deep links/map/import/callback, 404 de assets, cache, HTTPS e login/401/403/logout reais. Bucket privado protege a origem, não substitui autorização de dados na API. O bundle pode ser baixado publicamente.

Não há bucket, distribuição, domínio ou credenciais criados/configurados nesta sessão.
