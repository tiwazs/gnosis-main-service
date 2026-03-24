# Build step
FROM node as builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build

# Production step
FROM node:slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production --quiet
RUN apt-get update && \
    apt-get install -y wget && \
    wget http://security.debian.org/debian-security/pool/updates/main/o/openssl1.1/libssl1.1_1.1.1n-0+deb10u5_amd64.deb && \
    dpkg -i libssl1.1_1.1.1n-0+deb10u5_amd64.deb || true

COPY --from=builder /app/prisma ./prisma
# Generate Prisma Client
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/dataModels ./dataModels
COPY --from=builder /app/controllers ./controllers
RUN mkdir /app/dist/tmp

EXPOSE 3000

CMD ["npm", "run", "start:migrate:prod"]
