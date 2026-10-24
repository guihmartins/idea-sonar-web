# Deploy — planejado

O artefato atual é `dist`, gerado sem checkout do backend. `npm run preview` permite inspecioná-lo localmente; não é servidor de produção.

Docker será entregue em marco próprio: multi-stage Node 24 fixado, `npm ci`, env pública por build args e runtime estático não root. Compose subirá somente web. Fallback apenas para rotas de página conhecidas, assets inexistentes com 404. Não há container validado ou deploy realizado neste marco.

CloudFront futuro: S3 REST privado com OAC, HTTPS, rewrite de rotas conhecidas, assets com hash/immutable, index com revalidação. Publicar assets antes do index, preservar versões anteriores e invalidar index quando necessário. Registrar callbacks OIDC/origins CORS antes de mudar domínio. API continua externa; alterar URL exige novo build. Credenciais AWS somente em CI/administração. Nenhuma infraestrutura AWS foi provisionada.
