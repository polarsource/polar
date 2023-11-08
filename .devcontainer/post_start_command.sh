#!/bin/bash

set -euo pipefail
set -x

# Server setup
# 1000:1000 is vscode:vscode
sudo chown 1000:1000 /workspace/server/.venv/
cd /workspace/server
poetry install
echo "🐻‍❄️✅ Server ready"

# Clients setup
cd /workspace/clients
sudo chown 1000:1000 /workspace/clients/node_modules
pnpm install
echo "🐻‍❄️✅ Clients ready"


if [ ! -f "/workspace/clients/apps/web/.env" ]; then
    echo "🐻‍❄️ /workspace/clients/apps/web/.env does not exist, creating it"
    cp /workspace/clients/apps/web/.env.devcontainer /workspace/clients/apps/web/.env
fi


echo "🐻‍❄️✅✅✅ Setup complete"
