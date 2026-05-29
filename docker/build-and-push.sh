#!/usr/bin/env bash
# BiblioTrack — build e push su GitHub Container Registry
# Uso:
#   GITHUB_USER=tuoutente bash docker/build-and-push.sh
#   GITHUB_USER=tuoutente VERSION=1.0.0 bash docker/build-and-push.sh
set -euo pipefail

GITHUB_USER="${GITHUB_USER:?Imposta: export GITHUB_USER=tuoutente}"
IMAGE="ghcr.io/${GITHUB_USER}/bibliotrack"
VERSION="${VERSION:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"  # Unraid = amd64; Raspberry Pi = arm64

echo "▶ Build  : $IMAGE:$VERSION"
echo "▶ Platform: $PLATFORMS"

# Login GHCR (richiede GITHUB_TOKEN o pat con write:packages)
if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
fi

# Build multi-arch con buildx
docker buildx build \
    --platform "$PLATFORMS" \
    --tag "$IMAGE:$VERSION" \
    $([ "$VERSION" != "latest" ] && echo "--tag $IMAGE:latest") \
    --push \
    .

echo ""
echo "✓ Push completato: $IMAGE:$VERSION"
echo "  Pull: docker pull $IMAGE:$VERSION"
