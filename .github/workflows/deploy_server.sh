#!/bin/bash

set -euo pipefail

# Usage: ./deploy_server.sh <docker_tag> <has_migrations> <api_service_id> <worker_service_ids>
if [ $# -lt 4 ]; then
  echo "Usage: $0 <docker_tag> <has_migrations> <api_service_id> <worker_service_ids>"
  echo "Example: $0 sha-abc1234 true srv-123 srv-456,srv-789"
  exit 1
fi

IMG="ghcr.io/polarsource/polar:${1}"
HAS_MIGRATIONS="${2}"
API_SERVICE_ID="${3}"
WORKER_SERVICE_IDS="${4}"

# Convert worker service IDs from comma-separated string to array
WORKER_SERVERS=()
if [[ -n "$WORKER_SERVICE_IDS" ]]; then
  IFS=',' read -ra WORKER_SERVERS <<< "$WORKER_SERVICE_IDS"
fi

# Configuration
TIMEOUT=300  # 5 minutes timeout
POLL_INTERVAL=5  # Check every 5 seconds

# Keep responses on disk before parsing so cancellation can recover an in-flight create.
STATE_DIR=$(mktemp -d)
CREATING=false
trap 'rm -rf "$STATE_DIR"' EXIT

RENDER_CURL=(curl --silent --show-error --fail --connect-timeout 1
  -H "Accept: application/json"
  -H "Authorization: Bearer ${RENDER_API_TOKEN}")

# Render cannot cancel live deployments or cron jobs; completed migrations stay applied.
# SIGKILL, runner loss, or a lost create response can leave deployments uncanceled.
# Only IDs returned to this invocation are safe to cancel.
cancel_deployment() {
  local record=$1 service_id deploy_id status
  service_id=$(cat "$record/service")
  deploy_id=$(jq -er '.id | select(type == "string" and test("^dep-[a-zA-Z0-9]+$"))' "$record/response" 2>/dev/null) || {
    echo "  ⚠️  ${service_id}: no deployment ID received; remote acceptance is unknown"
    return
  }

  status=unknown
  if "${RENDER_CURL[@]}" --max-time 1 -o "$record/status" \
    "https://api.render.com/v1/services/${service_id}/deploys/${deploy_id}"; then
    status=$(jq -r '.status' "$record/status" 2>/dev/null) || status=unknown
  fi
  case "$status" in
    live|deactivated|build_failed|update_failed|pre_deploy_failed|canceled)
      echo "  ${service_id}/${deploy_id}: ${status}; no cancellation needed"
      return
      ;;
  esac

  # Also try when status lookup fails; Render decides whether it can still cancel.
  if "${RENDER_CURL[@]}" --max-time 1 -X POST -o "$record/cancel" \
    "https://api.render.com/v1/services/${service_id}/deploys/${deploy_id}/cancel"; then
    status=$(jq -r '.status' "$record/cancel" 2>/dev/null) || status=unknown
    echo "  ${service_id}/${deploy_id}: cancellation requested (${status})"
  else
    echo "  ⚠️  ${service_id}/${deploy_id}: cancellation failed; check Render"
  fi
}

cleanup() {
  local record pid
  trap '' INT TERM
  set +e
  echo "🛑 Deployment stopped; stopping local work and canceling owned Render deployments"
  # Let an in-flight create finish recording its ID; stop polling immediately.
  if [[ "$CREATING" != true ]]; then
    for pid in $(jobs -pr); do
      kill -TERM "$pid" 2>/dev/null
    done
  fi
  wait 2>/dev/null

  for record in "$STATE_DIR"/deploy.*; do
    [[ -d "$record" ]] || continue
    cancel_deployment "$record" &
  done
  wait
}

finish() {
  local exit_code=$?
  trap - EXIT
  if [[ "$exit_code" -ne 0 ]]; then
    cleanup
  fi
  rm -rf "$STATE_DIR"
  exit "$exit_code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Wait on background commands so Bash handles signals immediately, including during curl.
request() {
  local timeout=$1 output=$2
  shift 2
  "${RENDER_CURL[@]}" --max-time "$timeout" -o "$output" "$@" &
  wait "$!"
}

# Function to deploy a set of servers
deploy_servers() {
  local services=$1
  shift
  local server_id deploy_id record status
  local records=()

  echo "🚀 Starting deployment of ${services}..."

  for server_id in "$@"; do
    echo "  Triggering deployment for ${server_id}..."
    record=$(mktemp -d "$STATE_DIR/deploy.XXXXXX")
    printf '%s' "$server_id" > "$record/service"
    records+=("$record")

    # Reserve two seconds for parallel cleanup within GitHub's cancellation grace.
    CREATING=true
    request 4 "$record/response" -X POST \
      -H "Content-Type: application/json" \
      -d "{\"imageUrl\":\"${IMG}\"}" \
      "https://api.render.com/v1/services/${server_id}/deploys"
    CREATING=false
    deploy_id=$(jq -er '.id | select(type == "string" and test("^dep-[a-zA-Z0-9]+$"))' "$record/response")
    echo "    Deploy ID: ${deploy_id}"
  done

  # Wait for deployments to complete
  echo "⏳ Waiting for ${services} deployments to complete..."

  local start_time
  start_time=$(date +%s)
  local all_complete=false

  while [[ $all_complete == false ]]; do
    all_complete=true

    for record in "${records[@]}"; do
      server_id=$(cat "$record/service")
      deploy_id=$(jq -r '.id' "$record/response")
      request 10 "$record/status" "https://api.render.com/v1/services/${server_id}/deploys/${deploy_id}"
      status=$(jq -er '.status' "$record/status")

      case "$status" in
        "live")
          echo "  ✅ ${server_id}: deployed successfully"
          ;;
        "build_failed"|"update_failed"|"pre_deploy_failed"|"canceled")
          echo "  ❌ ${server_id}: deployment failed with status ${status}"
          exit 1
          ;;
        "created"|"queued"|"build_in_progress"|"update_in_progress"|"pre_deploy_in_progress")
          echo "  🔄 ${server_id}: deployment in progress (${status})"
          all_complete=false
          ;;
        "deactivated")
          echo "  ⚠️  ${server_id}: service is deactivated"
          all_complete=false
          ;;
        *)
          echo "  ⚠️  ${server_id}: unknown status ${status}"
          all_complete=false
          ;;
      esac
    done

    if [[ $all_complete == false ]]; then
      # Check timeout
      local current_time elapsed
      current_time=$(date +%s)
      elapsed=$((current_time - start_time))

      if [[ $elapsed -gt $TIMEOUT ]]; then
        echo "❌ Deployment timeout after ${TIMEOUT} seconds"
        exit 1
      fi

      echo "  Checking again in ${POLL_INTERVAL} seconds..."
      sleep "$POLL_INTERVAL" &
      wait "$!"
    fi
  done

  echo "✅ ${services} deployments completed successfully!"
}

# Deploy based on migration status
if [ "$HAS_MIGRATIONS" = "true" ]; then
  echo "📋 Deploying API first (migrations detected), then workers in parallel"

  deploy_servers "API" "$API_SERVICE_ID"
  if [ ${#WORKER_SERVERS[@]} -gt 0 ]; then
    deploy_servers "workers" "${WORKER_SERVERS[@]}"
  fi
else
  echo "📋 Deploying all services in parallel"
  if [ ${#WORKER_SERVERS[@]} -gt 0 ]; then
    deploy_servers "All" "$API_SERVICE_ID" "${WORKER_SERVERS[@]}"
  else
    deploy_servers "All" "$API_SERVICE_ID"
  fi
fi

echo "🎉 Deployment completed successfully!"
