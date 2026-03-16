#!/usr/bin/env bash
#
# Setup script for a preview environment VM.
# Run as root on Ubuntu 24.04. Safe to re-run (idempotent).
#
# Sets up: swap, caddy, redis, uv, node/pnpm, tailscale, deploy user + SSH
# keypair, preview tools, and directory structure.
#
# Preview tools (deploy.sh, caddy template, systemd units) are installed
# from this directory during setup. They are NOT synced from PR checkouts
# to prevent untrusted code from modifying infrastructure. To update them,
# re-run this script or manually install updated files to /srv/preview-tools/.
#
set -euo pipefail

DEPLOY_USER="deploy"
PREVIEW_TOOLS_DIR="/srv/preview-tools"
PREVIEW_DIR="/srv/previews"

if [[ $EUID -ne 0 ]]; then
    echo "This script must be run as root" >&2
    exit 1
fi

# --- Collect inputs ---
read -rp "Tailscale auth key (tskey-auth-...): " TAILSCALE_AUTH_KEY
read -rp "Tailscale tags (e.g. tag:preview) [tag:preview]: " TAILSCALE_TAGS
TAILSCALE_TAGS="${TAILSCALE_TAGS:-tag:preview}"

echo ""
echo "=== Setting up preview VM ==="
echo "TS tags: ${TAILSCALE_TAGS}"
echo ""

# --- Swap ---
echo "[1/8] Setting up swap..."
if [[ ! -f /swapfile ]]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
    swapon /swapfile 2>/dev/null || true
    echo "Swap already configured"
fi

# --- System packages ---
echo "[2/8] Installing system packages..."
apt-get update
apt-get install -y \
    redis-server \
    git \
    curl \
    jq \
    rsync \
    build-essential \
    libpq-dev

# Disable the global redis-server — each preview runs its own
if systemctl is-active --quiet redis-server 2>/dev/null; then
    systemctl stop redis-server
fi
systemctl disable redis-server 2>/dev/null || true

# --- Caddy ---
echo "[3/8] Installing Caddy with Tailscale plugin..."
if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https golang-go
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-xcaddy-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/xcaddy/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-xcaddy.list
    apt-get update
    apt-get install -y xcaddy

    xcaddy build --with github.com/tailscale/caddy-tailscale
    mv caddy /usr/bin/caddy
    caddy version
fi

mkdir -p /etc/caddy/previews

# Generate a preview access token for gating funnel (public internet) access.
# Tailnet users get full access via tailscale serve on :443.
# Vercel SSR reaches the API via tailscale funnel on :8443, gated by this token.
if [[ ! -f /etc/caddy/env ]]; then
    PREVIEW_ACCESS_TOKEN=$(openssl rand -hex 32)
    echo "POLAR_PREVIEW_ACCESS_TOKEN=${PREVIEW_ACCESS_TOKEN}" > /etc/caddy/env
    chmod 600 /etc/caddy/env
    echo ""
    echo "Generated preview access token: ${PREVIEW_ACCESS_TOKEN}"
    echo "Add to GitHub secrets: POLAR_PREVIEW_ACCESS_TOKEN"
    echo "Add to Vercel env vars: POLAR_PREVIEW_ACCESS_TOKEN"
    echo ""
fi

cat > /etc/caddy/Caddyfile <<'CADDYFILE'
:80 {
	import /etc/caddy/previews/*.caddy
}
:8080 {
	route {
		@no_token not header X-Preview-Token {$POLAR_PREVIEW_ACCESS_TOKEN}
		respond @no_token "Forbidden" 403
		import /etc/caddy/previews/*.caddy
	}
}
CADDYFILE

# Create systemd service for caddy
cat > /etc/systemd/system/caddy.service <<'UNIT'
[Unit]
Description=Caddy
After=network.target tailscaled.service

[Service]
Type=notify
EnvironmentFile=/etc/caddy/env
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable caddy
systemctl start caddy || true

# --- uv ---
echo "[4/8] Installing uv..."
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi
cp -f /root/.local/bin/uv /usr/local/bin/uv
cp -f /root/.local/bin/uvx /usr/local/bin/uvx
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
echo "[6/8] Setting up Tailscale..."
if ! command -v tailscale &>/dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
fi
if ! tailscale status &>/dev/null; then
    tailscale up \
        --auth-key="$TAILSCALE_AUTH_KEY" \
        --advertise-tags="$TAILSCALE_TAGS" \
        --hostname="polar-preview-vm"
else
    echo "Tailscale already connected"
fi
echo "Tailscale IP: $(tailscale ip -4)"

TS_HOSTNAME="$(tailscale status --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["Self"]["DNSName"].rstrip("."))')"

# Port 443: tailscale serve (tailnet only) → Caddy :80 (full access)
# Port 8443: tailscale funnel (public) → Caddy :8080 (token-gated API for Vercel SSR)
tailscale serve reset
tailscale serve --bg --https=443 localhost:80
tailscale funnel --bg --https=8443 localhost:8080

# --- Deploy user ---
echo "[7/8] Creating deploy user and SSH keypair..."
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$DEPLOY_USER"
fi

SSH_DIR="/home/${DEPLOY_USER}/.ssh"
KEY_FILE="${SSH_DIR}/preview_deploy_key"
mkdir -p "$SSH_DIR"

if [[ ! -f "$KEY_FILE" ]]; then
    ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "polar-preview-deploy"
    cat "$KEY_FILE.pub" >> "${SSH_DIR}/authorized_keys"
fi
chmod 700 "$SSH_DIR"
chmod 600 "${SSH_DIR}/authorized_keys" "$KEY_FILE"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$SSH_DIR"

rm -f /etc/sudoers.d/polar-preview

# --- Preview tools and directories ---
echo "[8/8] Setting up preview tools and directories..."
mkdir -p "$PREVIEW_TOOLS_DIR" "$PREVIEW_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in deploy.sh run-preview-backend.sh caddy-preview.template log-viewer.py regenerate-caddyfile.sh process-preview-triggers.sh; do
    if [[ -f "${SCRIPT_DIR}/${f}" ]]; then
        install -m 755 "${SCRIPT_DIR}/${f}" "${PREVIEW_TOOLS_DIR}/${f}"
    fi
done

for f in polar-preview-backend@.service polar-preview-frontend@.service polar-preview-logs.service polar-preview-infra.path polar-preview-infra.service; do
    if [[ -f "${SCRIPT_DIR}/${f}" ]]; then
        cp "${SCRIPT_DIR}/${f}" "/etc/systemd/system/${f}"
    fi
done
systemctl daemon-reload
systemctl enable polar-preview-logs polar-preview-infra.path
systemctl start polar-preview-logs 2>/dev/null || true
systemctl start polar-preview-infra.path

mkdir -p /srv/preview-triggers
chown "${DEPLOY_USER}:${DEPLOY_USER}" /srv/preview-triggers
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$PREVIEW_DIR"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" /etc/caddy/previews

echo ""
echo "========================================="
echo "  VM setup complete!"
echo "========================================="
echo ""
echo "Tailscale hostname: ${TS_HOSTNAME}"
echo ""
echo "Add to GitHub secrets:"
echo "  POLAR_PREVIEW_HOST = $(tailscale ip -4)"
echo "  POLAR_PREVIEW_SSH_KEY = (contents below)"
echo ""
echo "--- Private key (add as POLAR_PREVIEW_SSH_KEY) ---"
cat "$KEY_FILE"
echo ""
echo "--- Public key (already in authorized_keys) ---"
cat "${KEY_FILE}.pub"
echo ""
echo "Add to GitHub variables:"
echo "  POLAR_PREVIEW_USER = ${DEPLOY_USER}"
echo ""
