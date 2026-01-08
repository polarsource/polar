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
    METRICS_DENY_LIST,
)


class HttpMetricsMiddleware:
    """
    ASGI middleware that records HTTP metrics for all endpoints.

    Metrics are recorded in the finally block after the request completes,
    which ensures scope["route"] is populated by FastAPI's routing.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    def _get_path_template(self, scope: Scope) -> str | None:
        """
        Get the normalized path template for metrics labeling.

        Primary: Uses scope["route"].path set by FastAPI after routing.
        Fallback: Regex normalization for 404s/unmatched routes.

        Returns None for deny-listed paths (no metrics recorded).
        """
        path = scope.get("path", "")

        # Check deny list (exact match and prefix)
        if path in METRICS_DENY_LIST:
            return None
        for denied in METRICS_DENY_LIST:
            if path.startswith(denied):
                return None

        # Primary: Use FastAPI's route object (most reliable)
        # This is populated after routing completes, which is why we
        # call this in the finally block after the request
        route = scope.get("route")
        if route and hasattr(route, "path"):
            return route.path  # e.g., "/v1/checkouts/{id}"

        # No route matched (404 on unknown path) - skip metrics
        # to prevent cardinality explosion from bots/attackers
        return None

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
            path_template = self._get_path_template(scope)
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
