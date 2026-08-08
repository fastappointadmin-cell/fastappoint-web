# ── Stage 1: build Angular ────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# ── Stage 2: nginx to serve static files + proxy to backend ───────────────────
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy Angular build output
COPY --from=builder /app/dist/fastappoint-web/browser /usr/share/nginx/html

# Copy nginx template (BACKEND_URL substituted at container start)
COPY nginx.conf.template /etc/nginx/conf.d/nginx.conf.template

# Entrypoint: substitute env vars into nginx config, then start nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

CMD ["/docker-entrypoint.sh"]
