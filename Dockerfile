# Build on amd64 because the workspace lock intentionally excludes some ARM
# optional compiler binaries. The resulting JS/CSS assets are architecture
# independent; the API and web runtime stages use the requested target platform.
FROM --platform=linux/amd64 node:24-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
RUN PORT=8080 BASE_PATH=/ pnpm --filter @workspace/zetas run build
RUN mkdir -p artifacts/api-server/dist/migrations \
  && cp -a lib/db/migrations/. artifacts/api-server/dist/migrations/

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production \
    PORT=8080 \
    TRUST_PROXY_HOPS=1
WORKDIR /app
COPY --from=build /workspace/artifacts/api-server/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=4s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

FROM nginx:1.27-alpine AS web
COPY --from=build /workspace/artifacts/zetas/dist/public/ /usr/share/nginx/html/
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
