# ==========================
# HireFlow AI Docker Config
# Multi-stage production build
# ==========================

# ---- Stage 1: Install deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ---- Stage 2: Build frontend ----
FROM node:20-alpine AS builder-frontend
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Stage 3: Production ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy built frontend
COPY --from=builder-frontend /app/dist ./dist

# Copy server source (we run with tsx in prod for simplicity; use tsc in real prod)
COPY server ./server
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000
EXPOSE 4000

# In production, serve the built frontend via the backend or a reverse proxy
CMD ["npx", "tsx", "server/index.ts"]
