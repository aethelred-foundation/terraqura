# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.0.0 prune @terraqura/api --docker

FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable
ENV CI=1
ENV HUSKY=0
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ ./
RUN pnpm --filter @terraqura/types build
RUN pnpm --filter @terraqura/api build

FROM node:22-alpine AS production-dependencies
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable
ENV CI=1
ENV HUSKY=0
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN npm pkg delete scripts.prepare
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
RUN addgroup --system --gid 1001 terraqura \
  && adduser --system --uid 1001 --ingroup terraqura terraqura
COPY --from=production-dependencies --chown=terraqura:terraqura /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=terraqura:terraqura /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=terraqura:terraqura /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=terraqura:terraqura /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=terraqura:terraqura /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder --chown=terraqura:terraqura /app/packages/types/dist ./packages/types/dist
USER terraqura
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
