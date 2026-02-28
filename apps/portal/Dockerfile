# ───────────────────────────────────────────────
# HireFlow Portal — Multi-stage Production Build
# ───────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root + lockfile
COPY package.json package-lock.json ./
COPY apps/portal/package.json apps/portal/
COPY packages/ packages/

# Install deps
RUN npm ci --workspace=apps/portal --include-workspace-root

# Copy source
COPY apps/portal/ apps/portal/
COPY packages/ packages/

# Build
RUN cd apps/portal && npm run build

# ── Stage 2: Serve with Nginx ────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Add SPA-friendly config
COPY --from=builder /app/apps/portal/dist /usr/share/nginx/html

RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
listen 80;
root /usr/share/nginx/html;
index index.html;

# gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 256;

# SPA fallback
location / {
try_files $uri $uri/ /index.html;
}

# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
expires 30d;
add_header Cache-Control "public, immutable";
}

# API proxy (adjust upstream as needed)
location /api/ {
proxy_pass http://server:3333;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
}
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
