#!/bin/bash

set -euo pipefail

IMG="ghcr.io/polarsource/polar@sha256:${1}"

curl -X POST \
        "https://api.render.com/deploy/srv-chsugv9mbg57s5u31btg?key=${RENDER_DEPLOY_KEY_WORKER}&imgURL=${IMG}"

