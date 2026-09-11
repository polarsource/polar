#!/bin/bash
set -euo pipefail
umask 077

: "${POLAR_BACKOFFICE_HOST:?Set the private backoffice hostname}"
tailscale_oauth_secret="${TS_AUTHKEY:?Set the Tailscale OAuth client secret}"
cloudflare_api_token="${CLOUDFLARE_API_TOKEN:?Set a DNS token scoped to the polar.sh zone}"
unset TS_AUTHKEY CLOUDFLARE_API_TOKEN

children=()
start() {
  "$@" &
  children+=("$!")
}

# shellcheck disable=SC2329
cleanup() {
  kill "${children[@]}" 2>/dev/null || true
  wait "${children[@]}" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' TERM INT

TS_KUBE_SECRET="" TS_AUTHKEY="$tailscale_oauth_secret" start containerboot

start uv run uvicorn polar.app:app \
  --host 127.0.0.1 --port 10000 --workers 1 \
  --proxy-headers --forwarded-allow-ips=127.0.0.1 \
  --no-access-log --timeout-graceful-shutdown 30

for port in 9002 10000; do
  start curl --fail --silent --show-error --output /dev/null --noproxy '*' \
    --retry 60 --retry-all-errors --retry-delay 1 --retry-max-time 60 --max-time 2 \
    "http://127.0.0.1:$port/healthz"
  wait "${children[-1]}"
  unset 'children[-1]'
done

CLOUDFLARE_API_TOKEN="$cloudflare_api_token" \
  start caddy run --config /etc/secrets/Caddyfile --adapter caddyfile

wait -n "${children[@]}"
exit 1
