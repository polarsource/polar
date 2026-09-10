#!/bin/bash
# Prepares a Claude Code on the web container to run the test suites and linters.
# Mirrors .github/workflows/test_server.yaml rather than `dev up`, which is built for
# interactive local development. No `set -e`: steps are advisory and the summary reports
# failures, so one broken step never blocks the session.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TMP="${TMPDIR:-/tmp}"
LOG="$TMP/polar-session-start.log"
CONTAINERD_PIDFILE=/run/docker/containerd/containerd.pid
COMPOSE=(docker compose --project-directory "$ROOT/server")
# uv needs ~/.local/bin first; /usr/local/bin is appended because its node symlink is
# older than the one already on PATH and the workspace does not support it.
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

# An "optional" step is a pure optimisation, kept out of FAILURES so the summary only
# reports what actually breaks a test run.
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

# There is no systemd here, so `dev up`'s `systemctl start docker` cannot work.
# Readiness is checked later, so a daemon slow to boot is not written off.
launch_dockerd() {
  docker info >/dev/null 2>&1 && return 0
  command -v dockerd >/dev/null 2>&1 || return 1

  local privileged=()
  if [ "$(id -u)" -ne 0 ]; then
    if ! sudo -n true >/dev/null 2>&1; then
      echo "dockerd requires root and passwordless sudo is unavailable"
      return 1
    fi
    privileged=(sudo -n)
  fi

  # A resumed container keeps /run, and dockerd hangs trusting an orphaned pidfile.
  # Test the pid rather than the process name: an unrelated containerd also matches.
  if [ -f "$CONTAINERD_PIDFILE" ] &&
    ! kill -0 "$(cat "$CONTAINERD_PIDFILE" 2>/dev/null)" 2>/dev/null; then
    "${privileged[@]}" rm -f "$CONTAINERD_PIDFILE" /var/run/docker.sock
  fi

  setsid nohup "${privileged[@]}" dockerd >"$TMP/dockerd.log" 2>&1 &
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

# Must precede compose, which interpolates the Postgres credentials and MinIO bucket
# names from server/.env and silently starts dead containers without them. Skipped when
# already present: setup-environment mints a fresh JWKS every run, invalidating the
# tokens a running API has issued.
if [ ! -f "$ROOT/server/.env" ] ||
  [ ! -f "$ROOT/server/.jwks.json" ] ||
  [ ! -f "$ROOT/clients/apps/web/.env.local" ]; then
  step "env files" "$ROOT/dev/setup-environment"
fi

# The image pull and the frontend install share nothing with the Python setup, so they
# run underneath it. The pull waits for the daemon inside the job to keep that overlap.
PULL_LOG="$TMP/polar-compose-pull.log"
PULL_PID=
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

# --dev carries pytest, mypy, ruff, fakeredis and xdist.
step "uv sync" uv sync --dev --frozen --directory "$ROOT/server"

# Import-blocking, and only missing here if the env files step failed partway.
if [ ! -f "$ROOT/server/.jwks.json" ]; then
  step "jwks" uv run --directory "$ROOT/server" task generate_dev_jwks
fi

# The other import-blocking artifact. polar.config only checks that the path exists, so
# fall back to the stub test_sdk.yaml already relies on rather than leaving it unimportable.
if [ ! -f "$ROOT/server/emails/bin/react-email-pkg" ]; then
  if ! step "email renderer" uv run --directory "$ROOT/server" task emails; then
    mkdir -p "$ROOT/server/emails/bin"
    touch "$ROOT/server/emails/bin/react-email-pkg"
    NOTES+=("Email renderer build failed; stubbed the binary so polar.config imports. Tests that actually render an email will fail -- run 'uv run task emails' in server/ to fix.")
  fi
fi

# Pre-warming only, so a Docker Hub 429 must not read as a broken environment.
[ -n "$PULL_PID" ] && reap "image pull" "$PULL_PID" "$PULL_LOG" optional

PG_OK=0
if [ "$DOCKER_LAUNCHED" -eq 1 ] && step "docker daemon ready" wait_dockerd; then
  # --wait uses the healthchecks docker-compose.yml declares. Services are named because
  # a bare `up -d` also pulls tinybird, whose tests skip themselves when it is absent.
  if step "infrastructure" "${COMPOSE[@]}" up -d --wait --wait-timeout 120 db redis minio; then
    PG_OK=1
    # `run`, not `up -d`: this container exits when the bucket script finishes, so only
    # `run` propagates that script's exit code.
    step "minio buckets" "${COMPOSE[@]}" run --rm -T minio-setup
  else
    "${COMPOSE[@]}" ps -a >> "$LOG" 2>&1
    "${COMPOSE[@]}" logs --tail 20 >> "$LOG" 2>&1
  fi
else
  NOTES+=("Docker daemon unavailable, so PostgreSQL and MinIO are not running. Skipped the template database and the pytest warm-up; backend tests will fail until the daemon is up. See $LOG.")
fi

# Lets each xdist worker clone a migrated database instead of replaying the whole alembic
# history. `task db_recreate` does this from config but replays every migration each run.
build_template_db() {
  "$ROOT/dev/create-test-db" || return 1
  POLAR_ENV=testing uv run --directory "$ROOT/server" task db_migrate
}
if [ "$PG_OK" -eq 1 ] && step "test template db" build_template_db; then
  # Exported in-process too, so the warm-up below clones rather than re-migrating.
  export POLAR_TEST_DATABASE_TEMPLATE="polar_test"
  # At most once: the env file outlives a single run and would grow unboundedly.
  if [ -n "${CLAUDE_ENV_FILE:-}" ] &&
    ! grep -q POLAR_TEST_DATABASE_TEMPLATE "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo 'export POLAR_TEST_DATABASE_TEMPLATE="polar_test"' >> "$CLAUDE_ENV_FILE"
  fi
  NOTES+=("POLAR_TEST_DATABASE_TEMPLATE=polar_test is set, so pytest clones a pre-migrated database per xdist worker. If you ADD a migration this session, re-run 'POLAR_ENV=testing uv run task db_migrate' in server/ to refresh the template, or the cloned schema will be stale.")
fi

# mypy is the only CPU-bound step, so it overlaps the frontend install, not the pull.
MYPY_LOG="$TMP/polar-mypy-warm.log"
uv run --directory "$ROOT/server" task lint_types >"$MYPY_LOG" 2>&1 &
MYPY_PID=$!

# Warms bytecode and absorbs a first-run database flake. Needs Postgres even though these
# tests never query it, because an autouse session fixture creates a database regardless.
if [ "$PG_OK" -eq 1 ]; then
  step "warm pytest" env POLAR_ENV=testing uv run --directory "$ROOT/server" \
    python -m pytest tests/kit/test_address.py -q --no-cov -p no:randomly
fi

# Optional: a non-zero exit means a type error in the code, not a broken environment.
reap "warm mypy cache" "$MYPY_PID" "$MYPY_LOG" optional
reap "pnpm install" "$PNPM_PID" "$PNPM_LOG"

echo "Polar environment prepared for tests and linters. Log: $LOG"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Setup steps that FAILED: ${FAILURES[*]}"
  echo "Check $LOG before trusting a test run."
fi
for note in ${NOTES+"${NOTES[@]}"}; do echo "Note: $note"; done
echo "If a PDF or invoice test fails on missing CJK glyphs:" \
  "apt-get install -y --no-install-recommends fonts-noto-cjk"
