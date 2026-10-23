# ──────────────────────────────────────────────────────────
# BiblioTrack — Dockerfile multi-stage
#
# Stage 1: build frontend React
# Stage 2: immagine finale Python + nginx
# Tutto in un singolo container (Unraid-friendly, no compose)
# ──────────────────────────────────────────────────────────

# ── STAGE 1: Frontend build ────────────────────────────────
# Immagini base fissate per digest (index multi-arch letto dal registry il 2026-10-23).
# Un digest non riceve patch da solo: aggiornalo periodicamente (vedi DOCKER-UNRAID.md → Aggiornamento immagini base).
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --silent

COPY frontend/ ./
# Build con base URL /api (nginx proxy interno strip-prefix)
RUN VITE_API_URL=/api npm run build


# ── STAGE 2: Runtime ──────────────────────────────────────
FROM python:3.11-slim@sha256:b7a9e5f6a93d6d4a31f129bbd4bdee69efccb6ded0fb230d78aafaf37af98377

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
# requirements.txt è un lock con hash (uv pip compile): pip rifiuta qualsiasi pacchetto non verificato
RUN pip install --no-cache-dir --require-hashes -r requirements.txt

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
