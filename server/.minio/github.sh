#!/bin/bash
set -euo pipefail

# minio/minio was archived on 2026-04-25 and dl.min.io's TLS certificate expired
# on 2026-07-10, so `mc` is fetched from a pinned GitHub release and verified.
MC_RELEASE="RELEASE.2025-08-13T08-35-41Z"
MC_BASE="https://github.com/minio/mc/releases/download/${MC_RELEASE}"

curl -fsSL -o mc "${MC_BASE}/mc.linux-amd64.${MC_RELEASE}"
curl -fsSL -o mc.sha256sum "${MC_BASE}/mc.linux-amd64.${MC_RELEASE}.sha256sum"
echo "$(cut -d' ' -f1 mc.sha256sum)  mc" | sha256sum -c -

chmod +x mc

export CMD_MC=./mc
bash ./configure.sh
