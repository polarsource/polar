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
# uv lives in ~/.local/bin, so that has to come first. /usr/local/bin is only
# appended: it holds a node symlink older than the one already on PATH, and
# prepending it would install and build clients/ under a node the workspace
# does not support and the session itself never uses.
export PATH="$HOME/.local/bin:$PATH:/usr/local/bin"
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
  local name="$1" pid="$2" logfile="$3" optional="${4:-}" rc=0
  wait "$pid" || rc=1
  printf '\n=== %s (background) ===\n' "$name" >> "$LOG"
  cat "$logfile" >> "$LOG" 2>/dev/null
  if [ $rc -eq 0 ]; then
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
# setsid detaches the daemon so it survives the shell that started it. Only
# launched here: readiness is checked in section 6, once the Python and frontend
# setup has run, so a daemon that is slow to boot costs nothing and is never
# written off before it is actually needed.
# ---------------------------------------------------------------------------
CONTAINERD_PIDFILE=/run/docker/containerd/containerd.pid

launch_dockerd() {
  docker info >/dev/null 2>&1 && return 0
  command -v dockerd >/dev/null 2>&1 || return 1
  # A container that is resumed rather than created keeps /run from the previous
  # session. dockerd reads the orphaned containerd.pid, concludes containerd is
  # already running, and then times out waiting for a socket that never appears.
  # Test that pid rather than matching on process name: an unrelated system
  # containerd also matches, and would leave the stale file in place.
  if [ -f "$CONTAINERD_PIDFILE" ] &&
    ! kill -0 "$(cat "$CONTAINERD_PIDFILE" 2>/dev/null)" 2>/dev/null; then
    rm -f "$CONTAINERD_PIDFILE" /var/run/docker.sock
  fi
  setsid nohup dockerd >"$TMP/dockerd.log" 2>&1 &
}

wait_dockerd() {
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}
DOCKER_LAUNCHED=0
step "docker daemon" launch_dockerd && DOCKER_LAUNCHED=1

# ---------------------------------------------------------------------------
# 2. Environment files, before Docker Compose.
# server/docker-compose.yml interpolates POLAR_POSTGRES_USER/PWD/DATABASE and the
# MinIO bucket names from server/.env. Without it those expand to empty strings
# and the db and minio-setup containers die on boot -- while `docker compose up`
# still exits 0. This also writes server/.jwks.json and clients/apps/web/.env.local.
#
# Only when something is missing: setup-environment rewrites .env and .env.local
# from their templates and mints a fresh JWKS on every run, which would
# invalidate the tokens a running API has already issued.
# ---------------------------------------------------------------------------
if [ ! -f "$ROOT/server/.env" ] ||
  [ ! -f "$ROOT/server/.jwks.json" ] ||
  [ ! -f "$ROOT/clients/apps/web/.env.local" ]; then
  step "env files" "$ROOT/dev/setup-environment"
fi

# ---------------------------------------------------------------------------
# 3. Start the slow, independent work now and collect it at the end. The image
# pull dominates a cold container and shares nothing with the Python setup;
# nothing in the test path depends on clients/ having been installed.
# ---------------------------------------------------------------------------
PULL_LOG="$TMP/polar-compose-pull.log"
PULL_PID=
# The daemon is still booting on a cold container, so the wait happens inside
# the background job: that way the pull overlaps the Python setup instead of
# holding up session start, and section 6 finds the daemon already up.
pull_images() {
  wait_dockerd || return 1
  "${COMPOSE[@]}" pull --quiet db redis minio minio-setup
}
if [ "$DOCKER_LAUNCHED" -eq 1 ]; then
  pull_images >"$PULL_LOG" 2>&1 &
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
# code can be trusted here. Services are named explicitly because a bare `up -d`
# also starts tinybird (a large image) whose tests skip themselves. minio-setup
# is run rather than started: it is a run-to-completion container, so `up -d`
# would report success the moment it launched instead of when the bucket script
# finished, leaving a failed bucket creation unreported.
# ---------------------------------------------------------------------------
# Pre-warming only -- `up --wait` pulls anything genuinely missing, and an
# anonymous Docker Hub 429 here must not be reported as a broken environment.
[ -n "$PULL_PID" ] && reap "image pull" "$PULL_PID" "$PULL_LOG" optional

PG_OK=0
if [ "$DOCKER_LAUNCHED" -eq 1 ] && step "docker daemon ready" wait_dockerd; then
  if step "infrastructure" "${COMPOSE[@]}" up -d --wait --wait-timeout 120 db redis minio; then
    PG_OK=1
    step "minio buckets" "${COMPOSE[@]}" run --rm -T minio-setup
  else
    "${COMPOSE[@]}" ps -a >> "$LOG" 2>&1
    "${COMPOSE[@]}" logs --tail 20 >> "$LOG" 2>&1
  fi
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
  # dev/create-test-db is the shared implementation: it checks for the database
  # first, so "already exists" stays idempotent, and it surfaces a real psql
  # failure (missing client, wrong port, bad credentials) instead of hiding it
  # behind a confusing alembic error.
  "$ROOT/dev/create-test-db" || return 1
  POLAR_ENV=testing uv run --directory "$ROOT/server" task db_migrate
}
if [ "$PG_OK" -eq 1 ] && step "test template db" build_template_db; then
  # Exported here too, not just for the session, so the warm-up below clones the
  # template instead of replaying the history that was just applied.
  export POLAR_TEST_DATABASE_TEMPLATE="polar_test"
  # Appended at most once: the env file outlives a single hook run and its lines
  # are joined into one shell command, so a repeat becomes a malformed
  # `export A=b export A=b` that bash rejects.
  if [ -n "${CLAUDE_ENV_FILE:-}" ] &&
    ! grep -q POLAR_TEST_DATABASE_TEMPLATE "$CLAUDE_ENV_FILE" 2>/dev/null; then
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

# Optional for the same reason as the image pull: this only warms .mypy_cache,
# and a non-zero exit means a type error in the code, not a broken environment.
reap "warm mypy cache" "$MYPY_PID" "$MYPY_LOG" optional
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
