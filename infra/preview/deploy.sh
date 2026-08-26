#!/usr/bin/env bash
#
# Preview environment deploy script.
# Runs on a per-PR exe.dev VM (cloned from polar-base) via SSH from
# GitHub Actions. Destroy is not handled here: tearing down a preview
# deletes the whole VM (ssh exe.dev rm pr-N).
#
# Usage:
#   echo '{"pr_num":"123","branch":"...","sha":"...","env_b64":"...","base_url":"https://pr-123.exe.xyz","ts_authkey":"tskey-auth-..."}' | deploy.sh
#
set -euo pipefail

CHECKOUT="/srv/polar"
API_PORT=10000
FRONTEND_PORT=3000
SEED_COMPLEMENT_UNIT=polar-seed-simple-complement
SEED_COMPLEMENT_LOCK=/run/lock/polar-seed-simple-complement.lock

# Read arguments from stdin JSON to avoid shell injection via branch names
INPUT=$(cat)
json_field() {
    echo "$INPUT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('$1',''))"
}

PR_NUM=$(json_field pr_num)
if ! [[ "$PR_NUM" =~ ^[0-9]+$ ]]; then
    echo "Invalid PR number: ${PR_NUM}" >&2
    exit 1
fi

log() { echo "[preview:pr-${PR_NUM}] $*"; }

BRANCH=$(json_field branch)
SHA=$(json_field sha)
if ! [[ "$SHA" =~ ^[0-9a-f]+$ ]]; then
    echo "Invalid SHA: ${SHA}" >&2
    exit 1
fi

ENV_B64=$(json_field env_b64)
ENV_JSON=""
if [[ -n "$ENV_B64" ]]; then
    ENV_JSON=$(echo "$ENV_B64" | base64 -d)
fi

# --- Tailscale join (first deploy on a fresh clone) ---
# Needed to reach the shared preview Postgres. ts_authkey is an OAuth
# client secret used as an ephemeral tagged auth key, so deleted VMs
# disappear from the tailnet on their own.
systemctl start tailscaled
if ! tailscale status >/dev/null 2>&1; then
    TS_AUTHKEY=$(json_field ts_authkey)
    TS_TAGS=$(json_field ts_tags)
    if [[ -z "$TS_AUTHKEY" ]]; then
        echo "Tailscale not connected and no ts_authkey provided" >&2
        exit 1
    fi
    if [[ "$TS_AUTHKEY" == tskey-client-* && "$TS_AUTHKEY" != *\?* ]]; then
        TS_AUTHKEY="${TS_AUTHKEY}?ephemeral=true&preauthorized=true"
    fi
    log "Joining tailnet"
    tailscale up \
        --auth-key="$TS_AUTHKEY" \
        --advertise-tags="${TS_TAGS:-tag:preview}" \
        --accept-routes \
        --hostname="pr-${PR_NUM}"
fi

# Previews are served tailnet-only: Caddy terminates TLS on 443 with a
# MagicDNS cert fetched from tailscaled (get_certificate tailscale).
tailscale set --operator=caddy

PREVIEW_HOST="$(tailscale status --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["Self"]["DNSName"].rstrip("."))')"
BASE_URL="https://${PREVIEW_HOST}"

log "Deploying branch=${BRANCH} sha=${SHA}"

exec 9>"$SEED_COMPLEMENT_LOCK"
if ! flock --timeout 900 9; then
    log "Simple-complement seed did not finish within 15 minutes"
    exit 1
fi

PREV_SHA=""
if [[ -f "${CHECKOUT}/.deployed_sha" ]]; then
    PREV_SHA=$(cat "${CHECKOUT}/.deployed_sha")
fi

# --- Git checkout ---
if ! git -C "$CHECKOUT" fetch origin "$BRANCH" 2>/dev/null; then
    log "Branch no longer exists on remote (PR likely merged), skipping deploy"
    exit 0
fi
if [[ "$(git -C "$CHECKOUT" rev-parse FETCH_HEAD 2>/dev/null || true)" != "$SHA" ]]; then
    log "Commit ${SHA} is gone from the remote (branch force-pushed), skipping superseded deploy"
    exit 0
fi
git -C "$CHECKOUT" checkout -f "$SHA"

# --- Detect what changed ---
CHANGED_FILES="UNKNOWN"
if [[ -n "$PREV_SHA" ]] && [[ "$PREV_SHA" != "$SHA" ]]; then
    CHANGED_FILES=$(git -C "$CHECKOUT" diff --name-only "$PREV_SHA" "$SHA" 2>/dev/null || echo "UNKNOWN")
fi

# True when the previous SHA is unknown, so an undiffable deploy rebuilds everything
changed() {
    [[ "$CHANGED_FILES" == "UNKNOWN" ]] && return 0
    printf '%s\n' "$CHANGED_FILES" | grep -E "$1" >/dev/null
}

BACKEND_CHANGED=true
if ! changed '^server/'; then
    BACKEND_CHANGED=false
    log "No backend changes detected"
fi

# --- Backend dependencies ---
cd "${CHECKOUT}/server"
if [[ "$BACKEND_CHANGED" == "true" ]]; then
    log "Installing backend dependencies"
    uv sync --frozen
fi

# Build outputs are gitignored, so they can be missing even when the sources
# are unchanged.
if changed '^server/emails/' || [[ ! -x "${CHECKOUT}/server/emails/bin/react-email-pkg" ]]; then
    log "Building email renderer"
    uv run task emails
fi

if changed '^server/polar/backoffice/' || [[ ! -f "${CHECKOUT}/server/polar/backoffice/static/styles.css" ]]; then
    log "Building backoffice assets"
    uv run task backoffice
fi

# --- Frontend dependencies ---
# next dev resolves packages through their source or dist JS, never their
# type declarations, so skip the tsup DTS pass: it dominates the build.
export POLAR_SKIP_DTS=1
cd "${CHECKOUT}/clients"
if changed '^clients/(pnpm-lock\.yaml|patches/|.*/package\.json)' || [[ ! -d node_modules ]]; then
    log "Installing frontend dependencies"
    pnpm install --frozen-lockfile
fi

log "Building frontend packages"
pnpm exec turbo run build --filter='./packages/*'
cd "${CHECKOUT}/server"

# --- Backend .env (must be written before migrations) ---
log "Writing backend .env"
cat > "${CHECKOUT}/server/.env" <<DOTENV
POLAR_ENV=development
POLAR_BASE_URL=${BASE_URL}
POLAR_FRONTEND_BASE_URL=${BASE_URL}
POLAR_ALLOWED_HOSTS=["${PREVIEW_HOST}"]
POLAR_CORS_ORIGINS=["${BASE_URL}"]
POLAR_CHECKOUT_BASE_URL=${BASE_URL}/v1/checkout-links/{client_secret}/redirect
POLAR_USER_SESSION_COOKIE_DOMAIN=${PREVIEW_HOST}
POLAR_AUTHENTICATION_SESSION_COOKIE_DOMAIN=${PREVIEW_HOST}

POLAR_PREVIEW_API_PORT=${API_PORT}
POLAR_REDIS_HOST=127.0.0.1
POLAR_REDIS_PORT=6379

POLAR_CURRENT_JWK_KID=polar_preview
POLAR_TURNSTILE_SECRET=1x0000000000000000000000000000000AA
POLAR_TINYBIRD_EVENTS_WRITE=true
POLAR_TINYBIRD_EVENTS_READ=true
DOTENV

if [[ -n "$ENV_JSON" ]]; then
    echo "$ENV_JSON" | python3 -c "
import json, sys
for k, v in json.loads(sys.stdin.read()).items():
    print(f'{k}={v}')
" >> "${CHECKOUT}/server/.env"
fi

# --- Frontend .env ---
log "Writing frontend .env"
cat > "${CHECKOUT}/clients/apps/web/.env.local" <<DOTENV
NEXT_PUBLIC_API_URL=${BASE_URL}
NEXT_PUBLIC_FRONTEND_BASE_URL=${BASE_URL}
NEXT_PUBLIC_BACKOFFICE_URL=${BASE_URL}/backoffice
POLAR_API_URL=http://127.0.0.1:${API_PORT}
S3_UPLOAD_ORIGINS=
S3_PUBLIC_IMAGES_BUCKET_HOSTNAME=
DOTENV

cat > "${CHECKOUT}/clients/.env.preview" <<DOTENV
PORT=${FRONTEND_PORT}
DOTENV

# --- Generate JWKS (per VM: a clone must not share the base image's keys) ---
if [[ ! -f "${CHECKOUT}/server/.jwks.json" ]] || [[ "$(cat "${CHECKOUT}/server/.jwks.host" 2>/dev/null)" != "$(hostname)" ]]; then
    log "Generating JWKS"
    uv run python -m polar.kit.jwk polar_preview > "${CHECKOUT}/server/.jwks.json"
    hostname > "${CHECKOUT}/server/.jwks.host"
fi

# --- Run migrations ---
systemctl start redis-server
log "Running database migrations"
uv run alembic upgrade head

# --- Readiness-critical seed data ---
log "Loading readiness-critical seed data"
uv run task seeds_load --phase simple

# --- Restart services ---
log "Restarting services"
systemctl restart polar-backend polar-frontend

# --- Deferred demo and analytics data ---
systemctl reset-failed "$SEED_COMPLEMENT_UNIT" 2>/dev/null || true
systemctl restart --no-block "$SEED_COMPLEMENT_UNIT"
log "Simple-complement seed started; status at ${BASE_URL}/_logs/seed"

echo "$SHA" > "${CHECKOUT}/.deployed_sha"
log "Deployed at ${BASE_URL}"
