#!/bin/bash

set -euo pipefail
set -x

# Server setup
# 1000:1000 is vscode:vscode
sudo chown 1000:1000 /workspace/server/.venv/
cd /workspace/server
poetry install
poetry run task db_migrate
echo "🐻‍❄️✅ Server ready"

# Clients setup
cd /workspace/clients
sudo chown 1000:1000 /workspace/clients/node_modules
pnpm install
echo "🐻‍❄️✅ Clients ready"

echo "🐻‍❄️✅✅✅ Setup complete"
