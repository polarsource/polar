"""
Checkout-specific metrics for anomaly detection.

These metrics track checkout creation and success rates globally,
enabling Grafana ML-based anomaly detection for payment flow health.

Metrics:
- polar_checkout_created_total: Counter of checkouts created
- polar_checkout_succeeded_total: Counter of successful checkouts
"""

import os

from polar.config import settings

# Setup multiprocess prometheus directory before importing prometheus_client
# This enables metrics to be shared across API server processes
prometheus_dir = settings.WORKER_PROMETHEUS_DIR
prometheus_dir.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", str(prometheus_dir))

from prometheus_client import Counter  # noqa: E402

CHECKOUT_CREATED_TOTAL = Counter(
    "polar_checkout_created_total",
    "Total number of checkouts created",
)

CHECKOUT_SUCCEEDED_TOTAL = Counter(
    "polar_checkout_succeeded_total",
    "Total number of checkouts that succeeded (payment completed)",
)
