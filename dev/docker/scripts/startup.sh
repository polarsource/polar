#!/bin/bash
# Startup script for Polar API and Worker services in development mode
# This script handles dependency installation, email template building,
# database migrations, and service startup with hot-reloading.

set -euo pipefail

cd /app/server

echo "=== Polar Backend Startup ==="
echo "Service: ${1:-api}"

# Install Python dependencies if not present or outdated
if [[ ! -d ".venv" ]] || [[ "pyproject.toml" -nt ".venv" ]] || [[ "uv.lock" -nt ".venv" ]]; then
    echo "Installing Python dependencies..."
    uv sync --frozen
else
    echo "Python dependencies up to date"
fi

# Build email templates for this architecture
# The binary must be built for the container's architecture (Linux), not host (macOS)
ARCH=$(uname -m)
EMAIL_MARKER="emails/bin/.built-${ARCH}"
if [[ ! -f "$EMAIL_MARKER" ]]; then
    echo "Building email templates for ${ARCH}..."
    cd emails
    # Clean previous builds (may be from different architecture)
    rm -rf dist
    rm -f bin/react-email-pkg bin/.built-* 2>/dev/null || true
    # Configure pnpm to use the mounted store volume for faster installs
    pnpm config set store-dir /root/.local/share/pnpm/store --location project
    # Install dependencies (uses shared pnpm store for speed)
    pnpm install --frozen-lockfile
    # Build: tsup compiles TypeScript, pkg creates standalone binary
    pnpm exec tsup
    pnpm exec pkg package.json
    # Mark as built for this architecture
    touch "bin/.built-${ARCH}"
    cd ..
    echo "Email templates built for ${ARCH}"
else
    echo "Email templates already built for ${ARCH}"
fi

# Generate JWKS if not present
if [[ ! -f ".jwks.json" ]]; then
    echo "Generating development JWKS..."
    uv run python -c "
from authlib.jose import JsonWebKey, KeySet
options = {'kid': 'polar_dev', 'use': 'sig'}
key = JsonWebKey.generate_key('RSA', 2048, options, is_private=True)
keyset = KeySet(keys=[key])
with open('.jwks.json', 'w') as f:
    f.write(keyset.as_json(is_private=True))
"
    echo "JWKS generated"
else
    echo "JWKS already exists"
fi

# Wait for database to be ready
echo "Waiting for database..."
max_attempts=30
attempt=0
while ! pg_isready -h "$POLAR_POSTGRES_HOST" -p "$POLAR_POSTGRES_PORT" -U "$POLAR_POSTGRES_USER" -q; do
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
        echo "ERROR: Database not ready after $max_attempts attempts"
        exit 1
    fi
    echo "Database not ready, waiting... (attempt $attempt/$max_attempts)"
    sleep 2
done
echo "Database is ready"

# Run database migrations (only for API, not worker to avoid race conditions)
if [[ "${1:-api}" == "api" ]]; then
    echo "Running database migrations..."
    uv run alembic upgrade head
    echo "Migrations complete"
else
    echo "Skipping migrations (handled by API service)"
    # Wait a bit for API to run migrations first
    sleep 10
fi

# Load seed data if database is empty (first run) - only for API
if [[ "${1:-api}" == "api" ]]; then
    # Check if any organizations exist to determine if seeds are needed
    echo "Checking for seed data..."
    SEED_CHECK=$(uv run python -c "
import asyncio
from polar.postgres import create_async_engine
from sqlalchemy import text

async def check():
    engine = create_async_engine()
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM organizations'))
        count = result.scalar()
        return count

count = asyncio.run(check())
print(count)
" 2>/dev/null || echo "0")

    if [[ "$SEED_CHECK" == "0" ]]; then
        echo "Loading seed data (first run)..."
        uv run task seeds_load || echo "Warning: Seed loading failed, continuing anyway"
        echo "Seed data loaded"
    else
        echo "Database already has data, skipping seed loading"
    fi
fi

# Start the requested service
case "${1:-api}" in
    api)
        echo "Starting API server with hot-reload..."
        echo "API will be available at http://localhost:8000"
        exec uv run uvicorn polar.app:app \
            --reload \
            --reload-dir polar \
            --host 0.0.0.0 \
            --port 8000 \
            --workers 1
        ;;
    worker)
        echo "Starting background worker with hot-reload..."
        exec uv run dramatiq \
            -p 1 \
            -t 1 \
            --queues high_priority medium_priority low_priority \
            --watch polar \
            -f polar.worker.scheduler:start \
            polar.worker.run
        ;;
    shell)
        echo "Starting shell..."
        exec /bin/bash
        ;;
    *)
        echo "Unknown service: $1"
        echo "Available services: api, worker, shell"
        exit 1
        ;;
esac
