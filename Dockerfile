# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install su-exec for switching users in entrypoint
RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Extra runtime files for batch script (pg is pure JS, no native binaries needed)
COPY --from=builder /app/scripts ./scripts
COPY --from=deps /app/node_modules/slugify ./node_modules/slugify
COPY --from=deps /app/node_modules/pg ./node_modules/pg
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/package.json ./package.json

# Copy Drizzle schema for runtime access
COPY --from=builder /app/src/db ./src/db

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Healthcheck for Railway monitoring
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/ticker', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

USER nextjs

# Use entrypoint to fix permissions, then switch to nextjs user
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
