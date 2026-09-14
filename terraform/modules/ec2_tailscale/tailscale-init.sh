#!/bin/bash
set -euo pipefail

region="$1"
secret_arn="$2"
hostname="$3"
tailscale_ssh="$4"
advertise_routes="$5"

if [[ -n "$advertise_routes" ]]; then
  sysctl -p /etc/sysctl.d/99-tailscale.conf
fi

curl --fail --silent --show-error --location --retry 5 \
  https://pkgs.tailscale.com/stable/amazon-linux/2023/tailscale.repo \
  --output /etc/yum.repos.d/tailscale.repo
dnf install -y tailscale
systemctl enable --now tailscaled

umask 077
auth_key_file=$(mktemp /run/tailscale-auth-key.XXXXXX)
trap 'rm -f "$auth_key_file"' EXIT

AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=10 aws secretsmanager get-secret-value \
  --region "$region" \
  --secret-id "$secret_arn" \
  --query SecretString \
  --output text > "$auth_key_file"

tailscale up \
  --auth-key="file:$auth_key_file" \
  --hostname="$hostname" \
  --ssh="$tailscale_ssh" \
  --advertise-routes="$advertise_routes" \
  --snat-subnet-routes=true \
  --accept-dns=false \
  --timeout=120s
