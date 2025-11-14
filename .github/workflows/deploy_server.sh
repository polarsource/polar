#!/bin/bash

set -euo pipefail

# Usage: ./deploy_server.sh <docker_digest> <has_migrations> <api_service_id> <worker_service_ids>
if [ $# -lt 4 ]; then
  echo "Usage: $0 <docker_digest> <has_migrations> <api_service_id> <worker_service_ids>"
  echo "Example: $0 sha256:abc123... true srv-123 srv-456,srv-789"
  exit 1
fi

IMG="ghcr.io/polarsource/polar@${1}"
HAS_MIGRATIONS="${2}"
API_SERVICE_ID="${3}"
WORKER_SERVICE_IDS="${4}"

# Convert worker service IDs from comma-separated string to array
IFS=',' read -ra WORKER_SERVERS <<< "$WORKER_SERVICE_IDS"

# Configuration
TIMEOUT=300  # 5 minutes timeout
POLL_INTERVAL=5  # Check every 5 seconds

# Function to check deployment status
check_deployment_status() {
  local service_id=$1
  local deploy_id=$2
  local response

  response=$(curl -s -X GET \
    -H "Accept: application/json" \
    -H "Authorization: Bearer ${RENDER_API_TOKEN}" \
    "https://api.render.com/v1/services/${service_id}/deploys/${deploy_id}" \
    | jq -r '.status' 2>/dev/null)

  echo "$response"
}

# Function to deploy a set of servers
deploy_servers() {
  local -n servers_ref=$1
  local services=${2:-"unknown"}
  local environment=${3:-"unknown"}

  echo "🚀 Starting deployment of ${services} to ${environment}..."

  # Trigger deployments
  local -A deploy_map=()  # Maps service_id to deploy_id
  for server_id in "${servers_ref[@]}"; do
    echo "  Triggering deployment for ${server_id}..."

    # Use API to get deploy ID
    deploy_response=$(curl -s -X POST \
      -H "Accept: application/json" \
      -H "Authorization: Bearer ${RENDER_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"imageUrl\":\"${IMG}\"}" \
      "https://api.render.com/v1/services/${server_id}/deploys")

    deploy_id=$(echo "$deploy_response" | jq -r '.id' 2>/dev/null)
    if [[ "$deploy_id" != "null" && -n "$deploy_id" ]]; then
      deploy_map["$server_id"]="$deploy_id"
      echo "    Deploy ID: ${deploy_id}"
    else
      echo "    ❌ Failed to trigger deployment for ${server_id}"
      echo "    Response: ${deploy_response}"
      exit 1
    fi
  done

  # Wait for deployments to complete
  echo "⏳ Waiting for ${services} in ${environment} deployments to complete..."

  local start_time=$(date +%s)
  local all_complete=false

  while [[ $all_complete == false ]]; do
    all_complete=true

    for server_id in "${!deploy_map[@]}"; do
      deploy_id="${deploy_map[$server_id]}"
      status=$(check_deployment_status "$server_id" "$deploy_id")

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
      local current_time=$(date +%s)
      local elapsed=$((current_time - start_time))

      if [[ $elapsed -gt $TIMEOUT ]]; then
        echo "❌ Deployment timeout after ${TIMEOUT} seconds"
        exit 1
      fi

      echo "  Checking again in ${POLL_INTERVAL} seconds..."
      sleep $POLL_INTERVAL
    fi
  done

  echo "✅ ${services} deployments completed successfully!"
}

# Deploy based on migration status
if [ "$HAS_MIGRATIONS" = "true" ]; then
  echo "📋 Deploying sequentially (migrations detected)"

  # Deploy API first (runs migrations via preDeployCommand)
  api_server=("$API_SERVICE_ID")
  deploy_servers api_server "API" "environment"

  # Deploy workers after API completes
  if [ ${#WORKER_SERVERS[@]} -gt 0 ]; then
    deploy_servers WORKER_SERVERS "workers" "environment"
  fi
else
  echo "📋 Deploying all services in parallel"

  # Deploy all services in parallel
  all_servers=("$API_SERVICE_ID" "${WORKER_SERVERS[@]}")
  deploy_servers all_servers "All" "environment"
fi

echo "🎉 Deployment completed successfully!"
