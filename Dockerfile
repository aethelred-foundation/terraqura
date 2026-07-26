# Production Dockerfile for TerraQura (Carbon Credit Marketplace)
# Turborepo monorepo build — builds the Next.js web app
# Requires apps/web/next.config.js to have: output: 'standalone'

# Stage 1: Prune the monorepo for the web app
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.0.0 prune @aethelred/terraqura-web --docker

# Stage 2: Install dependencies for the pruned workspace
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/out/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 3: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=@aethelred/terraqura-web

# Stage 4: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
