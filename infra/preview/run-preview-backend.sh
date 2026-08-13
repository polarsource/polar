#!/usr/bin/env bash
set -euo pipefail

API_PORT="${POLAR_PREVIEW_API_PORT:-10000}"

worker_pid=""
api_pid=""

cleanup() {
    local exit_code=$?
    [[ -n "$api_pid" ]] && kill "$api_pid" 2>/dev/null || true
    [[ -n "$worker_pid" ]] && kill "$worker_pid" 2>/dev/null || true
    wait 2>/dev/null || true
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

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

wait -n "$worker_pid" "$api_pid"
