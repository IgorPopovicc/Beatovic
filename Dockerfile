FROM node:20.19-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app

ARG API_BASE_URL=https://euroleague-tiebreaker.com/planetabih-webservice/api
ARG MEDIA_PRODUCT_BASE_URL=https://euroleague-tiebreaker.com/media/product/
ARG SITE_URL=https://euroleague-tiebreaker.com

COPY . .

RUN API_BASE_URL="$API_BASE_URL" \
    MEDIA_PRODUCT_BASE_URL="$MEDIA_PRODUCT_BASE_URL" \
    SITE_URL="$SITE_URL" \
    node -e "const fs=require('node:fs');const p='src/environments/environment.prod.ts';let t=fs.readFileSync(p,'utf8');const repl=(k,v)=>{const esc=v.replace(/\\/g,'\\\\').replace(/'/g,\"\\\\'\");t=t.replace(new RegExp(k+\":\\\\s*'[^']*'\"),k+\": '\"+esc+\"'\");};repl('apiBaseUrl',process.env.API_BASE_URL||'');repl('mediaProductBaseUrl',process.env.MEDIA_PRODUCT_BASE_URL||'');repl('siteUrl',process.env.SITE_URL||'');fs.writeFileSync(p,t);"

RUN npm run build:ssr

FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1

CMD ["node", "dist/Beatovic/server/server.mjs"]
