# Autenticação

## Modo atual (25/10/2026)

Por pedido explícito do usuário: autenticação temporariamente desativada, `VITE_AUTH_MODE=none` por padrão (incluindo ausência da variável). Nenhuma sessão fictícia é criada. As telas abrem sem `/me`, SDK ou redirecionamento; requests reais omitem Authorization e cookies. 401 não renova nem oferece login neste modo: informa que a API exige autenticação. Nenhum fallback para fixtures; autorização no backend não foi alterada.

Para reativar o fluxo abaixo, fazer novo build com `VITE_AUTH_MODE=oidc` e VITE_OIDC_ISSUER/CLIENT_ID/AUDIENCE válidos. Modo desconhecido falha no build; no modo oidc a validação e o guard continuam obrigatórios. Somente a URL da API é obrigatória em none.

## Fluxo OIDC preservado (opcional)

Adapter implementado com SDK oficial `@auth0/auth0-spa-js` 2.29.0. Auth0 é a escolha inicial do frontend; nenhuma conta/provedor foi criado ou configurado nesta sessão. Se a API escolher outro provedor, substituir `Session` por seu SDK oficial, mantendo o transporte e o ciclo de limpeza.

- Authorization Code + PKCE realizado pelo SDK; SPA pública, sem client_secret.
- `cacheLocation: memory`; sem tokens em localStorage/sessionStorage. Estado transitório do protocolo é responsabilidade do SDK.
- Access token obtido por `getTokenSilently`, audience da API e scopes `openid profile idea-sonar:read idea-sonar:write idea-sonar:undo`. ID token não é usado como Bearer.
- `/callback` valida/processa callback via SDK e remove código da URL por navegação substitutiva. Processamento é compartilhado para tolerar efeitos duplicados de React StrictMode.
- `/me` confirma autorização antes de montar telas privadas. 403 mostra acesso negado; 401 pede login, com uma renovação máxima por request no transporte. Erros não disparam redirecionamentos em loop.
- Logout desmonta as telas privadas, cancela queries, limpa cache e navegação local e encerra sessão no SDK/provedor. Nenhum dado privado é persistido pelo frontend.

## Configuração externa necessária

Registrar aplicação SPA, issuer HTTPS, client ID público, audience e scopes alinhados à API. Registrar callbacks `<origem>/callback`, logout `<origem>/` e allowed web origins para domínio Docker inicial e domínio CloudFront/customizado futuro. O Docker é estático: HTTPS normalmente termina no proxy/ingress. CORS da API deve permitir a origem exata do frontend.

Testes de SDK verificam configurações/callback; E2E dev/test usa sessão fictícia explicitamente marcada. Login/renovação/logout reais, consentimento e autorização real estão pendentes de provedor/API disponíveis. Guardas de rota são UX; a API precisa validar assinatura, audience, scopes e proprietário.
