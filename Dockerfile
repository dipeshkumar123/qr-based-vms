# Single-container image running Postgres, Node backend, Python biometric service, and static frontend
FROM postgres:16-bookworm

# Set noninteractive for apt
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js 20, Python3, pip, Supervisor, build tools, and utilities
RUN apt-get update && \
    apt-get install -y curl gnupg ca-certificates && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs python3 python3-pip python3-venv supervisor git build-essential cmake nginx && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy repository files
COPY backend ./backend
COPY frontend ./frontend
COPY biometric-service ./biometric-service
COPY backend/db/schema.sql /docker-entrypoint-initdb.d/00-schema.sql
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/start-backend.sh /usr/local/bin/start-backend.sh

# Ensure scripts are executable
RUN chmod +x /usr/local/bin/start-backend.sh

# Install backend dependencies and build
WORKDIR /app/backend
RUN npm ci && npm run build

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm config set registry https://registry.npmjs.org && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci && npm run build && npm install -g serve

# Install biometric service dependencies using docker-specific requirements to avoid building dlib from source
WORKDIR /app/biometric-service
COPY biometric-service/requirements-docker.txt ./requirements-docker.txt
# Create virtualenv for biometric service to avoid system Python restrictions (PEP 668)
RUN python3 -m venv /opt/biometric-venv && \
    /opt/biometric-venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/biometric-venv/bin/pip install --no-cache-dir -r requirements-docker.txt

# Create upload directory for biometric service
RUN mkdir -p /app/biometric-service/uploads

# Expose service ports
EXPOSE 5432 4000 5000 5173

# Default environment variables (can be overridden at runtime)
ENV POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=ii_vms \
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ii_vms \
    CORS_ORIGIN=http://localhost:5173 \
    ADMIN_API_KEY=change-this-admin-key \
    ADMIN_JWT_SECRET=change-this-jwt-secret \
    ADMIN_JWT_EXPIRES_IN=2h \
    BIOMETRIC_SERVICE_URL=http://localhost:5000 \
    BIOMETRIC_API_KEY=biometric-service-secret-key \
    FACE_MATCH_THRESHOLD=0.6 \
    MIN_FACE_CONFIDENCE=0.8

# Use Supervisord to run multiple processes
CMD ["/usr/bin/supervisord", "-n"]
