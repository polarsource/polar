#!/usr/bin/env bash
#
# Preview environment deploy script.
# Runs on the preview VM via SSH from GitHub Actions.
#
# Usage:
#   deploy.sh deploy  <pr_num> <branch> <sha> [env_json_base64]
#   deploy.sh destroy <pr_num>
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

ACTION="${1:?Usage: deploy.sh <deploy|destroy> <pr_num> ...}"
PR_NUM="${2:?PR number required}"

API_PORT=$((10000 + PR_NUM))
FRONTEND_PORT=$((20000 + PR_NUM))
FRONTEND_LOCAL_PORT=$((30000 + PR_NUM))
REDIS_PORT=$((16000 + PR_NUM))
PREVIEW_DIR="${PREVIEW_BASE}/pr-${PR_NUM}"

log() { echo "[preview:pr-${PR_NUM}] $*"; }

deploy() {
    local BRANCH="${3:?Branch required}"
    local SHA="${4:?SHA required}"
    local ENV_B64="${5:-}"
    local ENV_JSON=""
    if [[ -n "$ENV_B64" ]]; then
        ENV_JSON=$(echo "$ENV_B64" | base64 -d)
    fi

    local BRANCH_SLUG
    BRANCH_SLUG=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
    local VERCEL_PREVIEW_URL="https://${VERCEL_PROJECT}-git-${BRANCH_SLUG}-${VERCEL_SCOPE}.vercel.app"

    log "Deploying branch=${BRANCH} sha=${SHA}"

    local PREV_SHA=""
    if [[ -f "${PREVIEW_DIR}/.deployed_sha" ]]; then
        PREV_SHA=$(cat "${PREVIEW_DIR}/.deployed_sha")
    fi

    # --- Git checkout ---
    if [[ -d "${PREVIEW_DIR}/.git" ]]; then
        log "Updating existing checkout"
        git -C "$PREVIEW_DIR" fetch origin "$BRANCH"
        git -C "$PREVIEW_DIR" checkout -f "$SHA"
    else
        log "Cloning fresh"
        mkdir -p "$PREVIEW_DIR"
        git clone --depth 50 -b "$BRANCH" "$REPO_URL" "$PREVIEW_DIR"
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

    # --- Sync preview tooling from checkout (do this early so service files are up to date) ---
    local INFRA_SRC="${PREVIEW_DIR}/infra/preview"
    log "Syncing preview tools from checkout"
    cp "${INFRA_SRC}/run-preview-backend.sh" "${PREVIEW_DIR}/server/run-preview-backend.sh"
    chmod +x "${PREVIEW_DIR}/server/run-preview-backend.sh"

    cp "${INFRA_SRC}/deploy.sh" "${PREVIEW_TOOLS_DIR}/deploy.sh"
    chmod +x "${PREVIEW_TOOLS_DIR}/deploy.sh"

    cp "${INFRA_SRC}/log-viewer.py" "${PREVIEW_TOOLS_DIR}/log-viewer.py"
    cp "${INFRA_SRC}/polar-preview-logs.service" /etc/systemd/system/

    cp "${INFRA_SRC}/polar-preview-backend@.service" /etc/systemd/system/
    cp "${INFRA_SRC}/polar-preview-frontend@.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable polar-preview-logs
    systemctl start polar-preview-logs

    # --- Backend dependencies ---
    cd "${PREVIEW_DIR}/server"
    if [[ "$BACKEND_CHANGED" == "true" ]]; then
        log "Installing backend dependencies"
        uv sync --frozen

        log "Building email renderer"
        uv run task emails
    fi

    # --- Backend .env (must be written before migrations) ---
    log "Writing backend .env"
    local PREVIEW_URL="https://${TS_HOSTNAME}:${FRONTEND_PORT}"
    cat > "${PREVIEW_DIR}/server/.env" <<DOTENV
POLAR_ENV=development
POLAR_BASE_URL=${PREVIEW_URL}
POLAR_FRONTEND_BASE_URL=${PREVIEW_URL}
POLAR_ALLOWED_HOSTS=["${TS_HOSTNAME}"]
POLAR_CORS_ORIGINS=["${PREVIEW_URL}","${VERCEL_PREVIEW_URL}"]
POLAR_CHECKOUT_BASE_URL=${PREVIEW_URL}/v1/checkout-links/{client_secret}/redirect
POLAR_USER_SESSION_COOKIE_DOMAIN=${TS_HOSTNAME}

POLAR_PREVIEW_API_PORT=${API_PORT}
POLAR_REDIS_HOST=127.0.0.1
POLAR_REDIS_PORT=${REDIS_PORT}

POLAR_CURRENT_JWK_KID=polar_preview
POLAR_TINYBIRD_EVENTS_WRITE=true
POLAR_TINYBIRD_EVENTS_READ=true
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

    # --- Frontend env (always write so runtime env is up to date) ---
    cat > "${PREVIEW_DIR}/clients/apps/web/.env.local" <<DOTENV
POLAR_PREVIEW_BUILD=1
NEXT_PUBLIC_API_URL=${PREVIEW_URL}
NEXT_PUBLIC_FRONTEND_BASE_URL=${PREVIEW_URL}
NEXT_PUBLIC_BACKOFFICE_URL=${PREVIEW_URL}/backoffice
S3_UPLOAD_ORIGINS=
S3_PUBLIC_IMAGES_BUCKET_HOSTNAME=
DOTENV

    cat > "${PREVIEW_DIR}/clients/.env.preview" <<DOTENV
POLAR_PREVIEW_BUILD=1
NEXT_PUBLIC_API_URL=${PREVIEW_URL}
POLAR_API_URL=http://127.0.0.1:${API_PORT}
NEXT_PUBLIC_FRONTEND_BASE_URL=${PREVIEW_URL}
NEXT_PUBLIC_BACKOFFICE_URL=${PREVIEW_URL}/backoffice
PORT=${FRONTEND_LOCAL_PORT}
DOTENV

    # --- Frontend dependencies ---
    if [[ "$FRONTEND_CHANGED" == "true" ]]; then
        log "Installing frontend dependencies"
        cd "${PREVIEW_DIR}/clients"
        pnpm install --frozen-lockfile
    fi

    # --- Caddy config ---
    log "Configuring Caddy"
    mkdir -p "$CADDY_PREVIEWS_DIR"
    sed \
        -e "s/__TS_HOSTNAME__/${TS_HOSTNAME}/g" \
        -e "s/__FRONTEND_PORT__/${FRONTEND_PORT}/g" \
        -e "s/__FRONTEND_LOCAL_PORT__/${FRONTEND_LOCAL_PORT}/g" \
        -e "s/__API_PORT__/${API_PORT}/g" \
        -e "s/__PR_NUM__/${PR_NUM}/g" \
        "${INFRA_SRC}/caddy-preview.template" \
        > "${CADDY_PREVIEWS_DIR}/pr-${PR_NUM}.caddy"

    systemctl reload caddy

    # --- Restart services ---
    # Backend always restarts (env JSON includes rotated DB password every deploy)
    log "Restarting services"
    systemctl enable "polar-preview-backend@${PR_NUM}" "polar-preview-frontend@${PR_NUM}"
    systemctl restart "polar-preview-backend@${PR_NUM}"
    if [[ "$FRONTEND_CHANGED" == "true" ]]; then
        systemctl restart "polar-preview-frontend@${PR_NUM}"
    fi

    echo "$SHA" > "${PREVIEW_DIR}/.deployed_sha"
    log "Deployed at ${PREVIEW_URL}"
}

destroy() {
    log "Destroying preview"

    systemctl stop "polar-preview-backend@${PR_NUM}" 2>/dev/null || true
    systemctl stop "polar-preview-frontend@${PR_NUM}" 2>/dev/null || true
    systemctl disable "polar-preview-backend@${PR_NUM}" 2>/dev/null || true
    systemctl disable "polar-preview-frontend@${PR_NUM}" 2>/dev/null || true

    rm -f "${CADDY_PREVIEWS_DIR}/pr-${PR_NUM}.caddy"
    systemctl reload caddy 2>/dev/null || true

    rm -rf "$PREVIEW_DIR"

    log "Destroyed"
}

case "$ACTION" in
    deploy)  deploy "$@" ;;
    destroy) destroy ;;
    *)       echo "Unknown action: $ACTION" >&2; exit 1 ;;
esac
