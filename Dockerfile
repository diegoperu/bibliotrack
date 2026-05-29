# ──────────────────────────────────────────────────────────
# BiblioTrack — Dockerfile multi-stage
#
# Stage 1: build frontend React
# Stage 2: immagine finale Python + nginx
# Tutto in un singolo container (Unraid-friendly, no compose)
# ──────────────────────────────────────────────────────────

# ── STAGE 1: Frontend build ────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ ./
# Build con base URL /api (nginx proxy interno strip-prefix)
RUN VITE_API_URL=/api npm run build


# ── STAGE 2: Runtime ──────────────────────────────────────
FROM python:3.11-slim

LABEL maintainer="BiblioTrack"
LABEL description="BiblioTrack — Personal book library with ISBN scanner"
LABEL org.opencontainers.image.source="https://github.com/tuoutente/bibliotrack"

# Dipendenze sistema: nginx + supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps ────────────────────────────────────────────
WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Backend source ─────────────────────────────────────────
COPY backend/ .

# ── Frontend build (da stage 1) ────────────────────────────
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist

# ── Nginx config ───────────────────────────────────────────
COPY docker/nginx-internal.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# ── Supervisor config (gestisce nginx + uvicorn) ───────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/bibliotrack.conf

# ── Directory dati (montata come volume) ───────────────────
RUN mkdir -p /data/covers /data/db \
    && chmod 777 /data/covers /data/db

# ── Entrypoint ─────────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Porta esposta (nginx interno)
EXPOSE 8080

# Volume per dati persistenti
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
