#! /bin/bash

set -euo pipefail
set -x

# Create test database
./dev/create-test-db

# Server setup
cd /workspace/server
poetry install
poetry run task generate_dev_jwks
echo "🐻‍❄️✅ Server ready"

# Clients setup
cd /workspace/clients
pnpm install
echo "🐻‍❄️✅ Clients ready"

# Install uv
pip install -U uv

echo "🐻‍❄️✅ Setup complete"
