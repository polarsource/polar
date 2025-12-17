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

# Build packages only if dist doesn't exist (they're built on host and mounted)
# This avoids OOM issues from DTS generation in container
echo "Checking workspace packages..."
if [[ ! -d "packages/client/dist" ]]; then
    echo "Building @polar-sh/client..."
    pnpm --filter @polar-sh/client build
else
    echo "@polar-sh/client already built"
fi

if [[ ! -d "packages/ui/dist" ]]; then
    echo "Building @polar-sh/ui..."
    pnpm --filter @polar-sh/ui build
else
    echo "@polar-sh/ui already built"
fi

if [[ ! -d "packages/checkout/dist" ]]; then
    echo "Building @polar-sh/checkout..."
    pnpm --filter @polar-sh/checkout build
else
    echo "@polar-sh/checkout already built"
fi

# Start the requested mode
case "${1:-dev}" in
    dev)
        echo "Starting Next.js development server..."
        echo "Web will be available at http://localhost:3000"
        echo ""
        echo "NOTE: Next.js with Turbopack requires significant memory (~4GB)."
        echo "If the container crashes, increase Docker Desktop memory to 10GB+."
        echo ""
        cd apps/web
        exec pnpm next dev --port 3000 --hostname 0.0.0.0
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
