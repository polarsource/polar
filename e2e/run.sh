#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

POLAR_E2E_USER_SESSION=$(cd "$SCRIPT_DIR/../server" && uv run python -m scripts.user_session fvoron@gmail.com)

cd "$SCRIPT_DIR" && POLAR_E2E_USER_SESSION="$POLAR_E2E_USER_SESSION" uv run pytest tests/
