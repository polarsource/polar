#!/usr/bin/env bash
# A/B benchmark of primary-database connection hold time: BASE_REF vs the working tree.
# See README.md in this directory.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SERVER="$(cd "$HERE/../.." && pwd)"
PY="$SERVER/.venv/bin/python"

BASE_REF="${BASE_REF:-origin/main}"
DATABASE="${DATABASE:-polar_bench}"
ADMIN_DSN="${ADMIN_DSN:-postgresql://polar:polar@127.0.0.1:5432/postgres}"
PORT="${PORT:-8100}"
PROXY_PORT="${PROXY_PORT:-6543}"
REPEATS="${REPEATS:-2}"
READ_RPS="${READ_RPS:-15}"
WRITE_RPS="${WRITE_RPS:-3}"
DURATION="${DURATION:-40}"
DELAYS="${DELAYS:-0 25 50 75}"
OUT="${OUT:-$HERE/results.jsonl}"

WORK="$(mktemp -d)"
BASE_TREE="$WORK/base"
SERVER_PID=""
PROXY_PID=""

read_env() { grep -E "^$1=" "$SERVER/.env" | head -1 | cut -d= -f2- | tr -d '"'; }
PRIMARY_ROLE="$(read_env POLAR_POSTGRES_USER)"
REPLICA_ROLE="$(read_env POLAR_POSTGRES_READ_USER)"
DB_PORT="$(read_env POLAR_POSTGRES_PORT)"

# Connections of a server that is still shutting down would be counted in the next run.
stop() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null || true
  [ -n "$PROXY_PID" ] && kill "$PROXY_PID" 2>/dev/null && wait "$PROXY_PID" 2>/dev/null || true
  SERVER_PID=""
  PROXY_PID=""
  for _ in $(seq 1 150); do
    [ "$(admin_query "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DATABASE' AND application_name = 'development.app'")" = "0" ] && return 0
    sleep 0.2
  done
  echo "Connections from the previous server are still open" >&2
  exit 1
}

cleanup() {
  stop
  git -C "$SERVER" worktree remove --force "$BASE_TREE" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

admin_query() {
  "$PY" -c 'import asyncio, sys, asyncpg
async def main():
    conn = await asyncpg.connect(sys.argv[1])
    print(await conn.fetchval(sys.argv[2]))
    await conn.close()
asyncio.run(main())' "$ADMIN_DSN" "$1"
}

admin_sql() {
  "$PY" -c 'import asyncio, sys, asyncpg
async def main():
    conn = await asyncpg.connect(sys.argv[1])
    await conn.execute(sys.argv[2])
    await conn.close()
asyncio.run(main())' "$1" "$2"
}

SERVER_ENV=(
  POLAR_ENV=development
  POLAR_LOG_LEVEL=WARNING
  POLAR_POSTGRES_DATABASE="$DATABASE"
  POLAR_POSTGRES_READ_DATABASE="$DATABASE"
  POLAR_DATABASE_POOL_SIZE=10
  POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_URL=
  POLAR_EMAIL_RENDERER_BINARY_PATH="$SERVER/emails/bin/react-email-pkg"
)

start() {
  local tree="$1" delay="$2"
  "$PY" "$HERE/latency_proxy.py" "$PROXY_PORT" "$DB_PORT" "$delay" &
  PROXY_PID=$!
  (cd "$tree" && exec env "${SERVER_ENV[@]}" POLAR_POSTGRES_READ_PORT="$PROXY_PORT" \
    "$PY" -m uvicorn polar.app:app --host 127.0.0.1 --port "$PORT" \
    --workers 1 --loop uvloop --no-access-log --timeout-graceful-shutdown 5) > "$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/healthz" && return 0
    sleep 1
  done
  cat "$WORK/server.log" >&2
  echo "Server did not start" >&2
  exit 1
}

echo "Creating $BASE_REF worktree"
git -C "$SERVER" worktree add --quiet --detach "$BASE_TREE" "$BASE_REF"
cp "$SERVER/.env" "$BASE_TREE/server/.env"

echo "Creating and migrating $DATABASE"
admin_sql "$ADMIN_DSN" "DROP DATABASE IF EXISTS $DATABASE WITH (FORCE)"
admin_sql "$ADMIN_DSN" "CREATE DATABASE $DATABASE"
(cd "$SERVER" && env "${SERVER_ENV[@]}" "$PY" -m alembic upgrade head > "$WORK/migrate.log" 2>&1)
admin_sql "${ADMIN_DSN%/*}/$DATABASE" \
  "GRANT USAGE ON SCHEMA public TO $REPLICA_ROLE; GRANT SELECT ON ALL TABLES IN SCHEMA public TO $REPLICA_ROLE"
(cd "$SERVER" && env "${SERVER_ENV[@]}" PYTHONPATH=. "$PY" "$HERE/seed.py") > "$WORK/seed.json"

declare -A TREES=([before]="$BASE_TREE/server" [after]="$SERVER")
: > "$OUT"
for repeat in $(seq 1 "$REPEATS"); do
  for delay in $DELAYS; do
    order="before after"
    [ $((repeat % 2)) -eq 0 ] && order="after before"
    for variant in $order; do
      echo "repeat=$repeat replica_delay=${delay}ms version=$variant"
      start "${TREES[$variant]}" "$delay"
      "$PY" "$HERE/loadgen.py" \
        --label "$variant|delay=$delay|repeat=$repeat" \
        --seed "$WORK/seed.json" --out "$OUT" \
        --read-rps "$READ_RPS" --write-rps "$WRITE_RPS" \
        --duration "$DURATION" --warmup 5 \
        --admin-dsn "$ADMIN_DSN" --database "$DATABASE" \
        --primary-role "$PRIMARY_ROLE" --replica-role "$REPLICA_ROLE" > /dev/null
      stop
    done
  done
done

"$PY" "$HERE/summarize.py" "$OUT"
