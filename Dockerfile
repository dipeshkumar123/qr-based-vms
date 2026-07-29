# Render backend Dockerfile - references backend/ directory
# Build context: repository root
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci && npm cache clean --force

COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache postgresql-client

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY backend/db/ ./db/
COPY backend/scripts/ ./scripts/

RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "import('http').then(h=>h.get('http://localhost:4000/health',r=>{process.exit(r.statusCode===200?0:1)}))"

CMD ["node", "dist/index.js"]