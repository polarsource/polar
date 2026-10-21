#!/bin/bash
set -euo pipefail

# Temporary eMudhra mitigation; recheck with the other workarounds in AGENTS.md.
# Match subject key IDs because certificate labels differ between distributions.
root_ids=(
  'pkcs11:id=%A0%11%0A%23%3E%96%F1%07%EC%E2%AF%29%EF%82%A5%7F%D0%30%A4%B4;type=cert'
  'pkcs11:id=%7C%5D%02%84%13%D4%CC%8A%9B%81%CE%17%1C%2E%29%1E%9C%48%63%42;type=cert'
)
root_files=(Comodo_AAA_Services_root.pem emSign_ECC_Root_CA_-_G3.pem)
blocklist=/etc/pki/ca-trust/source/blocklist
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

for i in "${!root_ids[@]}"; do
  trust extract --overwrite --format=pem-bundle \
    --filter="${root_ids[$i]}" "$work_dir/${root_files[$i]}"
done

install -d -m 0755 "$blocklist"
for filename in "${root_files[@]}"; do
  # An updated upstream store may omit a root. Never erase an existing blocklist.
  if [[ -s "$work_dir/$filename" ]]; then
    install -m 0644 "$work_dir/$filename" "$blocklist/$filename"
  fi
done
update-ca-trust extract

for root_id in "${root_ids[@]}"; do
  policy=$(trust list --filter="$root_id")
  if grep -q 'trust: anchor' <<< "$policy"; then
    echo "An affected CA is still trusted; refusing to continue." >&2
    exit 1
  fi
done

# Go caches system roots in-process; reload them on already-running routers.
if systemctl is-active --quiet tailscaled; then
  systemctl restart tailscaled
fi
