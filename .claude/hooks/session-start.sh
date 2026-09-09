#!/bin/bash
# Prepares a Claude Code on the web container so the backend and frontend test
# suites and linters can run immediately. Mirrors .github/workflows/test_server.yaml
# rather than `dev up`, which is built for interactive local development.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOG="${TMPDIR:-/tmp}/polar-session-start.log"
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
export DEBIAN_FRONTEND=noninteractive
: > "$LOG"

FAILURES=()
NOTES=()

step() {
  local name="$1"; shift
  local start elapsed
  start=$(date +%s)
  printf '\n=== %s ===\n' "$name" >> "$LOG"
  if "$@" >> "$LOG" 2>&1; then
    elapsed=$(( $(date +%s) - start ))
    printf '%s: ok (%ss)\n' "$name" "$elapsed" >> "$LOG"
    return 0
  fi
  elapsed=$(( $(date +%s) - start ))
  printf '%s: FAILED (%ss)\n' "$name" "$elapsed" >> "$LOG"
  FAILURES+=("$name")
  return 1
}

# ---------------------------------------------------------------------------
# 1. Docker daemon.
# There is no systemd here, so `dev up`'s `systemctl start docker` cannot work.
# setsid+nohup detaches the daemon so it survives the shell that started it.
# ---------------------------------------------------------------------------
start_dockerd() {
  docker info >/dev/null 2>&1 && return 0
  command -v dockerd >/dev/null 2>&1 || return 1
  setsid nohup dockerd >"${TMPDIR:-/tmp}/dockerd.log" 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
step "docker daemon" start_dockerd || true

# ---------------------------------------------------------------------------
# 2. Environment files, before Docker Compose.
# server/docker-compose.yml interpolates POLAR_POSTGRES_USER/PWD/DATABASE and the
# MinIO bucket names from server/.env. Without it those expand to empty strings
# and the db and minio-setup containers die on boot -- while `docker compose up`
# still exits 0. This also writes server/.jwks.json and clients/apps/web/.env.local.
# ---------------------------------------------------------------------------
step "env files" "$ROOT/dev/setup-environment" || true

# ---------------------------------------------------------------------------
# 3. Infrastructure. Named explicitly: `docker compose up -d` with no arguments
# also starts tinybird (tinybirdco/tinybird-local:latest, a large image), whose
# tests skip themselves when it is absent.
# ---------------------------------------------------------------------------
step "infrastructure" docker compose --project-directory "$ROOT/server" up -d db redis minio minio-setup || true

# Compose exits 0 even when a container failed to start, so check the containers.
verify_containers() {
  local name state exit_code failed=0
  for name in server-db-1 server-redis-1 server-minio-1; do
    state=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null) || state="missing"
    if [ "$state" != "running" ]; then
      exit_code=$(docker inspect -f '{{.State.ExitCode}}' "$name" 2>/dev/null || echo "?")
      echo "$name is '$state' (exit $exit_code)"
      docker logs --tail 20 "$name" 2>&1 || true
      failed=1
    fi
  done
  return $failed
}
step "verify containers" verify_containers || true

wait_for_services() {
  local ok=1
  for _ in $(seq 1 60); do
    if docker exec server-db-1 pg_isready -U polar -q >/dev/null 2>&1; then ok=0; break; fi
    sleep 1
  done
  [ $ok -eq 0 ] || { echo "postgres never became ready"; return 1; }
  for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "minio health check never passed (S3-backed tests may fail)"
  return 0
}
step "wait for services" wait_for_services || true

# ---------------------------------------------------------------------------
# 4. Python dependencies. --dev carries pytest, mypy, ruff, fakeredis and xdist.
# ---------------------------------------------------------------------------
step "uv sync" uv sync --dev --frozen --directory "$ROOT/server" || true

# server/.jwks.json is import-blocking (polar.config JWKS validator). setup-environment
# writes it, but regenerate if that step failed or the file was lost.
if [ ! -f "$ROOT/server/.jwks.json" ]; then
  step "jwks" uv run --directory "$ROOT/server" task generate_dev_jwks || true
fi

# ---------------------------------------------------------------------------
# 5. Email renderer. The other import-blocking artifact -- but polar.config only
# validates that the path exists, so fall back to the stub that test_sdk.yaml and
# openapi-generate-check.yml already rely on rather than leaving config unimportable.
# ---------------------------------------------------------------------------
if [ ! -f "$ROOT/server/emails/bin/react-email-pkg" ]; then
  if ! step "email renderer" uv run --directory "$ROOT/server" task emails; then
    mkdir -p "$ROOT/server/emails/bin"
    touch "$ROOT/server/emails/bin/react-email-pkg"
    NOTES+=("Email renderer build failed; stubbed the binary so polar.config imports. Tests that actually render an email will fail -- run 'uv run task emails' in server/ to fix.")
  fi
fi

# ---------------------------------------------------------------------------
# 6. Pre-migrated template database.
# Without POLAR_TEST_DATABASE_TEMPLATE every xdist worker replays the entire
# alembic history into its own database, which is why `-n auto` only buys ~1.6x on
# 4 CPUs instead of ~4x. tests/fixtures/database.py clones the template instead.
# ---------------------------------------------------------------------------
build_template_db() {
  PGPASSWORD=polar psql -h 127.0.0.1 -U polar -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='polar_test'" | grep -q 1 ||
    PGPASSWORD=polar createdb -h 127.0.0.1 -U polar polar_test || return 1
  POLAR_ENV=testing uv run --directory "$ROOT/server" task db_migrate
}
if step "test template db" build_template_db; then
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export POLAR_TEST_DATABASE_TEMPLATE="polar_test"' >> "$CLAUDE_ENV_FILE"
  fi
  NOTES+=("POLAR_TEST_DATABASE_TEMPLATE=polar_test is set, so pytest clones a pre-migrated database per xdist worker. If you ADD a migration this session, re-run 'POLAR_ENV=testing uv run task db_migrate' in server/ to refresh the template, or the cloned schema will be stale.")
fi

# ---------------------------------------------------------------------------
# 7. Caches. mypy cold is ~60s and ~4s warm; the throwaway pytest run warms
# bytecode and absorbs a first-run database-creation flake seen on cold containers.
# ---------------------------------------------------------------------------
step "warm mypy cache" uv run --directory "$ROOT/server" task lint_types || true
step "warm pytest" env POLAR_ENV=testing uv run --directory "$ROOT/server" \
  python -m pytest tests/kit/test_address.py -q --no-cov -p no:randomly || true

# CI installs these for the PDF/invoice rendering tests.
if ! fc-list 2>/dev/null | grep -qi "noto sans cjk"; then
  step "cjk fonts" bash -c 'apt-get update -qq && apt-get install -y --no-install-recommends fonts-noto-cjk' || true
fi

# ---------------------------------------------------------------------------
# 8. Frontend. pnpm install also runs a full `turbo build` of packages/* via the
# `prepare` script, which turbo.json requires before any package's tests can run.
# ---------------------------------------------------------------------------
step "pnpm install" bash -c "cd '$ROOT/clients' && pnpm install --frozen-lockfile" || true

# ---------------------------------------------------------------------------
# Summary (stdout becomes session context).
# ---------------------------------------------------------------------------
echo "Polar environment prepared for tests and linters. Log: $LOG"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Setup steps that FAILED: ${FAILURES[*]}"
  echo "Check $LOG before trusting a test run."
fi
for note in ${NOTES+"${NOTES[@]}"}; do echo "Note: $note"; done
cat <<'USAGE'
Commands that work now (from server/): 'uv run task lint', 'uv run task lint_types',
'POLAR_ENV=testing uv run python -m pytest <path>'. Prefer 'uv run task test_fast'
over 'uv run task test' -- the latter adds coverage and takes ~50 minutes.
From clients/: 'pnpm lint', 'pnpm typecheck', and scope tests with
'pnpm test --filter web'; an unscoped 'pnpm test' oversubscribes 4 CPUs and
produces spurious 5s timeouts.
USAGE
exit 0
