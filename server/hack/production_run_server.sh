#!/usr/bin/env bash

set -euo pipefail

echo "🐻‍❄️ Running database migrations" 
poetry run task db_migrate
echo "🐻‍❄️ Running database migrations ✅"


echo "🐻‍❄️ Starting application"
poetry run uvicorn polar.app:app --host 0.0.0.0 --port 10000
echo "❌ Application stopped"