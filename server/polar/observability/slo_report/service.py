"""
SLO report generation service.

Queries Prometheus for SLO metrics and calculates weekly report data.
Reuses PromQL patterns from server/monitoring/grafana/dashboards/api-slo.json.
"""

from datetime import timedelta

import structlog

from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.observability.slo import CRITICAL_ENDPOINTS

from .client import GrafanaCloudAPIError, GrafanaCloudPrometheusClient
from .schemas import EndpointSLOStatus, SLOReport

log: Logger = structlog.get_logger()


# PromQL queries adapted from api-slo.json dashboard
# $env and $range are substituted before execution

GLOBAL_AVAILABILITY_QUERY = """
100 * (1 - (
  (sum(increase(polar_http_request_total{env="$env", status_code=~"5.."}[$range])) or vector(0))
  / sum(increase(polar_http_request_total{env="$env"}[$range]))
))
"""

ERROR_BUDGET_REMAINING_QUERY = """
100 * clamp_min(1 - (
  (sum(increase(polar_http_request_total{env="$env", status_code=~"5.."}[$range])) or vector(0))
  / clamp_min(0.0005 * sum(increase(polar_http_request_total{env="$env"}[$range])), 0.001)
), 0)
"""

ENDPOINT_P99_QUERY = """
histogram_quantile(0.99, sum by (endpoint, method, le) (
  rate(polar_http_request_duration_seconds_bucket{env="$env"}[$range])
))
"""

ENDPOINT_AVAILABILITY_QUERY = """
100 * (1 - (
  sum by (endpoint, method) (increase(polar_http_request_total{env="$env", status_code=~"5.."}[$range]))
  or (sum by (endpoint, method) (increase(polar_http_request_total{env="$env"}[$range])) * 0)
) / clamp_min(sum by (endpoint, method) (increase(polar_http_request_total{env="$env"}[$range])), 1))
"""

ENDPOINT_REQUEST_COUNT_QUERY = """
sum by (endpoint, method) (increase(polar_http_request_total{env="$env"}[$range]))
"""

ENDPOINT_ERROR_COUNT_QUERY = """
sum by (endpoint, method) (increase(polar_http_request_total{env="$env", status_code=~"5.."}[$range]))
"""

TOTAL_REQUESTS_QUERY = """
sum(increase(polar_http_request_total{env="$env"}[$range]))
"""

TOTAL_ERRORS_QUERY = """
sum(increase(polar_http_request_total{env="$env", status_code=~"5.."}[$range]))
"""


class SLOReportService:
    """Service for generating SLO reports."""

    def __init__(self) -> None:
        self._client: GrafanaCloudPrometheusClient | None = None

    def _ensure_client(self) -> GrafanaCloudPrometheusClient:
        if self._client is None:
            self._client = GrafanaCloudPrometheusClient()
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()

    def _substitute_query(self, query: str, env: str, range_duration: str) -> str:
        """Substitute template variables in PromQL query."""
        return query.replace("$env", env).replace("$range", range_duration)

    async def _query_scalar(self, query: str) -> float | None:
        """Execute query and extract scalar result."""
        client = self._ensure_client()
        try:
            result = await client.query(query)
            if result.get("status") != "success":
                log.warning(
                    "prometheus_query_failed",
                    query=query[:100],
                    status=result.get("status"),
                    error_type=result.get("errorType"),
                )
                return None

            data = result.get("data", {})
            if data.get("resultType") == "vector" and data.get("result"):
                # Take first result's value
                value = data["result"][0].get("value", [None, None])[1]
                if value is not None and value != "NaN":
                    return float(value)
            return None
        except GrafanaCloudAPIError as e:
            log.error("prometheus_query_error", query=query[:100], error=str(e))
            return None

    async def _query_by_labels(
        self, query: str, label_keys: list[str]
    ) -> dict[tuple[str, ...], float]:
        """Execute query and return results keyed by label values."""
        client = self._ensure_client()
        try:
            result = await client.query(query)
            if result.get("status") != "success":
                return {}

            data = result.get("data", {})
            results: dict[tuple[str, ...], float] = {}

            for item in data.get("result", []):
                metric = item.get("metric", {})
                key = tuple(metric.get(k, "") for k in label_keys)
                value = item.get("value", [None, None])[1]
                if value is not None and value != "NaN":
                    results[key] = float(value)

            return results
        except GrafanaCloudAPIError as e:
            log.error("prometheus_query_error", query=query[:100], error=str(e))
            return {}

    async def generate_report(
        self,
        environment: str | None = None,
    ) -> SLOReport:
        """
        Generate SLO report for the last 7 days.
        """
        env = environment or settings.ENV.value

        period_end = utc_now()
        period_start = period_end - timedelta(days=7)

        # Calculate range duration string for PromQL
        range_seconds = int((period_end - period_start).total_seconds())
        range_duration = f"{range_seconds}s"

        log.info(
            "slo_report_generating",
            environment=env,
            period_start=period_start.isoformat(),
            period_end=period_end.isoformat(),
            range_duration=range_duration,
        )

        # Fetch global metrics
        global_availability = await self._query_scalar(
            self._substitute_query(GLOBAL_AVAILABILITY_QUERY, env, range_duration)
        )
        error_budget = await self._query_scalar(
            self._substitute_query(ERROR_BUDGET_REMAINING_QUERY, env, range_duration)
        )
        total_requests = await self._query_scalar(
            self._substitute_query(TOTAL_REQUESTS_QUERY, env, range_duration)
        )
        total_errors = await self._query_scalar(
            self._substitute_query(TOTAL_ERRORS_QUERY, env, range_duration)
        )

        # Fetch per-endpoint metrics
        p99_by_endpoint = await self._query_by_labels(
            self._substitute_query(ENDPOINT_P99_QUERY, env, range_duration),
            ["endpoint", "method"],
        )
        availability_by_endpoint = await self._query_by_labels(
            self._substitute_query(ENDPOINT_AVAILABILITY_QUERY, env, range_duration),
            ["endpoint", "method"],
        )
        requests_by_endpoint = await self._query_by_labels(
            self._substitute_query(ENDPOINT_REQUEST_COUNT_QUERY, env, range_duration),
            ["endpoint", "method"],
        )
        errors_by_endpoint = await self._query_by_labels(
            self._substitute_query(ENDPOINT_ERROR_COUNT_QUERY, env, range_duration),
            ["endpoint", "method"],
        )

        # Build endpoint status list from CRITICAL_ENDPOINTS config
        endpoints: list[EndpointSLOStatus] = []
        for endpoint, method, p99_target, availability_target in CRITICAL_ENDPOINTS:
            key = (endpoint, method)
            endpoints.append(
                EndpointSLOStatus(
                    endpoint=endpoint,
                    method=method,
                    p99_target=p99_target,
                    p99_actual=p99_by_endpoint.get(key),
                    availability_target=availability_target,
                    availability_actual=availability_by_endpoint.get(key),
                    request_count=int(requests_by_endpoint.get(key, 0)),
                    error_count=int(errors_by_endpoint.get(key, 0)),
                )
            )

        return SLOReport(
            period_start=period_start,
            period_end=period_end,
            environment=env,
            global_availability=global_availability or 100.0,
            error_budget_remaining=error_budget or 100.0,
            total_requests=int(total_requests or 0),
            total_errors=int(total_errors or 0),
            endpoints=endpoints,
        )


slo_report_service = SLOReportService()
