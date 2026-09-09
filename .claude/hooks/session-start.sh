#!/bin/bash
# Prepares a Claude Code on the web container so the backend and frontend test
# suites and linters can run immediately. Mirrors .github/workflows/test_server.yaml
# rather than `dev up`, which is built for interactive local development.
#
# There is deliberately no `set -e`: every step is advisory, `step` records failures
# and the summary reports them, so one broken step never blocks the session.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TMP="${TMPDIR:-/tmp}"
LOG="$TMP/polar-session-start.log"
COMPOSE=(docker compose --project-directory "$ROOT/server")
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
: > "$LOG"

FAILURES=()
NOTES=()

step() {
  local name="$1" start rc=0
  shift
  start=$(date +%s)
  printf '\n=== %s ===\n' "$name" >> "$LOG"
  "$@" >> "$LOG" 2>&1 || rc=1
  [ $rc -eq 0 ] || FAILURES+=("$name")
  printf '%s: %s (%ss)\n' "$name" \
    "$([ $rc -eq 0 ] && echo ok || echo FAILED)" \
    "$(( $(date +%s) - start ))" >> "$LOG"
  return $rc
}

# Waits for a backgrounded step and folds its result into the summary. A step
# marked "optional" is a pure optimisation: log it, but keep it out of FAILURES
# so the summary only ever reports things that actually break a test run.
reap() {
  local name="$1" pid="$2" logfile="$3" optional="${4:-}"
  printf '\n=== %s (background) ===\n' "$name" >> "$LOG"
  cat "$logfile" >> "$LOG" 2>/dev/null
  if wait "$pid"; then
    printf '%s: ok\n' "$name" >> "$LOG"
  elif [ -n "$optional" ]; then
    printf '%s: skipped, continuing\n' "$name" >> "$LOG"
  else
    FAILURES+=("$name")
    printf '%s: FAILED\n' "$name" >> "$LOG"
  fi
}

# ---------------------------------------------------------------------------
# 1. Docker daemon.
# There is no systemd here, so `dev up`'s `systemctl start docker` cannot work.
# setsid detaches the daemon so it survives the shell that started it.
# ---------------------------------------------------------------------------
start_dockerd() {
  docker info >/dev/null 2>&1 && return 0
  command -v dockerd >/dev/null 2>&1 || return 1
  # A container that is resumed rather than created keeps /run from the previous
  # session. dockerd reads the orphaned containerd.pid, concludes containerd is
  # already running, and then times out waiting for a socket that never appears.
  if ! pgrep -x containerd >/dev/null 2>&1; then
    rm -f /run/docker/containerd/containerd.pid /var/run/docker.sock
  fi
  setsid nohup dockerd >"$TMP/dockerd.log" 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
DOCKER_OK=0
step "docker daemon" start_dockerd && DOCKER_OK=1

# ---------------------------------------------------------------------------
# 2. Environment files, before Docker Compose.
# server/docker-compose.yml interpolates POLAR_POSTGRES_USER/PWD/DATABASE and the
# MinIO bucket names from server/.env. Without it those expand to empty strings
# and the db and minio-setup containers die on boot -- while `docker compose up`
# still exits 0. This also writes server/.jwks.json and clients/apps/web/.env.local.
# ---------------------------------------------------------------------------
step "env files" "$ROOT/dev/setup-environment"

# ---------------------------------------------------------------------------
# 3. Start the slow, independent work now and collect it at the end. The image
# pull dominates a cold container and shares nothing with the Python setup;
# nothing in the test path depends on clients/ having been installed.
# ---------------------------------------------------------------------------
PULL_LOG="$TMP/polar-compose-pull.log"
PULL_PID=
if [ "$DOCKER_OK" -eq 1 ]; then
  "${COMPOSE[@]}" pull --quiet db redis minio minio-setup >"$PULL_LOG" 2>&1 &
  PULL_PID=$!
fi

PNPM_LOG="$TMP/polar-pnpm-install.log"
pnpm --dir "$ROOT/clients" install --frozen-lockfile >"$PNPM_LOG" 2>&1 &
PNPM_PID=$!

# ---------------------------------------------------------------------------
# 4. Python dependencies. --dev carries pytest, mypy, ruff, fakeredis and xdist.
# ---------------------------------------------------------------------------
step "uv sync" uv sync --dev --frozen --directory "$ROOT/server"

# server/.jwks.json is import-blocking (polar.config JWKS validator). setup-environment
# writes it last, so this only fires if that step failed partway -- which still
# matters, because tests read .env.testing and do not need the .env it also writes.
if [ ! -f "$ROOT/server/.jwks.json" ]; then
  step "jwks" uv run --directory "$ROOT/server" task generate_dev_jwks
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
# 6. Infrastructure. --wait blocks on the healthchecks docker-compose.yml already
# declares, and exits non-zero if one never becomes healthy, so compose's exit
# code can be trusted here. minio-setup is excluded: it is a run-to-completion
# container with no healthcheck. Services are named explicitly because a bare
# `up -d` also starts tinybird (a large image) whose tests skip themselves.
# ---------------------------------------------------------------------------
PG_OK=0
if [ "$DOCKER_OK" -eq 1 ]; then
  # Pre-warming only -- `up --wait` pulls anything genuinely missing, and an
  # anonymous Docker Hub 429 here must not be reported as a broken environment.
  [ -n "$PULL_PID" ] && reap "image pull" "$PULL_PID" "$PULL_LOG" optional
  if step "infrastructure" "${COMPOSE[@]}" up -d --wait --wait-timeout 120 db redis minio; then
    PG_OK=1
  else
    "${COMPOSE[@]}" ps -a >> "$LOG" 2>&1
    "${COMPOSE[@]}" logs --tail 20 >> "$LOG" 2>&1
  fi
  step "minio buckets" "${COMPOSE[@]}" up -d minio-setup
else
  NOTES+=("Docker daemon unavailable, so PostgreSQL and MinIO are not running. Skipped the template database and the pytest warm-up; backend tests will fail until the daemon is up. See $LOG.")
fi

# ---------------------------------------------------------------------------
# 7. Pre-migrated template database.
# Without POLAR_TEST_DATABASE_TEMPLATE every xdist worker replays the entire
# alembic history into its own database. tests/fixtures/database.py clones the
# template instead. `task db_recreate` would also do this from config, but it
# drops and replays every migration on every session; this stays incremental.
# ---------------------------------------------------------------------------
build_template_db() {
  # "already exists" is the idempotent case, so failure here is not fatal.
  PGPASSWORD=polar psql -h 127.0.0.1 -U polar -d postgres \
    -c 'CREATE DATABASE polar_test' >/dev/null 2>&1
  POLAR_ENV=testing uv run --directory "$ROOT/server" task db_migrate
}
if [ "$PG_OK" -eq 1 ] && step "test template db" build_template_db; then
  # Exported here too, not just for the session, so the warm-up below clones the
  # template instead of replaying the history that was just applied.
  export POLAR_TEST_DATABASE_TEMPLATE="polar_test"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export POLAR_TEST_DATABASE_TEMPLATE="polar_test"' >> "$CLAUDE_ENV_FILE"
  fi
  NOTES+=("POLAR_TEST_DATABASE_TEMPLATE=polar_test is set, so pytest clones a pre-migrated database per xdist worker. If you ADD a migration this session, re-run 'POLAR_ENV=testing uv run task db_migrate' in server/ to refresh the template, or the cloned schema will be stale.")
fi

# ---------------------------------------------------------------------------
# 8. Caches. mypy is the only CPU-bound step, so it overlaps the frontend install
# rather than the image pull. The pytest run warms bytecode and absorbs a
# first-run database-creation flake seen on cold containers.
# ---------------------------------------------------------------------------
MYPY_LOG="$TMP/polar-mypy-warm.log"
uv run --directory "$ROOT/server" task lint_types >"$MYPY_LOG" 2>&1 &
MYPY_PID=$!

# An autouse session fixture creates a database even for tests that never query one.
if [ "$PG_OK" -eq 1 ]; then
  step "warm pytest" env POLAR_ENV=testing uv run --directory "$ROOT/server" \
    python -m pytest tests/kit/test_address.py -q --no-cov -p no:randomly
fi

reap "warm mypy cache" "$MYPY_PID" "$MYPY_LOG"
reap "pnpm install" "$PNPM_PID" "$PNPM_LOG"

# ---------------------------------------------------------------------------
# Summary (stdout becomes session context).
# ---------------------------------------------------------------------------
echo "Polar environment prepared for tests and linters. Log: $LOG"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Setup steps that FAILED: ${FAILURES[*]}"
  echo "Check $LOG before trusting a test run."
fi
for note in ${NOTES+"${NOTES[@]}"}; do echo "Note: $note"; done
echo "If a PDF or invoice test fails on missing CJK glyphs:" \
  "apt-get install -y --no-install-recommends fonts-noto-cjk"
