from typing import Any

import pytest

from polar.observability.slo import CRITICAL_ENDPOINTS
from polar.observability.slo_report.client import GrafanaCloudAPIError
from polar.observability.slo_report.service import SLOReportService


class FakeClient:
    def __init__(self, failing: str | None = None) -> None:
        self.failing = failing
        self.queries: list[str] = []

    async def query(self, promql: str) -> dict[str, Any]:
        self.queries.append(promql)
        if self.failing is not None and self.failing in promql:
            raise GrafanaCloudAPIError("Grafana API error: 422")
        endpoint, method, *_ = CRITICAL_ENDPOINTS[0]
        labels = (
            {"endpoint": endpoint, "method": method}
            if "sum by (endpoint, method)" in promql
            else {}
        )
        return {
            "status": "success",
            "data": {
                "resultType": "vector",
                "result": [{"metric": labels, "value": [0, "100"]}],
            },
        }


@pytest.fixture
def client() -> FakeClient:
    return FakeClient(failing="histogram_quantile")


@pytest.fixture
def service(client: FakeClient) -> SLOReportService:
    service = SLOReportService()
    service._client = client  # type: ignore[assignment]
    return service


@pytest.mark.anyio
class TestGenerateReport:
    async def test_endpoint_queries_restricted_to_critical_endpoints(
        self, client: FakeClient, service: SLOReportService
    ) -> None:
        await service.generate_report(environment="production")

        endpoint_queries = [q for q in client.queries if "by (endpoint, method" in q]
        assert len(endpoint_queries) == 4
        for query in endpoint_queries:
            assert r'endpoint=~"' in query
            assert r"|/v1/checkouts/\\{id\\}|" in query

    async def test_failed_query_marks_report_incomplete(
        self, service: SLOReportService
    ) -> None:
        report = await service.generate_report(environment="production")

        assert report.failed_queries == ["Endpoint P99 latency"]
        assert report.overall_status == "incomplete"
        assert all(e.p99_actual is None for e in report.endpoints)

    async def test_all_queries_failed(
        self, client: FakeClient, service: SLOReportService
    ) -> None:
        client.failing = ""

        with pytest.raises(GrafanaCloudAPIError):
            await service.generate_report(environment="production")

    async def test_invalid_environment(self, service: SLOReportService) -> None:
        with pytest.raises(ValueError, match="is not a valid Environment"):
            await service.generate_report(environment='production", env=~".*')
