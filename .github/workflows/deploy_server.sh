#!/bin/bash

set -euo pipefail

IMG="ghcr.io/polarsource/polar@${1}"
declare -A servers=(
  ["srv-ci4r87h8g3ne0dmvvl60"]="${RENDER_DEPLOY_KEY_API}"
  ["srv-d089jj7diees73934ka0"]="${RENDER_DEPLOY_KEY_WORKER}"
  ["srv-crkocgbtq21c73ddsdbg"]="${RENDER_DEPLOY_KEY_API_SANDBOX}"
  ["srv-d089jj7diees73934kgg"]="${RENDER_DEPLOY_KEY_WORKER_SANDBOX}"
)

for server_id in "${!servers[@]}"; do
  deploy_key=${servers[$server_id]}
  curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/${server_id}?key=${deploy_key}&imgURL=${IMG}"
done
