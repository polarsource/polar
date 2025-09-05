#!/bin/bash

set -euo pipefail

# Usage: ./deploy_server.sh <docker_digest> <service_id_1> [service_id_2] [service_id_n]
if [ $# -lt 2 ]; then
  echo "Usage: $0 <docker_digest> <service_id_1> [service_id_2] [service_id_n]"
  echo "Example: $0 sha256:abc123... srv-123 srv-456"
  exit 1
fi

IMG="ghcr.io/polarsource/polar@${1}"
shift # Remove the first argument, leaving only service IDs

# Read service IDs from remaining arguments
declare -a servers=("$@")

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
  local environment=${2:-"unknown"}

  echo "🚀 Starting deployment to ${environment}..."

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
  echo "⏳ Waiting for ${environment} deployments to complete..."

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

  echo "✅ All deployments completed successfully!"
}

# Deploy the provided servers
deploy_servers servers "environment"

echo "🎉 Deployment completed successfully!"
