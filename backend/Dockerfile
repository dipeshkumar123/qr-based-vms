# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine

# Install PostgreSQL client for migrations
RUN apk add --no-cache postgresql-client

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy migration & seed scripts
COPY db/ ./db/
COPY scripts/ ./scripts/

# Create uploads directory
RUN mkdir -p uploads && chown -R appuser:appgroup /app /app/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 4000

# Health check (ESM-compatible using dynamic import)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "import('http').then(h=>h.get('http://localhost:4000/health',r=>{process.exit(r.statusCode===200?0:1)}))"

# Start application
CMD ["node", "dist/index.js"]
