# syntax=docker/dockerfile:1

# --- build ---
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Generate Prisma client for the build host architecture (amd64 or arm64)
RUN npx prisma generate
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/data/grc.db"
ENV UPLOAD_DIR=/data/uploads/projects

# Install runtime deps and apply available security updates (Trivy ignore-unfixed).
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/uploads/projects

COPY package.json package-lock.json ./
# Drop npm cache after install so Trivy/secret scans don't hit huge /root/.npm/_cacache blobs
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY server ./server
COPY tsconfig.json ./

# Ensure Prisma client matches runtime platform; purge npx/npm cache again
RUN npx prisma generate \
  && npm cache clean --force \
  && rm -rf /root/.npm /tmp/*

EXPOSE 3001

VOLUME ["/data"]

# Run as non-root (node user from the official image) for container hardening.
RUN chown -R node:node /app /data
USER node

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server/index.ts"]
