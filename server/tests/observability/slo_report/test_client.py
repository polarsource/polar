import httpx
import pytest

from polar.observability.slo_report.client import (
    GrafanaCloudAPIError,
    GrafanaCloudPrometheusClient,
)


@pytest.mark.anyio
class TestQuery:
    async def test_error_includes_prometheus_message(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                422,
                json={
                    "status": "error",
                    "errorType": "execution",
                    "error": "the query exceeded the maximum number of chunks",
                },
            )

        client = GrafanaCloudPrometheusClient(
            base_url="https://prometheus.test", user="user", api_key="key"
        )
        client.client = httpx.AsyncClient(
            base_url="https://prometheus.test", transport=httpx.MockTransport(handler)
        )

        with pytest.raises(GrafanaCloudAPIError) as exc_info:
            await client.query("up")

        assert str(exc_info.value) == (
            "Grafana API error: 422 "
            "(execution: the query exceeded the maximum number of chunks)"
        )
