#!/bin/bash

set -euo pipefail
set -x

# Server setup
# 1000:1000 is vscode:vscode
sudo chown 1000:1000 /workspace/server/.venv/
cd /workspace/server
poetry install

poetry run task db_migrate


echo "🐻‍❄️✅"
echo "🐻‍❄️✅ Setup complete"
