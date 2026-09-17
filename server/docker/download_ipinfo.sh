#!/bin/sh
set -eu

mkdir /data
access_token=$(cat /run/secrets/IPINFO_ACCESS_TOKEN)
expected_sha256=$(curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb/checksums?token=${access_token}" | jq -r '.checksums.sha256')
curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb?token=${access_token}" -o /data/country_asn.mmdb
printf '%s  /data/country_asn.mmdb\n' "$expected_sha256" | sha256sum -c -
