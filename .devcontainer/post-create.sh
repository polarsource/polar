#! /bin/bash

set -euo pipefail
set -x

# Setup uv
pip install -U pip uv

# Create test database
./dev/create-test-db

# Server setup
cd /workspace/server
uv sync --frozen
uv run task generate_dev_jwks
echo "🐻‍❄️✅ Server ready"

# Clients setup
cd /workspace/clients
pnpm install
echo "🐻‍❄️✅ Clients ready"

# Install uv
pip install -U uv

echo "🐻‍❄️✅ Setup complete"
