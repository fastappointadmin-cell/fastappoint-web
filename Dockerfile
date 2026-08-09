# ── Stage 1: build Angular (SSR + prerender) ───────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# ── Stage 2: run the Angular SSR Node server ───────────────────────────────────
# Replaces nginx: the server (src/server.ts) serves the prerendered/SSR pages, serves the built static
# assets itself, and proxies /api, /oauth2, /login/oauth2, /ws straight to BACKEND_URL -- everything
# nginx used to do in front of the plain static build.
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/fastappoint-web ./dist/fastappoint-web

EXPOSE 8080

CMD ["node", "dist/fastappoint-web/server/server.mjs"]
