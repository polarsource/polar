#!/bin/bash

set -euo pipefail

IMG="ghcr.io/polarsource/polar@${1}"
declare -A servers=(
  ["srv-ci4r87h8g3ne0dmvvl60"]="${RENDER_DEPLOY_KEY_API}"
  ["srv-csth45d6l47c73ekphf0"]="${RENDER_DEPLOY_KEY_WORKER}"
  ["srv-ct0460ggph6c738go8i0"]="${RENDER_DEPLOY_KEY_WORKER_GITHUB}"
  ["srv-crkocgbtq21c73ddsdbg"]="${RENDER_DEPLOY_KEY_API_SANDBOX}"
  ["srv-csth45d6l47c73ekphdg"]="${RENDER_DEPLOY_KEY_WORKER_SANDBOX}"
  ["srv-ct0460ggph6c738go8d0"]="${RENDER_DEPLOY_KEY_WORKER_GITHUB_SANDBOX}"
)

for server_id in "${!servers[@]}"; do
  deploy_key=${servers[$server_id]}
  curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/${server_id}?key=${deploy_key}&imgURL=${IMG}"
done
