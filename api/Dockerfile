# roda igual no Railway e numa VPS (docker build -t prisma-api ./api)
FROM node:24-bookworm-slim AS build
WORKDIR /app
# o motor de migracao do prisma precisa do openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# schema e config antes do npm ci: o postinstall gera o client
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && npx prisma --version

FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
