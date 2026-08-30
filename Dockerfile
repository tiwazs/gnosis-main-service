FROM node:18-bullseye-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY . .

RUN npm run build

FROM node:18-bullseye-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dataModels ./dataModels
COPY --from=builder /app/controllers ./controllers

RUN mkdir -p /app/dist/tmp

EXPOSE 4000

CMD ["npm", "run", "start:migrate:prod"]
