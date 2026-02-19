"""
Grafana Cloud Prometheus HTTP API client.

Implements the Prometheus HTTP Query API:
https://prometheus.io/docs/prometheus/latest/querying/api/
"""

from datetime import datetime
from typing import Any

import httpx
import structlog

from polar.config import settings
from polar.logging import Logger

log: Logger = structlog.get_logger()


class GrafanaCloudConfigError(Exception):
    """Raised when Grafana Cloud credentials are not configured."""

    pass


class GrafanaCloudAPIError(Exception):
    """Raised when a Grafana Cloud API request fails."""

    pass


class GrafanaCloudPrometheusClient:
    """Client for querying Grafana Cloud's Prometheus-compatible API."""

    def __init__(
        self,
        base_url: str | None = None,
        user: str | None = None,
        api_key: str | None = None,
    ) -> None:
        self.base_url = base_url or settings.GRAFANA_CLOUD_PROMETHEUS_QUERY_URL
        self.user = user or settings.GRAFANA_CLOUD_PROMETHEUS_QUERY_USER
        self.api_key = api_key or settings.GRAFANA_CLOUD_PROMETHEUS_QUERY_KEY

        if not self.base_url or not self.user or not self.api_key:
            raise GrafanaCloudConfigError("Grafana Cloud credentials not configured")

        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            auth=(self.user, self.api_key),
            timeout=httpx.Timeout(30.0, connect=10.0),
        )

    async def query(self, promql: str, time: datetime | None = None) -> dict[str, Any]:
        """Execute an instant query at a single point in time."""
        params: dict[str, str] = {"query": promql}
        if time:
            params["time"] = str(time.timestamp())

        log.debug("prometheus_query", query=promql)
        try:
            response = await self.client.post("/api/v1/query", data=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise GrafanaCloudAPIError(
                f"Grafana API error: {e.response.status_code}"
            ) from None
        return response.json()

    async def query_range(
        self,
        promql: str,
        start: datetime,
        end: datetime,
        step: str = "1h",
    ) -> dict[str, Any]:
        """Execute a range query over a time range."""
        params = {
            "query": promql,
            "start": str(start.timestamp()),
            "end": str(end.timestamp()),
            "step": step,
        }

        log.debug("prometheus_query_range", query=promql)
        try:
            response = await self.client.post("/api/v1/query_range", data=params)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise GrafanaCloudAPIError(
                f"Grafana API error: {e.response.status_code}"
            ) from None
        return response.json()

    async def close(self) -> None:
        await self.client.aclose()
