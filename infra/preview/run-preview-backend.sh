#!/usr/bin/env bash
set -euo pipefail

API_PORT="${POLAR_PREVIEW_API_PORT:-10000}"
REDIS_PORT="${POLAR_REDIS_PORT:-6379}"

redis_pid=""
worker_pid=""
api_pid=""

cleanup() {
    local exit_code=$?
    [[ -n "$api_pid" ]] && kill "$api_pid" 2>/dev/null || true
    [[ -n "$worker_pid" ]] && kill "$worker_pid" 2>/dev/null || true
    [[ -n "$redis_pid" ]] && redis-cli -p "$REDIS_PORT" shutdown nosave 2>/dev/null || true
    wait 2>/dev/null || true
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

redis-server --bind 127.0.0.1 --port "$REDIS_PORT" --save "" --appendonly no &
redis_pid=$!
until redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; do sleep 0.2; done

uv run dramatiq \
    -p 1 -t 1 \
    --queues high_priority medium_priority low_priority \
    -f polar.worker.scheduler:start \
    polar.worker.run &
worker_pid=$!

uv run uvicorn polar.app:app \
    --host 127.0.0.1 \
    --port "$API_PORT" \
    --workers 1 &
api_pid=$!

wait -n "$redis_pid" "$worker_pid" "$api_pid"
