#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${TAILSCALE_OAUTH_SECRET:-}" ]]; then
  echo "TAILSCALE_OAUTH_SECRET is required" >&2
  exit 1
fi

TAILSCALE_STATE_DIR="${TAILSCALE_STATE_DIR:-/var/lib/tailscale}"
TAILSCALE_SOCKET="${TAILSCALE_SOCKET:-/var/run/tailscale/tailscaled.sock}"
TAILSCALE_HOSTNAME_PREFIX="${TAILSCALE_HOSTNAME_PREFIX:-fly-preview}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-${TAILSCALE_HOSTNAME_PREFIX}-$(hostname)}"
TAILSCALE_ADVERTISE_TAGS="${TAILSCALE_ADVERTISE_TAGS:-tag:ci}"
TAILSCALE_LOGIN_KEY="${TAILSCALE_OAUTH_SECRET}?ephemeral=true&preauthorized=true"

mkdir -p "$(dirname "$TAILSCALE_SOCKET")" "$TAILSCALE_STATE_DIR"

echo "Starting tailscaled..."
/usr/local/bin/tailscaled \
  --state="${TAILSCALE_STATE_DIR}/tailscaled.state" \
  --socket="$TAILSCALE_SOCKET" &

for _ in $(seq 1 50); do
  if [[ -S "$TAILSCALE_SOCKET" ]]; then
    break
  fi
  sleep 0.2
done

if [[ ! -S "$TAILSCALE_SOCKET" ]]; then
  echo "tailscaled socket was not created" >&2
  exit 1
fi

echo "Connecting to Tailscale as ${TAILSCALE_HOSTNAME}..."
/usr/local/bin/tailscale \
  --socket="$TAILSCALE_SOCKET" \
  up \
  --auth-key="${TAILSCALE_LOGIN_KEY}" \
  --hostname="${TAILSCALE_HOSTNAME}" \
  --advertise-tags="${TAILSCALE_ADVERTISE_TAGS}" \
  --accept-routes=true

exec "$@"
