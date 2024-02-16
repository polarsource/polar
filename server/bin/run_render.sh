#!/bin/bash

set -euo pipefail

# Dynamically create grafana agent configuration
cat << EOF > ./agent-config.yaml
metrics:
  global:
    scrape_interval: 30s
  configs:
  - name: hosted-prometheus
    scrape_configs:
      - job_name: node
        static_configs:
        - targets: ['127.0.0.1:8000']
          labels:
            instance_id: "${RENDER_INSTANCE_ID}"
            service_name: "${RENDER_SERVICE_NAME}"
        basic_auth:
            username: "metrics"
            password: "${POLAR_PROMETHEUS_EXPORTER_HTTP_PASSWORD}"

    remote_write:
      - url: https://prometheus-prod-13-prod-us-east-0.grafana.net/api/prom/push
        basic_auth:
          username: "${GRAFANA_AGENT_USERNAME}"
          password: "${GRAFANA_AGENT_PASSWORD}"
EOF

# Run grafana agent in the background
/usr/bin/grafana-agent --config.file=agent-config.yaml &

poetry run uvicorn polar.app:app --host 0.0.0.0 --port 10000
