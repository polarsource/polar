#!/usr/bin/env bash

set -euo pipefail

PORT="${PORT:-10000}"
REDIS_HOST="${POLAR_REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${POLAR_REDIS_PORT:-6379}"

redis_pid=""
worker_pid=""
api_pid=""

cleanup() {
  local exit_code=$?

  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill "$api_pid" 2>/dev/null || true
  fi

  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
  fi

  if [[ -n "$redis_pid" ]] && kill -0 "$redis_pid" 2>/dev/null; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
    kill "$redis_pid" 2>/dev/null || true
  fi

  wait || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

echo "Starting preview Redis on ${REDIS_HOST}:${REDIS_PORT}..."
redis-server \
  --bind "$REDIS_HOST" \
  --port "$REDIS_PORT" \
  --save "" \
  --appendonly no &
redis_pid=$!

until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; do
  sleep 0.2
done

echo "Starting preview worker..."
uv run dramatiq \
  -p 1 \
  -t 1 \
  --queues high_priority medium_priority low_priority \
  -f polar.worker.scheduler:start \
  polar.worker.run &
worker_pid=$!

echo "Starting preview API on port ${PORT}..."
uv run uvicorn polar.app:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers 1 &
api_pid=$!

wait -n "$redis_pid" "$worker_pid" "$api_pid"
