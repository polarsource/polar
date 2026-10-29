#!/bin/bash
set -euo pipefail

region="$1"
secret_arn="$2"
hostname="$3"
tailscale_ssh="$4"
advertise_routes="$5"
advertise_tags="$6"
tailscale_version="$7"
split_dns_domain="$8"
oauth_client_id="$9"

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
dnf install -y "tailscale-${tailscale_version}"
systemctl enable --now tailscaled

umask 077
auth_key_file=$(mktemp /run/tailscale-auth-key.XXXXXX)
client_secret_file=$(mktemp /run/tailscale-client-secret.XXXXXX)
api_header_file=$(mktemp /run/tailscale-api-header.XXXXXX)
trap 'rm -f "$auth_key_file" "$client_secret_file" "$api_header_file"' EXIT

oauth_client_secret=$(AWS_RETRY_MODE=standard AWS_MAX_ATTEMPTS=10 aws secretsmanager get-secret-value \
  --region "$region" \
  --secret-id "$secret_arn" \
  --query SecretString \
  --output text)

printf '%s?ephemeral=true&preauthorized=true' "$oauth_client_secret" > "$auth_key_file"
printf '%s' "$oauth_client_secret" > "$client_secret_file"
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

if [[ -n "$split_dns_domain" ]]; then
  dnf install -y dnsmasq jq
  cat > /etc/dnsmasq.conf <<EOF
interface=tailscale0
bind-dynamic
no-resolv
server=/$split_dns_domain/169.254.169.253
EOF
  systemctl enable dnsmasq
  systemctl restart dnsmasq

  access_token=$(curl --fail --silent --show-error --retry 5 \
    --data grant_type=client_credentials \
    --data-urlencode "client_id=$oauth_client_id" \
    --data-urlencode "client_secret@$client_secret_file" \
    https://api.tailscale.com/api/v2/oauth/token |
    jq --raw-output --exit-status .access_token)
  printf 'Authorization: Bearer %s' "$access_token" > "$api_header_file"
  unset access_token

  curl --fail --silent --show-error --retry 5 \
    --request PATCH \
    --header "@$api_header_file" \
    --header 'Content-Type: application/json' \
    --data "{\"$split_dns_domain\": [\"$(tailscale ip -4)\"]}" \
    https://api.tailscale.com/api/v2/tailnet/-/dns/split-dns
fi
