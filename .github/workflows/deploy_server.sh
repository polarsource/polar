#!/bin/bash

set -euo pipefail

IMG="ghcr.io/polarsource/polar@${1}"

# Deploy api
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-ci4r87h8g3ne0dmvvl60?key=${RENDER_DEPLOY_KEY_API}&imgURL=${IMG}"

# Deploy worker
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-csth45d6l47c73ekphf0?key=${RENDER_DEPLOY_KEY_WORKER}&imgURL=${IMG}"

# Deploy api-sandbox
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-crkocgbtq21c73ddsdbg?key=${RENDER_DEPLOY_KEY_API_SANDBOX}&imgURL=${IMG}"

# Deploy worker-sandbox
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-csth45d6l47c73ekphdg?key=${RENDER_DEPLOY_KEY_WORKER_SANDBOX}&imgURL=${IMG}"
