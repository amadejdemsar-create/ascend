FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Stage 1: Install all dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
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

# Copy lib files needed by seed script at runtime
COPY --from=builder /app/apps/web/lib/constants.ts ./apps/web/lib/constants.ts

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "cd apps/web && if [ -d prisma/migrations ]; then ./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/tsx prisma/seed.ts; fi && node server.js"]
