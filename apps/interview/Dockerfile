# ───────────────────────────────────────────────
# HireFlow Interview App — Multi-stage Build
# ───────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/interview/package.json apps/interview/
COPY packages/ packages/

RUN npm ci --workspace=apps/interview --include-workspace-root

COPY apps/interview/ apps/interview/
COPY packages/ packages/

RUN cd apps/interview && npm run build

# ── Stage 2: Serve with Nginx ────────────────
FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/interview/dist /usr/share/nginx/html

RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
listen 80;
root /usr/share/nginx/html;
index index.html;

gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml;
gzip_min_length 256;

location / {
try_files $uri $uri/ /index.html;
}

location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
expires 30d;
add_header Cache-Control "public, immutable";
}

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
