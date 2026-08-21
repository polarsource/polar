#!/usr/bin/env bash
#
# Builds the "polar-base" golden image on a fresh exe.dev VM.
# Non-interactive, but exe.dev setup scripts run unprivileged, so run it
# over SSH as root (see README.md):
#
#   ssh polar-base.exe.xyz "sudo git clone --depth 50 https://github.com/polarsource/polar.git /srv/polar && sudo bash /srv/polar/infra/preview/setup-base-vm.sh"
#
# Safe to re-run (idempotent). Tailscale is installed but NOT joined here:
# clones would duplicate the node identity. Each preview VM joins the
# tailnet on its first deploy (see deploy.sh). Secrets are not baked in
# either — the deploy workflow delivers them per VM via env_b64.
#
set -euo pipefail

CHECKOUT="/srv/polar"
PREVIEW_TOOLS_DIR="/srv/preview-tools"
REPO_URL="${POLAR_PREVIEW_REPO_URL:-https://github.com/polarsource/polar.git}"

if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root" >&2
    exit 1
fi

# --- Swap ---
echo "[1/8] Setting up swap..."
if [[ ! -f /swapfile ]]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
    swapon /swapfile 2>/dev/null || true
    echo "Swap already configured"
fi

mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=100M\n' > /etc/systemd/journald.conf.d/preview.conf

# --- System packages ---
echo "[2/8] Installing system packages..."
apt-get update
apt-get install -y \
    redis-server \
    git \
    curl \
    jq \
    rsync \
    util-linux \
    build-essential \
    libpq-dev

# One preview per VM: the system redis on 127.0.0.1:6379 is the preview's redis
systemctl enable redis-server
systemctl start redis-server

# --- Caddy ---
echo "[3/8] Installing Caddy..."
if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update
    apt-get install -y caddy
fi

# --- uv ---
echo "[4/8] Installing uv..."
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    cp -f /root/.local/bin/uv /usr/local/bin/uv
    cp -f /root/.local/bin/uvx /usr/local/bin/uvx
fi
echo "uv $(uv --version)"

# --- Node.js + pnpm ---
echo "[5/8] Installing Node.js and pnpm..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@latest --activate
echo "node $(node --version), pnpm $(pnpm --version)"

# --- Tailscale ---
echo "[6/8] Installing Tailscale..."
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
fi
systemctl enable --now tailscaled

# --- Repo checkout with warm dependencies and prebuilt assets ---
echo "[7/8] Cloning repo and warming dependencies..."
if [[ ! -d "${CHECKOUT}/.git" ]]; then
    git clone --depth 50 "$REPO_URL" "$CHECKOUT"
fi
cd "${CHECKOUT}/server"
uv sync --frozen
uv run task emails
uv run task backoffice
cd "${CHECKOUT}/clients"
pnpm install --frozen-lockfile
git -C "$CHECKOUT" rev-parse HEAD > "${CHECKOUT}/.deployed_sha"

# --- Preview tools, Caddy config, systemd units ---
echo "[8/8] Installing preview tools and services..."
mkdir -p "$PREVIEW_TOOLS_DIR"
for f in deploy.sh run-preview-backend.sh log-viewer.py; do
    install -m 755 "${CHECKOUT}/infra/preview/${f}" "${PREVIEW_TOOLS_DIR}/${f}"
done

cp "${CHECKOUT}/infra/preview/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

for f in polar-backend.service polar-frontend.service polar-logs.service polar-seed-simple-complement.service; do
    cp "${CHECKOUT}/infra/preview/${f}" "/etc/systemd/system/${f}"
done
systemctl daemon-reload
# polar-backend/-frontend are enabled but not started: they need the .env
# files written by the first deploy
systemctl enable polar-backend polar-frontend
systemctl enable --now polar-logs

apt-get clean
journalctl --vacuum-size=50M >/dev/null 2>&1 || true

echo ""
echo "========================================="
echo "  polar-base image ready"
echo "========================================="
echo ""
echo "Next steps (from your machine):"
echo "  1. Verify the share port is 8000 (Caddy): ssh exe.dev share port polar-base 8000"
echo "  2. Grant team access:                     ssh exe.dev share add polar-base <email>"
echo "  3. Clone a preview VM:                    ssh exe.dev cp polar-base pr-<N>"
echo ""
echo "To refresh this image later (new deps/assets), re-run this script on the VM,"
echo "or delete polar-base and rebuild it from scratch (see README.md)."
echo ""
