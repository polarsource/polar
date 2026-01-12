"""
SLO (Service Level Objective) configuration and metrics.

This module defines SLO targets for critical endpoints and exposes them
as Prometheus metrics. This enables:

1. Dynamic dashboard queries that compare current metrics vs targets
2. Single alert rules that cover ALL critical endpoints
3. Scalable SLO management (add endpoint = add to list, deploy, done)

Usage:
    Call start_slo_metrics() on application startup and stop_slo_metrics()
    on shutdown. Metrics are refreshed every 5 minutes.
"""

import threading

import structlog
from prometheus_client import Gauge

log = structlog.get_logger()

# SLO target metrics - refreshed periodically for dynamic comparisons
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
    ("/v1/checkouts/client/{client_secret}/confirm", "POST", 5.0, 99.95),
    # Checkout link redirect - entry point for checkout links
    ("/v1/checkout-links/{client_secret}/redirect", "GET", 3.0, 99.95),
    # Create checkout - API checkout creation
    ("/v1/checkouts/", "POST", 2.5, 99.95),
    # Update checkout - client-side checkout modifications
    ("/v1/checkouts/client/{client_secret}", "PATCH", 2.0, 99.95),
    # Get checkout by client secret - public checkout UI read path
    ("/v1/checkouts/client/{client_secret}", "GET", 1.2, 99.95),
    # Get checkout by ID - authenticated read path
    ("/v1/checkouts/{id}", "GET", 0.3, 99.95),
]

_refresh_thread: threading.Thread | None = None
_shutdown_event: threading.Event | None = None

SLO_REFRESH_INTERVAL_SECONDS = 300  # 5 minutes


def start_slo_metrics() -> None:
    """Initialize SLO metrics and start background refresh thread."""
    global _refresh_thread, _shutdown_event

    # Initialize metrics immediately
    _set_slo_metrics()

    # Start periodic refresh if not already running
    if _refresh_thread is not None:
        return

    _shutdown_event = threading.Event()
    _refresh_thread = threading.Thread(
        target=_run_refresh_loop,
        args=(_shutdown_event,),
        daemon=True,
    )
    _refresh_thread.start()
    log.info("slo_metrics_started", refresh_interval=SLO_REFRESH_INTERVAL_SECONDS)


def stop_slo_metrics() -> None:
    """Stop the SLO metrics refresh thread."""
    global _refresh_thread, _shutdown_event

    if _shutdown_event is not None:
        _shutdown_event.set()

    if _refresh_thread is not None:
        _refresh_thread.join(timeout=5.0)
        _refresh_thread = None
        _shutdown_event = None

    log.info("slo_metrics_stopped")


def _run_refresh_loop(shutdown_event: threading.Event) -> None:
    """Background loop that refreshes SLO metrics periodically."""
    while not shutdown_event.is_set():
        shutdown_event.wait(SLO_REFRESH_INTERVAL_SECONDS)
        if not shutdown_event.is_set():
            try:
                _set_slo_metrics()
            except Exception:
                log.exception("slo_metrics_refresh_error")


def _set_slo_metrics() -> None:
    """
    Set SLO target metrics with configured values.

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
