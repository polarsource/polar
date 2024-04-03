#! /bin/bash

set -euo pipefail
set -x

# Create test database
./bin/create-test-db

# Server setup
cd /workspace/server
poetry install
poetry run task generate_dev_jwks
echo "🐻‍❄️✅ Server ready"

# Clients setup
cd /workspace/clients
pnpm install
echo "🐻‍❄️✅ Clients ready"

# Environment file
if [ ! -f "/workspace/clients/apps/web/.env" ]; then
    echo "🐻‍❄️ /workspace/clients/apps/web/.env does not exist, creating it"
    cp /workspace/clients/apps/web/.env.template /workspace/clients/apps/web/.env
fi

echo "🐻‍❄️✅✅✅ Setup complete"
