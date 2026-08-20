#!/bin/bash
# Prepares a Claude Code on the web container so the backend linters (ruff, mypy)
# and the pytest suite can actually run: Python 3.14 toolchain, project
# dependencies, generated config files, and the services the tests talk to.
#
# Local machines are left alone — developers use `./dev/setup-environment` and
# `docker compose up` as documented in AGENTS.md.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SERVER_DIR="$REPO_ROOT/server"

# uv 0.8 predates the final CPython 3.14 release and resolves `3.14` to 3.14.0rc2.
MIN_UV_VERSION="0.12.0"

export PATH="$HOME/.local/bin:$PATH"

log() { echo "[session-start] $*" >&2; }
warn() { echo "[session-start] WARNING: $*" >&2; }

version_lt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]
}

ensure_uv() {
  if ! command -v uv >/dev/null 2>&1; then
    warn "uv is not installed; skipping backend setup"
    return 1
  fi
  local current
  current="$(uv --version | awk '{print $2}')"
  if version_lt "$current" "$MIN_UV_VERSION"; then
    log "upgrading uv $current -> >=$MIN_UV_VERSION (older versions ship no final 3.14 build)"
    # releases.astral.sh is blocked by the egress policy, so install from PyPI.
    uv tool install --force uv >/dev/null 2>&1
    hash -r
  fi
  log "uv $(uv --version | awk '{print $2}')"
}

install_python_deps() {
  cd "$SERVER_DIR"
  uv python install --quiet
  uv sync --dev --frozen --quiet
  log "python $(uv run python --version | awk '{print $2}'), ruff $(uv run ruff --version | awk '{print $2}')"
}

generate_config_files() {
  if [ ! -f "$SERVER_DIR/.env" ]; then
    log "generating .env files"
    "$REPO_ROOT/dev/setup-environment" >/dev/null
  fi
  if [ ! -f "$SERVER_DIR/.jwks.json" ]; then
    log "generating .jwks.json"
    (cd "$SERVER_DIR" && uv run task generate_dev_jwks)
  fi
}

# `task emails` ends with @yao-pkg/pkg, which needs a prebuilt Node base binary
# from iojs.org. That host is blocked by the egress policy, so pkg silently
# falls back to compiling Node from source (>30 min). Bundle with tsup instead
# and expose the bundle through a shim with the same CLI contract — polar.email
# only ever runs it as a subprocess (see polar/email/react.py).
build_email_renderer() {
  local binary="$SERVER_DIR/emails/bin/react-email-pkg"
  [ -x "$binary" ] && return 0

  log "building the email renderer bundle"
  cd "$SERVER_DIR/emails"
  pnpm install --frozen-lockfile >/dev/null 2>&1
  pnpm exec tsup >/dev/null 2>&1

  mkdir -p bin
  cat > "$binary" <<'SHIM'
#!/bin/sh
# Stand-in for the @yao-pkg/pkg single-file binary: same arguments, same
# bundle, run through the system Node instead of an embedded one.
exec node "$(dirname "$(readlink -f "$0")")/../dist/index.global.js" "$@"
SHIM
  chmod +x "$binary"
}

# The packaged Postgres reads the system tzdata, which no longer carries the
# deprecated zone aliases (Asia/Rangoon, Asia/Calcutta, ...) that the metrics
# tests exercise; CI's postgres:15.1-bullseye image bundles them.
install_legacy_timezones() {
  [ -e /usr/share/zoneinfo/Asia/Rangoon ] && return 0
  log "installing tzdata-legacy"
  # Some third-party PPAs are blocked by the egress policy; the Ubuntu archives
  # this needs are not, so a partial index refresh is fine.
  apt-get update -qq >/dev/null 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tzdata-legacy >/dev/null 2>&1
}

start_postgres() {
  install_legacy_timezones || warn "deprecated timezone aliases unavailable"
  pg_isready -q -h 127.0.0.1 -p 5432 || service postgresql start >/dev/null
  local role_exists
  role_exists="$(su postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='polar'\"")"
  if [ "$role_exists" != "1" ]; then
    su postgres -c "psql -qc \"CREATE ROLE polar WITH LOGIN SUPERUSER PASSWORD 'polar'\"" >/dev/null
  fi
  log "postgres ready on 5432"
}

start_redis() {
  redis-cli ping >/dev/null 2>&1 || service redis-server start >/dev/null 2>&1 || true
  redis-cli ping >/dev/null 2>&1
  log "redis ready on 6379"
}

start_s3() {
  uv tool install --quiet 'moto[s3,server]' >/dev/null 2>&1 || true
  if ! curl -sf --noproxy '*' -o /dev/null http://127.0.0.1:9000/; then
    nohup moto_server -H 127.0.0.1 -p 9000 >/tmp/moto-s3.log 2>&1 &
    local attempt
    for attempt in $(seq 1 20); do
      curl -sf --noproxy '*' -o /dev/null http://127.0.0.1:9000/ && break
      sleep 1
    done
  fi
  curl -sf --noproxy '*' -o /dev/null http://127.0.0.1:9000/

  # server/.minio/configure.sh does this against a real MinIO; replicate the
  # buckets it creates, for both the development and the testing settings.
  local env_name
  for env_name in development testing; do
    (cd "$SERVER_DIR" && POLAR_ENV="$env_name" uv run python - <<'PY'
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from polar.config import settings

s3 = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.MINIO_USER,
    aws_secret_access_key=settings.MINIO_PWD,
    config=Config(signature_version=settings.AWS_SIGNATURE_VERSION),
)

for name in sorted(
    {
        value
        for key, value in settings.model_dump().items()
        if key.endswith("BUCKET_NAME") and isinstance(value, str) and value
    }
):
    try:
        s3.create_bucket(Bucket=name)
    except ClientError as e:
        if e.response["Error"]["Code"] not in (
            "BucketAlreadyOwnedByYou",
            "BucketAlreadyExists",
        ):
            raise
    s3.put_bucket_versioning(
        Bucket=name, VersioningConfiguration={"Status": "Enabled"}
    )
PY
    ) >/dev/null 2>&1
  done
  log "s3 (moto) ready on 9000"
}

# Docker Hub's blob CDN is blocked by the egress policy, so `docker compose up`
# cannot pull the images from server/docker-compose.yml. Fall back to the
# Postgres and Redis packaged in the image, and to moto as a stand-in for MinIO.
start_services() {
  start_postgres || warn "postgres unavailable — tests that hit the database will fail"
  start_redis || warn "redis unavailable — tests that hit the cache will fail"
  start_s3 || warn "s3 unavailable — the session-scoped bucket fixture will fail"
}

ensure_uv || exit 0
install_python_deps
generate_config_files
build_email_renderer
start_services

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

log "ready — run linters and tests from server/ with 'uv run task lint_check' and 'uv run pytest'"
