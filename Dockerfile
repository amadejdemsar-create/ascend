FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Stage 1: Install all dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/storage/package.json ./packages/storage/
COPY packages/ui-tokens/package.json ./packages/ui-tokens/
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# Each workspace package has its own node_modules under strict pnpm mode;
# Turbopack resolves imports per-file, so `zod` must be available under
# each package that imports it (e.g. packages/core resolves zod from
# packages/core/node_modules before falling back up the tree).
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/api-client/node_modules ./packages/api-client/node_modules
COPY --from=deps /app/packages/storage/node_modules ./packages/storage/node_modules
COPY --from=deps /app/packages/ui-tokens/node_modules ./packages/ui-tokens/node_modules
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# auth-service.ts has a module-init guard that throws if AUTH_JWT_SECRET is
# missing or <32 chars. Next.js App Router's `Collecting page data` phase
# evaluates route modules' top-level code, which triggers the guard at
# build time. Inject a build-only placeholder so the build succeeds;
# Dokploy's runtime AUTH_JWT_SECRET takes precedence when the container
# starts (this env is not copied into the runner stage).
ENV AUTH_JWT_SECRET="build-time-placeholder-not-used-at-runtime-min-32-chars"
ARG NEXT_PUBLIC_API_KEY
ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
RUN pnpm --filter @ascend/web exec prisma generate
RUN pnpm --filter @ascend/web build

# Stage 3: Install production-only dependencies (for prisma CLI at runtime)
FROM base AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/storage/package.json ./packages/storage/
COPY packages/ui-tokens/package.json ./packages/ui-tokens/
RUN pnpm install --frozen-lockfile --prod

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy production node_modules (includes prisma CLI with full dependency tree)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy standalone output (preserves monorepo structure: server.js at apps/web/server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy Prisma artifacts for runtime migrations
COPY --from=builder /app/apps/web/generated ./apps/web/generated
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/prisma.config.ts ./apps/web/prisma.config.ts

# Copy operational scripts + the lib/ directory they need at runtime.
# scripts/set-password.ts is tsx-run from Dokploy container exec to seed
# or reset the primary user's password. It imports from ../lib/services/
# auth-service + user-service; those only depend on generated/prisma,
# jose (in apps/web/node_modules), and Node crypto. No @ascend/core needed
# in this path. The Next.js standalone bundle covers everything else.
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder /app/apps/web/lib ./apps/web/lib

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Boot order:
#   1. Apply any pending Prisma migrations via `migrate deploy` (safe: no
#      --create-only, no diff against introspected schema, so the
#      ContextEntry.search_vector tsvector column is preserved).
#   2. Start the Next.js standalone server.
#
# prisma/seed.ts is NOT run at container start. That seed creates a
# hardcoded dev user and writes API_KEY into the user row; it is a
# dev-only bootstrap. Production users are seeded on first deploy and
# then managed via the app + scripts/set-password.ts. Running it every
# container start was the cause of the 2026-04-24 crash-loop: the seed
# imports @ascend/core via lib/constants.ts, but @ascend/core is not
# available in the runner stage (Next.js standalone bundles server.js
# but tsx-run scripts resolve modules at runtime and cannot find it).
CMD ["sh", "-c", "cd apps/web && if [ -d prisma/migrations ]; then ./node_modules/.bin/prisma migrate deploy; fi && node server.js"]
