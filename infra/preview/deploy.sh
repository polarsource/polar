#!/usr/bin/env bash
#
# Preview environment deploy script.
# Runs on the preview VM via SSH from GitHub Actions.
#
# Usage:
#   echo '{"pr_num":"123","branch":"...","sha":"...","env_b64":"..."}' | deploy.sh deploy
#   echo '{"pr_num":"123"}' | deploy.sh destroy
#
set -euo pipefail

PREVIEW_BASE="/srv/previews"
PREVIEW_TOOLS_DIR="/srv/preview-tools"
CADDY_PREVIEWS_DIR="/etc/caddy/previews"
REPO_URL="${POLAR_PREVIEW_REPO_URL:-https://github.com/polarsource/polar.git}"
VERCEL_PROJECT="${POLAR_PREVIEW_VERCEL_PROJECT:-polar-sandbox}"
VERCEL_SCOPE="${POLAR_PREVIEW_VERCEL_SCOPE:-polar-sh}"

# Get the Tailscale hostname for URLs
TS_HOSTNAME="$(tailscale status --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["Self"]["DNSName"].rstrip("."))')"

ACTION="${1:?Usage: deploy.sh <deploy|destroy>}"

# Read arguments from stdin JSON to avoid shell injection via branch names
INPUT=$(cat)

PR_NUM=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['pr_num'])")
if ! [[ "$PR_NUM" =~ ^[0-9]+$ ]]; then
    echo "Invalid PR number: ${PR_NUM}" >&2
    exit 1
fi

API_PORT=$((10000 + PR_NUM))
REDIS_PORT=$((16000 + PR_NUM))
PREVIEW_DIR="${PREVIEW_BASE}/pr-${PR_NUM}"
PREVIEW_PATH_PREFIX="pr-${PR_NUM}"

log() { echo "[preview:pr-${PR_NUM}] $*"; }

deploy() {
    local BRANCH SHA ENV_B64 ENV_JSON
    BRANCH=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['branch'])")
    SHA=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])")
    ENV_B64=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('env_b64',''))")
    ENV_JSON=""
    if [[ -n "$ENV_B64" ]]; then
        ENV_JSON=$(echo "$ENV_B64" | base64 -d)
    fi

    # Validate SHA is hex only
    if ! [[ "$SHA" =~ ^[0-9a-f]+$ ]]; then
        echo "Invalid SHA: ${SHA}" >&2
        exit 1
    fi

    local VERCEL_PREVIEW_URL
    VERCEL_PREVIEW_URL=$(echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('vercel_url',''))")
    if [[ -z "$VERCEL_PREVIEW_URL" ]]; then
        local BRANCH_SLUG
        BRANCH_SLUG=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
        VERCEL_PREVIEW_URL="https://${VERCEL_PROJECT}-git-${BRANCH_SLUG}-${VERCEL_SCOPE}.vercel.app"
        log "Warning: No vercel_url provided, using computed URL: ${VERCEL_PREVIEW_URL}"
    fi

    log "Deploying branch=${BRANCH} sha=${SHA}"

    local PREV_SHA=""
    if [[ -f "${PREVIEW_DIR}/.deployed_sha" ]]; then
        PREV_SHA=$(cat "${PREVIEW_DIR}/.deployed_sha")
    fi

    # --- Git checkout ---
    if [[ -d "${PREVIEW_DIR}/.git" ]]; then
        log "Updating existing checkout"
        if ! git -C "$PREVIEW_DIR" fetch origin "$BRANCH" 2>/dev/null; then
            log "Branch no longer exists on remote (PR likely merged), skipping deploy"
            exit 0
        fi
        git -C "$PREVIEW_DIR" checkout -f "$SHA"
    else
        log "Cloning fresh"
        mkdir -p "$PREVIEW_DIR"
        if ! git clone --depth 50 -b "$BRANCH" "$REPO_URL" "$PREVIEW_DIR" 2>/dev/null; then
            rm -rf "$PREVIEW_DIR"
            log "Branch no longer exists on remote (PR likely merged), skipping deploy"
            exit 0
        fi
        git -C "$PREVIEW_DIR" checkout -f "$SHA"
    fi

    # --- Detect what changed ---
    local BACKEND_CHANGED=true
    local FRONTEND_CHANGED=true
    if [[ -n "$PREV_SHA" ]] && [[ "$PREV_SHA" != "$SHA" ]]; then
        local CHANGED_FILES
        CHANGED_FILES=$(git -C "$PREVIEW_DIR" diff --name-only "$PREV_SHA" "$SHA" 2>/dev/null || echo "UNKNOWN")
        if [[ "$CHANGED_FILES" != "UNKNOWN" ]]; then
            if ! echo "$CHANGED_FILES" | grep -q '^server/'; then
                BACKEND_CHANGED=false
                log "No backend changes detected"
            fi
            if ! echo "$CHANGED_FILES" | grep -q '^clients/'; then
                FRONTEND_CHANGED=false
                log "No frontend changes detected"
            fi
        fi
    fi

    # Copy the run script from the pre-installed tools (not from the PR checkout)
    cp "${PREVIEW_TOOLS_DIR}/run-preview-backend.sh" "${PREVIEW_DIR}/server/run-preview-backend.sh"
    chmod +x "${PREVIEW_DIR}/server/run-preview-backend.sh"

    # --- Backend dependencies ---
    cd "${PREVIEW_DIR}/server"
    if [[ "$BACKEND_CHANGED" == "true" ]]; then
        log "Installing backend dependencies"
        uv sync --frozen

        log "Building email renderer"
        uv run task emails

        log "Building backoffice assets"
        uv run task backoffice
    fi

    # --- Backend .env (must be written before migrations) ---
    log "Writing backend .env"
    local PREVIEW_URL="https://${TS_HOSTNAME}/${PREVIEW_PATH_PREFIX}"
    cat > "${PREVIEW_DIR}/server/.env" <<DOTENV
POLAR_ENV=development
POLAR_BASE_URL=${PREVIEW_URL}
POLAR_FRONTEND_BASE_URL=${PREVIEW_URL}
POLAR_ALLOWED_HOSTS=["${TS_HOSTNAME}","${TS_HOSTNAME}:8443"]
POLAR_CORS_ORIGINS=["${PREVIEW_URL}","${VERCEL_PREVIEW_URL}"]
POLAR_CHECKOUT_BASE_URL=${PREVIEW_URL}/v1/checkout-links/{client_secret}/redirect
POLAR_USER_SESSION_COOKIE_DOMAIN=${TS_HOSTNAME}
POLAR_USER_SESSION_COOKIE_KEY=polar_sandbox_session

POLAR_PREVIEW_API_PORT=${API_PORT}
POLAR_REDIS_HOST=127.0.0.1
POLAR_REDIS_PORT=${REDIS_PORT}

POLAR_CURRENT_JWK_KID=polar_preview
POLAR_TINYBIRD_EVENTS_WRITE=true
POLAR_TINYBIRD_EVENTS_READ=true
POLAR_ROOT_PATH=/${PREVIEW_PATH_PREFIX}
DOTENV

    if [[ -n "$ENV_JSON" ]]; then
        echo "$ENV_JSON" | python3 -c "
import json, sys
for k, v in json.loads(sys.stdin.read()).items():
    print(f'{k}={v}')
" >> "${PREVIEW_DIR}/server/.env"
    fi

    # --- Generate JWKs if missing ---
    if [[ ! -f "${PREVIEW_DIR}/server/.jwks.json" ]]; then
        log "Generating JWKS"
        uv run python -m polar.kit.jwk polar_preview > "${PREVIEW_DIR}/server/.jwks.json"
    fi

    # --- Start Redis for migrations/seeds ---
    log "Starting Redis on port ${REDIS_PORT}"
    redis-server --bind 127.0.0.1 --port "$REDIS_PORT" --save "" --appendonly no --daemonize yes
    until redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; do sleep 0.2; done

    # --- Run migrations ---
    log "Running database migrations"
    uv run alembic upgrade head

    # --- Seed data (first deploy only) ---
    SEED_MARKER="${PREVIEW_DIR}/server/.seeds_loaded"
    if [[ ! -f "$SEED_MARKER" ]]; then
        log "Loading seed data (first deploy)"
        uv run task seeds_load
        touch "$SEED_MARKER"
    else
        log "Seed data already loaded, skipping"
    fi

    # Stop the temporary Redis — the backend service starts its own
    redis-cli -p "$REDIS_PORT" shutdown nosave 2>/dev/null || true

    # --- Frontend (disabled — using Vercel preview deployments instead) ---
    # cat > "${PREVIEW_DIR}/clients/apps/web/.env.local" <<DOTENV
    # POLAR_PREVIEW_BUILD=1
    # NEXT_PUBLIC_API_URL=${PREVIEW_URL}
    # NEXT_PUBLIC_FRONTEND_BASE_URL=${PREVIEW_URL}
    # NEXT_PUBLIC_BACKOFFICE_URL=${PREVIEW_URL}/backoffice
    # S3_UPLOAD_ORIGINS=
    # S3_PUBLIC_IMAGES_BUCKET_HOSTNAME=
    # DOTENV
    #
    # cat > "${PREVIEW_DIR}/clients/.env.preview" <<DOTENV
    # POLAR_PREVIEW_BUILD=1
    # NEXT_PUBLIC_API_URL=${PREVIEW_URL}
    # POLAR_API_URL=http://127.0.0.1:${API_PORT}
    # NEXT_PUBLIC_FRONTEND_BASE_URL=${PREVIEW_URL}
    # NEXT_PUBLIC_BACKOFFICE_URL=${PREVIEW_URL}/backoffice
    # PORT=${FRONTEND_LOCAL_PORT}
    # DOTENV
    #
    # if [[ "$FRONTEND_CHANGED" == "true" ]]; then
    #     log "Installing frontend dependencies"
    #     cd "${PREVIEW_DIR}/clients"
    #     pnpm install --frozen-lockfile
    # fi

    # --- Caddy config ---
    log "Configuring Caddy"
    local VERCEL_PREVIEW_HOST
    VERCEL_PREVIEW_HOST=$(echo "$VERCEL_PREVIEW_URL" | sed 's|https://||')
    sed \
        -e "s/__API_PORT__/${API_PORT}/g" \
        -e "s/__PR_NUM__/${PR_NUM}/g" \
        -e "s|__VERCEL_PREVIEW_URL__|https://${VERCEL_PREVIEW_HOST}|g" \
        -e "s/__VERCEL_PREVIEW_HOST__/${VERCEL_PREVIEW_HOST}/g" \
        -e "s/__TS_HOSTNAME__/${TS_HOSTNAME}/g" \
        "${PREVIEW_TOOLS_DIR}/caddy-preview.template" \
        > "${CADDY_PREVIEWS_DIR}/pr-${PR_NUM}.caddy"

    # Signal the root-owned infra service to regenerate caddy config and restart services.
    # The deploy user has no sudo — it can only create trigger files.
    log "Triggering infra update"
    touch "/srv/preview-triggers/pr-${PR_NUM}.deploy"

    for _i in $(seq 1 30); do
        [[ ! -f "/srv/preview-triggers/pr-${PR_NUM}.deploy" ]] && break
        sleep 1
    done
    if [[ -f "/srv/preview-triggers/pr-${PR_NUM}.deploy" ]]; then
        log "Warning: infra trigger not processed within 30s"
    fi

    echo "$SHA" > "${PREVIEW_DIR}/.deployed_sha"
    log "Deployed at ${PREVIEW_URL}"
}

destroy() {
    log "Destroying preview"

    rm -f "${CADDY_PREVIEWS_DIR}/pr-${PR_NUM}.caddy"

    touch "/srv/preview-triggers/pr-${PR_NUM}.destroy"
    for _i in $(seq 1 30); do
        [[ ! -f "/srv/preview-triggers/pr-${PR_NUM}.destroy" ]] && break
        sleep 1
    done

    rm -rf "$PREVIEW_DIR"

    log "Destroyed"
}

case "$ACTION" in
    deploy)  deploy ;;
    destroy) destroy ;;
    *)       echo "Unknown action: $ACTION" >&2; exit 1 ;;
esac
