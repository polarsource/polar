#!/bin/bash
# Startup script for Polar Web frontend in development mode
# This script handles dependency installation and starts Next.js with Turbopack.

set -euo pipefail

cd /app/clients

echo "=== Polar Web Frontend Startup ==="

# Always run pnpm install to ensure dependencies are installed
# pnpm is smart enough to skip if nothing changed
echo "Installing/verifying Node.js dependencies..."
pnpm install --frozen-lockfile

# Build packages that the web app depends on (in dependency order)
echo "Building workspace packages..."
pnpm --filter @polar-sh/client build
pnpm --filter @polar-sh/ui build
pnpm --filter @polar-sh/checkout build

# Start the requested mode
case "${1:-dev}" in
    dev)
        echo "Starting Next.js development server with Turbopack..."
        echo "Web will be available at http://localhost:3000"
        cd apps/web
        exec pnpm next dev --port 3000 --turbopack --hostname 0.0.0.0
        ;;
    build)
        echo "Building production bundle..."
        exec pnpm build
        ;;
    shell)
        echo "Starting shell..."
        exec /bin/bash
        ;;
    *)
        echo "Unknown mode: $1"
        echo "Available modes: dev, build, shell"
        exit 1
        ;;
esac
