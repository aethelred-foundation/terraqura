# syntax=docker/dockerfile:1
# TerraQura web (Next.js) — self-hosted container image.
# Replaces the previous Vercel deployment. Build from the monorepo root:
#   docker build -f apps/web/Dockerfile -t terraqura-web .
# Produces a minimal runtime from Next.js `output: "standalone"`.

# ---- deps: install workspace dependencies ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy manifests needed to resolve the pnpm workspace, then install.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# ---- builder: compile the web app + its workspace deps ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @terraqura/types build \
  && pnpm turbo build --filter=@aethelred/terraqura-web...

# ---- runner: minimal standalone server ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone output bundles a self-contained server + minimal deps.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
