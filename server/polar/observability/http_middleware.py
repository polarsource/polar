"""
HTTP metrics middleware for SLI/SLO monitoring.

This middleware tracks request count and duration for all HTTP endpoints
(except those in METRICS_DENY_LIST) to enable availability and latency SLIs.

Path normalization strategy:
1. Primary: Use FastAPI's scope["route"].path (most reliable, zero maintenance)
2. Fallback: Regex normalization for 404s and unmatched routes
"""

import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from polar.observability.http_metrics import (
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUEST_TOTAL,
)
from polar.observability.utils import get_path_template


class HttpMetricsMiddleware:
    """
    ASGI middleware that records HTTP metrics for all endpoints.

    Metrics are recorded in the finally block after the request completes,
    which ensures scope["route"] is populated by FastAPI's routing.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.perf_counter()
        status_code = "500"  # Default in case of unhandled exception

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = str(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            # Route is now populated by FastAPI (after routing completed)
            path_template = get_path_template(scope)
            if path_template is not None:  # None means deny-listed
                duration = time.perf_counter() - start_time
                method = scope.get("method", "UNKNOWN")

                HTTP_REQUEST_TOTAL.labels(
                    endpoint=path_template,
                    method=method,
                    status_code=status_code,
                ).inc()

                HTTP_REQUEST_DURATION_SECONDS.labels(
                    endpoint=path_template,
                    method=method,
                ).observe(duration)
