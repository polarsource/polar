#!/bin/sh
set -eu

if [ -n "${POLAR_WORKER_SECRETS_ARN:-}" ]; then
  secret_exports="$(python /var/runtime/export-secrets.py)"
  eval "$secret_exports"
fi

if [ -n "${POLAR_JWKS_CONTENT:-}" ] && [ -n "${POLAR_JWKS:-}" ]; then
  mkdir -p "$(dirname "$POLAR_JWKS")"
  printf "%s" "$POLAR_JWKS_CONTENT" > "$POLAR_JWKS"
fi

exec /lambda-entrypoint.sh "$@"
