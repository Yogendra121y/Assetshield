# ── Build Stage ───────────────────────────────────────────────────────────────
FROM node:20-slim AS base

# Install sharp dependencies
RUN apt-get update && apt-get install -y \
    python3 make g++ libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# ── Production Stage ──────────────────────────────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y libvips && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=base /app .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
