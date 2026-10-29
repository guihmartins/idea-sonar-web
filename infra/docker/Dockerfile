# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS build
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm install -g npm@11.9.0; else npm install -g npm@11.9.0; fi
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# CA opcional: necessária somente em ambientes com proxy corporativo/sessão.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci; else npm ci; fi
COPY . .
ARG VITE_AUTH_MODE=none
ARG VITE_API_BASE_URL
ARG VITE_OIDC_ISSUER
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_AUDIENCE
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_OIDC_ISSUER=$VITE_OIDC_ISSUER \
    VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID \
    VITE_OIDC_AUDIENCE=$VITE_OIDC_AUDIENCE
RUN npm run build
FROM nginxinc/nginx-unprivileged:1.29.1-alpine AS runtime
COPY --chown=101:101 --chmod=644 infra/docker/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
