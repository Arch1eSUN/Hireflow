# ───────────────────────────────────────────────
# HireFlow API — Multi-stage Production Build
# ───────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root + lockfile
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY packages/ packages/

# Install ALL deps (need devDeps for tsc)
RUN npm ci --workspace=server --include-workspace-root

# Copy source
COPY server/ server/
COPY packages/ packages/

# Generate Prisma client + Build
RUN cd server && npx prisma generate && npm run build

# ── Stage 2: Runtime ─────────────────────────
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini
WORKDIR /app

# Copy package files for prod install
COPY package.json package-lock.json ./
COPY server/package.json server/

# Production-only deps
RUN npm ci --workspace=server --include-workspace-root --omit=dev

# Copy built output + prisma
COPY --from=builder /app/server/dist server/dist
COPY --from=builder /app/server/node_modules/.prisma server/node_modules/.prisma
COPY server/prisma server/prisma

# Copy shared packages (types, utils, i18n)
COPY --from=builder /app/packages packages

ENV NODE_ENV=production
EXPOSE 3333

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/dist/index.js"]
