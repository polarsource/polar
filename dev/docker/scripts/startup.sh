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

# Build email templates for this architecture (API only to avoid race conditions)
# The binary must be built for the container's architecture (Linux), not host (macOS)
ARCH=$(uname -m)
EMAIL_MARKER="emails/bin/.built-${ARCH}"
if [[ "${1:-api}" == "api" ]] && [[ ! -f "$EMAIL_MARKER" ]]; then
    echo "Building email templates for ${ARCH}..."
    cd emails
    export CI=true
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
elif [[ "${1:-api}" == "worker" ]] && [[ ! -f "$EMAIL_MARKER" ]]; then
    echo "Waiting for API to build email templates..."
    while [[ ! -f "$EMAIL_MARKER" ]]; do
        sleep 2
    done
    echo "Email templates ready"
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

# Bootstrap the per-instance database + MinIO buckets on the shared infra
# (api only). Skipped when the marker file from a previous successful boot is
# still present; the marker lives in the api_venv volume so `dev docker
# cleanup` (which removes that volume) forces a re-bootstrap.
BOOTSTRAP_MARKER="/app/server/.venv/.bootstrap-${POLAR_POSTGRES_DATABASE}.done"
if [[ "${1:-api}" == "api" && ! -f "$BOOTSTRAP_MARKER" ]]; then
    READ_USER="${POLAR_POSTGRES_READ_USER:-polar_read}"
    echo "Bootstrapping per-instance DB '$POLAR_POSTGRES_DATABASE' and MinIO buckets..."
    # createdb ignores existing DBs (returns nonzero, suppressed); GRANTs are
    # idempotent. Read-only USER itself is created once by
    # server/init-readonly-user.sql on first postgres init.
    PGPASSWORD="$POLAR_POSTGRES_PWD" createdb -h "$POLAR_POSTGRES_HOST" \
        -p "$POLAR_POSTGRES_PORT" -U "$POLAR_POSTGRES_USER" \
        -O "$POLAR_POSTGRES_USER" "$POLAR_POSTGRES_DATABASE" 2>/dev/null || true
    PGPASSWORD="$POLAR_POSTGRES_PWD" psql -h "$POLAR_POSTGRES_HOST" \
        -p "$POLAR_POSTGRES_PORT" -U "$POLAR_POSTGRES_USER" \
        -d "$POLAR_POSTGRES_DATABASE" -v ON_ERROR_STOP=1 <<SQL >/dev/null
GRANT CONNECT ON DATABASE "$POLAR_POSTGRES_DATABASE" TO $READ_USER;
GRANT USAGE ON SCHEMA public TO $READ_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $READ_USER;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO $READ_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $READ_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO $READ_USER;
SQL
    # Buckets: create idempotently and apply the public-read policy on the
    # public bucket (mirrors `mc anonymous set download` in the legacy setup).
    uv run python <<'PY'
import os
import json
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["POLAR_S3_ENDPOINT_URL"],
    aws_access_key_id=os.environ["POLAR_AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["POLAR_AWS_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="us-east-1",
)
private = os.environ["POLAR_S3_FILES_BUCKET_NAME"]
public = os.environ["POLAR_S3_FILES_PUBLIC_BUCKET_NAME"]
for bucket in (private, public):
    try:
        s3.create_bucket(Bucket=bucket)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            raise
s3.put_bucket_policy(Bucket=public, Policy=json.dumps({
    "Version": "2012-10-17",
    "Statement": [
        {"Effect": "Allow", "Principal": {"AWS": ["*"]}, "Action": ["s3:GetBucketLocation", "s3:ListBucket"], "Resource": [f"arn:aws:s3:::{public}"]},
        {"Effect": "Allow", "Principal": {"AWS": ["*"]}, "Action": ["s3:GetObject"], "Resource": [f"arn:aws:s3:::{public}/*"]},
    ],
}))
PY
    touch "$BOOTSTRAP_MARKER"
    echo "Bootstrap complete: $POLAR_POSTGRES_DATABASE, $POLAR_S3_FILES_BUCKET_NAME, $POLAR_S3_FILES_PUBLIC_BUCKET_NAME"
fi

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

# Auto-discover Tinybird token
# Always refresh the token from the running Tinybird container, since it
# generates a new admin token on each startup and any token from server/.env
# may be stale.
if [[ -n "${POLAR_TINYBIRD_CLICKHOUSE_URL:-}" ]]; then
    TINYBIRD_HOST=$(echo "$POLAR_TINYBIRD_CLICKHOUSE_URL" | sed 's|http://||' | cut -d: -f1)
    TINYBIRD_API="http://${TINYBIRD_HOST}:7181"
    echo "Fetching Tinybird admin token from ${TINYBIRD_API}..."
    max_attempts=30
    attempt=0
    while true; do
        TB_TOKEN=$(curl -sf "${TINYBIRD_API}/tokens" 2>/dev/null \
            | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['admin_token'])" 2>/dev/null) && break
        attempt=$((attempt + 1))
        if [[ $attempt -ge $max_attempts ]]; then
            echo "WARNING: Could not fetch Tinybird token after $max_attempts attempts, continuing without it"
            break
        fi
        sleep 2
    done
    if [[ -n "${TB_TOKEN:-}" ]]; then
        export POLAR_TINYBIRD_API_TOKEN="$TB_TOKEN"
        export POLAR_TINYBIRD_CLICKHOUSE_TOKEN="$TB_TOKEN"
        export POLAR_TINYBIRD_READ_TOKEN="$TB_TOKEN"
        echo "Tinybird token configured"
    fi
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

# Install Playwright browsers for worker (needed for website scraping)
PLAYWRIGHT_MARKER="/root/.cache/ms-playwright/.installed"
if [[ "${1:-api}" == "worker" ]] && [[ ! -f "$PLAYWRIGHT_MARKER" ]]; then
    echo "Installing Playwright browsers..."
    uv run playwright install --with-deps chromium
    touch "$PLAYWRIGHT_MARKER"
    echo "Playwright browsers installed"
elif [[ "${1:-api}" == "worker" ]]; then
    echo "Playwright browsers already installed"
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
