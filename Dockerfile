# ==========================
# HireFlow AI Docker Config
# Multi-stage production build
# ==========================

# ---- Stage 1: Install all workspace deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/portal/package.json ./apps/portal/package.json
COPY apps/interview/package.json ./apps/interview/package.json
COPY server/package.json ./server/package.json
COPY packages/shared/i18n/package.json ./packages/shared/i18n/package.json
COPY packages/shared/types/package.json ./packages/shared/types/package.json
COPY packages/shared/utils/package.json ./packages/shared/utils/package.json
RUN npm ci --ignore-scripts
# Generate Prisma client
COPY server/prisma ./server/prisma
RUN npx --workspace @hireflow/server prisma generate --schema server/prisma/schema.prisma

# ---- Stage 2: Build everything ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules 2>/dev/null || true
COPY . .
# Build shared packages, then apps, then server
RUN npm run build

# ---- Stage 3: Production server image ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Only copy what's needed for production
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install production deps only
COPY --from=deps /app/node_modules ./node_modules

# Copy built frontend assets (served by Nginx or static hosting, not this container)
# If serving from this container, uncomment:
# COPY --from=builder /app/apps/portal/dist ./public/portal
# COPY --from=builder /app/apps/interview/dist ./public/interview

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Run Prisma migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
