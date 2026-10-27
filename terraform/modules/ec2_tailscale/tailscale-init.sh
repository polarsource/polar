#!/bin/bash
set -euo pipefail

region="$1"
secret_arn="$2"
hostname="$3"
tailscale_ssh="$4"
advertise_routes="$5"
advertise_tags="$6"

if [[ -n "$advertise_routes" ]]; then
  sysctl -p /etc/sysctl.d/99-tailscale.conf
fi

# Temporary eMudhra mitigation; recheck with the other workarounds in AGENTS.md.
trust extract --overwrite --format=pem-bundle \
  --filter='pkcs11:object=Comodo%20AAA%20Services%20root;type=cert' \
  /etc/pki/ca-trust/source/blocklist/Comodo_AAA_Services_root.pem
trust extract --overwrite --format=pem-bundle \
  --filter='pkcs11:object=emSign%20ECC%20Root%20CA%20-%20G3;type=cert' \
  /etc/pki/ca-trust/source/blocklist/emSign_ECC_Root_CA_-_G3.pem
update-ca-trust

curl --fail --silent --show-error --location --retry 5 \
  https://pkgs.tailscale.com/stable/amazon-linux/2023/tailscale.repo \
  --output /etc/yum.repos.d/tailscale.repo
dnf install -y tailscale
systemctl enable --now tailscaled

umask 077
auth_key_file=$(mktemp /run/tailscale-auth-key.XXXXXX)
trap 'rm -f "$auth_key_file"' EXIT

oauth_client_secret=$(AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=10 aws secretsmanager get-secret-value \
  --region "$region" \
  --secret-id "$secret_arn" \
  --query SecretString \
  --output text)

printf '%s?ephemeral=true&preauthorized=true' "$oauth_client_secret" > "$auth_key_file"
unset oauth_client_secret

tailscale up \
  --auth-key="file:$auth_key_file" \
  --hostname="$hostname" \
  --ssh="$tailscale_ssh" \
  --advertise-routes="$advertise_routes" \
  --advertise-tags="$advertise_tags" \
  --snat-subnet-routes=true \
  --accept-dns=false \
  --timeout=120s
