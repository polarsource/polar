#!/bin/bash

set -euo pipefail

IMG="ghcr.io/polarsource/polar@${1}"

# Deploy worker-default
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-cojpsb0cmk4c73c0pndg?key=${RENDER_DEPLOY_KEY_WORKER_DEFAULT}&imgURL=${IMG}"

# Deploy worker-github
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-cojpsb0cmk4c73c0pne0?key=${RENDER_DEPLOY_KEY_WORKER_GITHUB}&imgURL=${IMG}"

# Deploy API
curl -X POST \
    --silent --show-error --fail-with-body \
    "https://api.render.com/deploy/srv-ci4r87h8g3ne0dmvvl60?key=${RENDER_DEPLOY_KEY_API}&imgURL=${IMG}"
