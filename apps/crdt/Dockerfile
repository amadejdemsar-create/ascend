# Hocuspocus CRDT server Dockerfile.
#
# Build context: REPO ROOT (Dokploy configured with buildPath=apps/crdt
# but the Dockerfile copies from repo root because workspace lockfile
# and workspace package.json files sit there).
#
# This image only installs @ascend/crdt dependencies. It does NOT
# install any other workspace package's dependencies (cross-app
# boundary rule).

# ── Base ──────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# ── Dependencies ─────────────────────────────────────────────────────

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/crdt/package.json ./apps/crdt/
RUN pnpm install --frozen-lockfile --filter @ascend/crdt

# ── Builder ──────────────────────────────────────────────────────────

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/crdt/node_modules ./apps/crdt/node_modules
COPY apps/crdt/ ./apps/crdt/
WORKDIR /app/apps/crdt
RUN pnpm build

# ── Runner ───────────────────────────────────────────────────────────

FROM node:22-alpine AS runner
WORKDIR /app/apps/crdt

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built output and production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/apps/crdt/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/apps/crdt/node_modules ./node_modules

USER nodejs

# Main WebSocket port
EXPOSE 1234
# Health check port
EXPOSE 1235

# Node-based healthcheck (wget is not in node:22-alpine; node is the runtime).
# Hits the health server on PORT+1 inside the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:1235/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
