from typing import Any

import httpx
import pytest

from polar.observability.slo import CRITICAL_ENDPOINTS
from polar.observability.slo_report.client import (
    GrafanaCloudAPIError,
    GrafanaCloudPrometheusClient,
)
from polar.observability.slo_report.service import SLOReportService
from polar.observability.slo_report.slack import format_slo_report_slack_payload


def _vector(*results: dict[str, Any]) -> dict[str, Any]:
    return {"status": "success", "data": {"resultType": "vector", "result": results}}


def _sample(value: str, **labels: str) -> dict[str, Any]:
    return {"metric": labels, "value": [0, value]}


class FakeClient:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def query(self, promql: str) -> dict[str, Any]:
        self.queries.append(promql)
        endpoint, method, *_ = CRITICAL_ENDPOINTS[0]
        if "histogram_quantile" in promql:
            raise GrafanaCloudAPIError("Grafana API error: 422")
        if "sum by (endpoint, method)" in promql:
            return _vector(_sample("100", endpoint=endpoint, method=method))
        return _vector(_sample("99.99"))

    async def close(self) -> None:
        pass


def _service(client: FakeClient) -> SLOReportService:
    service = SLOReportService()
    service._client = client  # type: ignore[assignment]
    return service


@pytest.mark.anyio
class TestGenerateReport:
    async def test_endpoint_queries_restricted_to_critical_endpoints(self) -> None:
        client = FakeClient()

        await _service(client).generate_report(environment="production")

        endpoint_queries = [q for q in client.queries if "by (endpoint, method" in q]
        assert len(endpoint_queries) == 4
        for query in endpoint_queries:
            assert "$endpoints" not in query
            assert r'endpoint=~"' in query
            assert r"|/v1/checkouts/\\{id\\}|" in query

    async def test_failed_query_marks_report_incomplete(self) -> None:
        report = await _service(FakeClient()).generate_report(environment="production")

        assert report.failed_queries == ["Endpoint P99 latency"]
        assert report.overall_status == "incomplete"
        assert all(e.p99_actual is None for e in report.endpoints)

        payload = format_slo_report_slack_payload(report)
        texts = [b["text"]["text"] for b in payload["blocks"] if "text" in b]
        assert any(
            "Incomplete report" in t and "Endpoint P99 latency" in t for t in texts
        )


@pytest.mark.anyio
async def test_client_error_includes_prometheus_message() -> None:
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
