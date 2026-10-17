# ==========================================
# Mind Clash Production Multi-Stage Dockerfile
# ==========================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package and workspace package definitions
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy full source code
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY tsconfig.json ./

# Build shared library, Vite client bundle, and TypeScript server
RUN npm run build

# Remove development dependencies to keep final bundle lean
RUN npm prune --production

# ==========================================
# Stage 2: Production Runner Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Run as non-root user for container security
USER node

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/shared/package*.json ./shared/
COPY --chown=node:node --from=builder /app/shared/dist ./shared/dist
COPY --chown=node:node --from=builder /app/server/package*.json ./server/
COPY --chown=node:node --from=builder /app/server/dist ./server/dist
COPY --chown=node:node --from=builder /app/client/package*.json ./client/
COPY --chown=node:node --from=builder /app/client/dist ./client/dist

# Expose default port (Render & Railway inject their own $PORT)
EXPOSE 3001

# Healthcheck probe using Node built-in fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the unified Express + Socket.IO server
CMD ["node", "server/dist/index.js"]
