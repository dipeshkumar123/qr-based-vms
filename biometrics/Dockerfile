FROM python:3.11-slim

# Install build tools for dlib/face_recognition
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install only biometric service dependencies (trimmed)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the deployed service
COPY server.py /app/server.py

# Run as non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser && \
    mkdir -p /tmp/ii_vms_photos/encodings /tmp/ii_vms_photos/photos && \
    chown -R appuser:appgroup /app /tmp/ii_vms_photos
USER appuser

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
