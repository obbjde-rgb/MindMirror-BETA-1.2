# ==========================================
# RMX Live MindMirror V2Ag — Production Dockerfile
# Optimized Multi-Stage Build for High Performance & PWA Reliability
# ==========================================

# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy full application source code
COPY . .

# Generate PWA icons and build static client + production server bundle
RUN node scripts/generate-png-icons.js && npm run build

# Stage 2: Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment variables (Cloud Run defaults to PORT 8080)
ENV NODE_ENV=production
ENV PORT=8080

# Install runtime dependencies for healthchecks
RUN apk add --no-cache curl

# Create non-root system user for security compliance
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mindmirror

# Copy built server, public assets, configuration, and distribution from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/index.html ./index.html

# Change ownership to non-root user
RUN chown -R mindmirror:nodejs /app

USER mindmirror

# Expose standard Cloud Run port (8080) and fallback port (3000)
EXPOSE 8080 3000

# High-fidelity healthcheck probing the health API on dynamic $PORT
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-8080}/api/health || exit 1

# Start production server
CMD ["node", "server.ts"]
