# Autenticação — próximo marco

Não há login implementado ou conta de provedor configurada neste marco. As rotas `/login`, `/callback` e `/access-denied` reservam a navegação; não processam tokens ou códigos.

Alinhar issuer, audience, client ID e scopes com a API antes da integração. Auth0 é proposta do plano, não decisão sobre conta existente. Usar SDK oficial com Authorization Code + PKCE, SPA pública e access token em memória. Nunca enviar ID token como Bearer, persistir token em localStorage ou incluir client secret no build.

Registrar URLs de callback/login/logout e origens para os domínios usados. Próximo aceite: `/me`, 401 com uma renovação no máximo, 403 explícito e logout limpando cache, dados privados e navegação. Route guard é UX; autorização pertence à API.
