"""
SLO (Service Level Objective) configuration and metrics.

This module defines SLO targets for critical endpoints and exposes them
as Prometheus metrics. This enables:

1. Dynamic dashboard queries that compare current metrics vs targets
2. Single alert rules that cover ALL critical endpoints
3. Scalable SLO management (add endpoint = add to list, deploy, done)

Usage:
    Call init_slo_metrics() once on application startup to populate
    the target metrics.
"""

from prometheus_client import Gauge

# SLO target metrics - set once on startup, used for dynamic comparisons
# These metrics allow dashboard queries and alerts to use group_left joins
# to compare actual values against per-endpoint targets.

SLO_P99_TARGET = Gauge(
    "polar_slo_p99_target_seconds",
    "P99 latency SLO target in seconds for critical endpoints",
    ["endpoint", "method"],
)

SLO_AVAILABILITY_TARGET = Gauge(
    "polar_slo_availability_target",
    "Availability SLO target as percentage for critical endpoints",
    ["endpoint", "method"],
)


# SLO Configuration for Critical Endpoints
# Format: (endpoint_path, http_method, p99_target_seconds, availability_target_percent)
#
# To add a new endpoint:
#   1. Add a tuple to this list
#   2. Deploy the application
#   3. The endpoint is automatically monitored and alerted
#
# Endpoint paths must match the FastAPI route templates exactly
# (e.g., "/v1/checkouts/{id}" not "/v1/checkouts/123")

CRITICAL_ENDPOINTS: list[tuple[str, str, float, float]] = [
    # Checkout confirmation - critical payment flow
    # P99 target: 8 seconds (includes Stripe payment processing)
    # Availability target: 99.95%
    ("/v1/checkouts/client/{client_secret}/confirm", "POST", 8.0, 99.95),
    # Get checkout by client secret - public checkout UI read path
    # P99 target: 500ms
    # Availability target: 99.95%
    ("/v1/checkouts/client/{client_secret}", "GET", 0.5, 99.95),
    # Get checkout by ID - authenticated read path
    # P99 target: 500ms
    # Availability target: 99.95%
    ("/v1/checkouts/{id}", "GET", 0.5, 99.95),
    # Add more critical endpoints here as needed
]


def init_slo_metrics() -> None:
    """
    Initialize SLO target metrics with configured values.

    Call this once on application startup. The metrics are then available
    for Prometheus queries that compare actual values against targets.

    Example PromQL using these metrics:
        # Check if p99 exceeds target for any critical endpoint:
        histogram_quantile(0.99, sum by (endpoint, method, le) (
            rate(polar_http_request_duration_seconds_bucket[5m])
        )) > on(endpoint, method) polar_slo_p99_target_seconds
    """
    for endpoint, method, p99_target, availability_target in CRITICAL_ENDPOINTS:
        SLO_P99_TARGET.labels(endpoint=endpoint, method=method).set(p99_target)
        SLO_AVAILABILITY_TARGET.labels(endpoint=endpoint, method=method).set(
            availability_target
        )
