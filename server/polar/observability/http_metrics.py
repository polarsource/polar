"""
HTTP request metrics for SLI/SLO monitoring.

These metrics track all HTTP endpoints (except those in METRICS_DENY_LIST)
for availability and latency SLIs.

Metrics:
- polar_http_request_total: Counter of total requests by endpoint, method, status_code
- polar_http_request_duration_seconds: Histogram of request duration by endpoint, method
"""

import os

from polar.config import settings

# Setup multiprocess prometheus directory before importing prometheus_client
# This enables metrics to be shared across API server processes
prometheus_dir = settings.WORKER_PROMETHEUS_DIR
prometheus_dir.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", str(prometheus_dir))

from prometheus_client import (  # noqa: E402
    Counter,
    Histogram,
)

# Endpoints to EXCLUDE from metrics (noisy/not useful for SLO)
METRICS_DENY_LIST: set[str] = {
    "/healthz",
    "/readyz",
    "/.well-known/openid-configuration",
    "/.well-known/jwks.json",
}

# HTTP request counter for availability SLI
# Labels:
# - endpoint: normalized path template (e.g., "/v1/checkouts/{id}")
# - method: HTTP method (GET, POST, etc.)
# - status_code: HTTP status code as string
HTTP_REQUEST_TOTAL = Counter(
    "polar_http_request_total",
    "Total number of HTTP requests",
    ["endpoint", "method", "status_code"],
)

# HTTP request duration histogram for latency SLI
# Labels:
# - endpoint: normalized path template
# - method: HTTP method
# Buckets optimized for varying endpoint latency requirements:
# - Fast endpoints: p99 < 200ms (fine-grained buckets below 0.2s)
# - Slow endpoints: p99 < 30s (extended range up to 30s)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "polar_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["endpoint", "method"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)
