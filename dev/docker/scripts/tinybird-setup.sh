#!/bin/bash
# Wrapper entrypoint for the Tinybird container that starts the server
# and then builds the data project.

set -euo pipefail

TINYBIRD_API="http://localhost:7181"
DATA_PROJECT_DIR="/tinybird"

# Start supervisord (the default CMD) in the background
/usr/bin/supervisord &
SUPERVISOR_PID=$!

# Wait for Tinybird to be fully ready
echo "=== Tinybird Setup: waiting for server ==="
max_attempts=120
attempt=0
while true; do
    if curl -sf "${TINYBIRD_API}/" >/dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
        echo "ERROR: Tinybird server not ready after $max_attempts attempts"
        wait $SUPERVISOR_PID
        exit 1
    fi
    sleep 1
done

# Get admin token
attempt=0
while true; do
    TOKEN=$(curl -sf "${TINYBIRD_API}/tokens" 2>/dev/null \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['admin_token'])" 2>/dev/null) && break
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
        echo "WARNING: Could not fetch Tinybird token, skipping data project build"
        wait $SUPERVISOR_PID
        exit 0
    fi
    sleep 1
done

# Wait for workspace API
attempt=0
while true; do
    if curl -sf "${TINYBIRD_API}/v1/workspace?token=${TOKEN}" >/dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    if [[ $attempt -ge $max_attempts ]]; then
        echo "WARNING: Tinybird workspace API not ready, skipping data project build"
        wait $SUPERVISOR_PID
        exit 0
    fi
    sleep 1
done

# Build data project if the directory exists
if [[ -d "${DATA_PROJECT_DIR}" ]]; then
    # Copy to writable dir (tb writes .tinyb file)
    WORK_DIR="/tmp/tinybird-deploy"
    cp -r "${DATA_PROJECT_DIR}" "${WORK_DIR}"
    cd "${WORK_DIR}"

    echo "=== Tinybird Setup: building data project ==="
    if tb --host "${TINYBIRD_API}" --token "${TOKEN}" build; then
        echo "=== Tinybird Setup: data project built successfully ==="
    else
        echo "WARNING: Tinybird data project build failed, continuing anyway"
    fi
fi

# Keep supervisord in the foreground
wait $SUPERVISOR_PID
