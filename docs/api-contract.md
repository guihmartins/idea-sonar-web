# Integração com API — pendente

O caminho oficial consultado em 24/10/2026 retornou 404. Veja `contracts/source.json`. Não há snapshot ou cliente gerado neste marco; os formatos de referência do plano não foram declarados oficiais. O build normal é offline em relação ao backend e não baixa `latest`.

Quando disponível: obter `contracts/openapi.json` em commit/tag explícito por leitura autorizada; revisar exemplos sintéticos e ausência de segredos; registrar commit completo, `info.version` e SHA-256; escolher gerador compatível; adicionar script determinístico e verificar regeneração na CI. Nunca editar gerados manualmente.

Até lá, interfaces de domínio e fixtures futuras serão temporárias e identificadas como fictícias, carregadas somente em dev/test. Produção não terá fallback. Não há mocks nesta fundação. A API deverá autorizar CORS para origens específicas, incluindo Authorization, Content-Type, Idempotency-Key e If-Match e expondo ETag/X-Request-Id.
